import { supabase } from '@/lib/supabase'
import type { Cliente, Ciclo, Emprestimo, Pagamento, Parcela } from '@/types'
import {
  atualizarStatusEmprestimos,
  detalhesJuros,
  diasAtraso,
  jurosRecebidos,
} from '@/services/financial'

export interface Cobranca {
  emprestimo: Emprestimo
  cliente: Cliente | null
  parcela?: Parcela | null
  valorDevido: number
  valorPego: number
  jurosDevido: number
  jurosLabel: string
  dataVencimento: string
  diasAtraso: number
}

export interface DashboardData {
  aReceberHoje: Cobranca[]
  atrasados: Cobranca[]
  proximos: Cobranca[]
  indicadores: {
    aReceberHoje: number
    emAtraso: number
    totalEmprestado: number
    totalClientes: number
    emprestimosAtivos: number
    jurosPrevistoHoje: number
  }
}

export async function obterDashboard(): Promise<DashboardData> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      aReceberHoje: [],
      atrasados: [],
      proximos: [],
      indicadores: {
        aReceberHoje: 0,
        emAtraso: 0,
        totalEmprestado: 0,
        totalClientes: 0,
        emprestimosAtivos: 0,
        jurosPrevistoHoje: 0,
      },
    }
  }

  const [clientesRes, emprestimosRes, parcelasRes] = await Promise.all([
    supabase.from('clientes').select('*').eq('credor_id', user.id),
    supabase.from('emprestimos').select('*').eq('credor_id', user.id),
    supabase.from('parcelas').select('*').eq('credor_id', user.id),
  ])

  const clientes = (clientesRes.data as Cliente[]) ?? []
  const emprestimos = atualizarStatusEmprestimos((emprestimosRes.data as Emprestimo[]) ?? [])
  const parcelasPorEmprestimo = new Map<string, Parcela[]>()
  for (const parcela of (parcelasRes.data as Parcela[]) ?? []) {
    const arr = parcelasPorEmprestimo.get(parcela.emprestimo_id) ?? []
    arr.push(parcela)
    parcelasPorEmprestimo.set(parcela.emprestimo_id, arr)
  }
  const clientesPorId = new Map(clientes.map((c) => [c.id, c]))

  const ativos = emprestimos.filter((e) => e.saldo_atual > 0)

  const cobrancas = ativos.map((emprestimo) => {
    const cliente = clientesPorId.get(emprestimo.cliente_id) ?? null
    const parcelas = parcelasPorEmprestimo.get(emprestimo.id) ?? []
    const parcela =
      emprestimo.tipo === 'parcelado'
        ? [...parcelas].sort((a, b) => a.numero - b.numero).find((p) => p.saldo > 0) ?? null
        : null
    const dataVencimento = parcela?.data_vencimento ?? emprestimo.data_vencimento
    const dias = diasAtraso(dataVencimento)
    const { valorPego, juros, jurosLabel } = detalhesJuros(emprestimo)
    return {
      emprestimo,
      cliente,
      parcela,
      valorDevido: emprestimo.saldo_atual,
      valorPego: parcela ? parcela.valor_principal : valorPego,
      jurosDevido: parcela ? parcela.valor_juros : juros,
      jurosLabel,
      dataVencimento,
      diasAtraso: dias,
    }
  })

  const aReceberHoje = cobrancas.filter((c) => c.diasAtraso === 0)
  const atrasados = cobrancas.filter((c) => c.diasAtraso > 0)
  const proximos = cobrancas
    .filter((c) => c.diasAtraso < 0)
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))

  // "Total emprestado" = soma do capital emprestado (valor principal),
  // sem os juros. Juros é lucro, não dinheiro que saiu do bolso do credor.
  const totalEmprestado = ativos.reduce((acc, e) => acc + e.valor_principal, 0)
  const jurosPrevistoHoje = aReceberHoje.reduce((acc, c) => acc + c.jurosDevido, 0)

  return {
    aReceberHoje,
    atrasados,
    proximos,
    indicadores: {
      aReceberHoje: aReceberHoje.reduce((acc, c) => acc + c.valorDevido, 0),
      emAtraso: atrasados.reduce((acc, c) => acc + c.valorDevido, 0),
      totalEmprestado,
      totalClientes: clientes.length,
      emprestimosAtivos: ativos.length,
      jurosPrevistoHoje,
    },
  }
}

export interface RelatorioData {
  totalEmprestado: number
  totalRecebido: number
  totalEmAberto: number
  totalAtrasado: number
  jurosRecebidos: number
  emprestimosAtivos: number
  emprestimosQuitados: number
  emprestimosAtrasados: number
  emprestimosRenovados: number
  totalClientes: number
  clientesAtrasados: number
  melhoresScores: { cliente: Cliente; score: number }[]
  porPeriodo: { label: string; emprestado: number; recebido: number }[]
}

export async function obterRelatorio(inicio: string | null, fim: string | null): Promise<RelatorioData> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Sessão expirada')
  }

  const base = supabase.from('emprestimos').select('*').eq('credor_id', user.id)
  const empsQuery = inicio && fim ? base.gte('data_inicio', inicio).lte('data_inicio', fim) : base
  const { data: emprestimosData } = await empsQuery
  const emprestimos = atualizarStatusEmprestimos((emprestimosData as Emprestimo[]) ?? [])

  const pagQuery = supabase
    .from('pagamentos')
    .select('*')
    .eq('credor_id', user.id)
  const pagamentosFiltrado = inicio && fim ? pagQuery.gte('data_pagamento', inicio).lte('data_pagamento', fim) : pagQuery
  const { data: pagamentosData } = await pagamentosFiltrado
  const pagamentos = (pagamentosData as Pagamento[]) ?? []

  const { data: clientesData } = await supabase.from('clientes').select('*').eq('credor_id', user.id)
  const clientes = (clientesData as Cliente[]) ?? []

  const renQuery = supabase.from('emprestimo_ciclos').select('*').eq('credor_id', user.id)
  const ciclosFiltrados =
    inicio && fim ? renQuery.gte('data_inicio', inicio).lte('data_inicio', fim) : renQuery
  const { data: ciclosData } = await ciclosFiltrados
  const ciclos = (ciclosData as Ciclo[]) ?? []

  const { data: scoresData } = await supabase
    .from('score_historico')
    .select('*')
    .eq('credor_id', user.id)
    .order('created_at', { ascending: false })
  const scores = (scoresData ?? []) as { cliente_id: string; score: number }[]
  const melhorScorePorCliente = new Map<string, number>()
  for (const s of scores) {
    if (!melhorScorePorCliente.has(s.cliente_id)) melhorScorePorCliente.set(s.cliente_id, s.score)
  }

  const totalEmprestado = emprestimos.reduce((acc, e) => acc + e.valor_principal, 0)
  const totalRecebido = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const totalEmAberto = emprestimos.filter((e) => e.saldo_atual > 0).reduce((acc, e) => acc + e.saldo_atual, 0)
  const atrasadosList = emprestimos.filter((e) => e.saldo_atual > 0 && diasAtraso(e.data_vencimento) > 0)
  const totalAtrasado = atrasadosList.reduce((acc, e) => acc + e.saldo_atual, 0)

  const parcelasPorEmprestimo = new Map<string, Parcela[]>()
  const { data: parcelasData } = await supabase
    .from('parcelas')
    .select('*')
    .eq('credor_id', user.id)
  for (const parc of (parcelasData as Parcela[]) ?? []) {
    const arr = parcelasPorEmprestimo.get(parc.emprestimo_id) ?? []
    arr.push(parc)
    parcelasPorEmprestimo.set(parc.emprestimo_id, arr)
  }
  const ciclosPorEmprestimo = new Map<string, Ciclo[]>()
  for (const ciclo of ciclos) {
    const arr = ciclosPorEmprestimo.get(ciclo.emprestimo_id) ?? []
    arr.push(ciclo)
    ciclosPorEmprestimo.set(ciclo.emprestimo_id, arr)
  }
  const jurosRecebidosTotal = emprestimos.reduce((acc, emp) => {
    const pagamentosDoEmp = pagamentos.filter((p) => p.emprestimo_id === emp.id)
    return acc + jurosRecebidos(emp, pagamentosDoEmp, parcelasPorEmprestimo.get(emp.id) ?? [], ciclosPorEmprestimo.get(emp.id) ?? [])
  }, 0)

  const melhoresScores = clientes
    .map((c) => ({ cliente: c, score: melhorScorePorCliente.get(c.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const clientesAtrasados = new Set(atrasadosList.map((e) => e.cliente_id)).size

  return {
    totalEmprestado,
    totalRecebido,
    totalEmAberto,
    totalAtrasado,
    jurosRecebidos: jurosRecebidosTotal,
    emprestimosAtivos: emprestimos.filter((e) => e.saldo_atual > 0).length,
    emprestimosQuitados: emprestimos.filter((e) => e.saldo_atual <= 0).length,
    emprestimosAtrasados: atrasadosList.length,
    emprestimosRenovados: ciclos.filter((c) => c.numero_ciclo > 1).length,
    totalClientes: clientes.length,
    clientesAtrasados,
    melhoresScores,
    porPeriodo: [],
  }
}
