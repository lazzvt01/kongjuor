import type { Ciclo, Emprestimo, Pagamento, Parcela } from '@/types'
import { jurosRecebidos } from './emprestimos'
import { calcularScore, type ResumoScore, type ResultadoScore } from './score'
import { estaEmAtraso } from './status'

export interface ResumoCliente {
  totalEmAberto: number
  totalEmprestado: number
  totalPago: number
  jurosRecebidos: number
  emprestimosAtivos: number
  score: number
  classificacao: ResultadoScore['classificacao']
  atrasados: number
}

function diasEntre(vencimento: string, data: string): number {
  return Math.round(
    (new Date(`${data}T12:00:00`).getTime() - new Date(`${vencimento}T12:00:00`).getTime()) /
      86400000,
  )
}

/**
 * Vencimento de referência de um pagamento, de forma rigorosa:
 * - parcelado: usa o vencimento da parcela paga;
 * - saldo aberto: usa o vencimento do ciclo vigente na data do pagamento;
 * - fallback: vencimento atual do empréstimo.
 */
function vencimentoDeReferencia(
  pagamento: Pagamento,
  porEmprestimo: Map<string, Emprestimo>,
  parcelasPorEmprestimo: Map<string, Parcela[]>,
  ciclosPorEmprestimo: Map<string, Pick<Ciclo, 'numero_ciclo' | 'data_inicio' | 'data_vencimento'>[]>,
): string | null {
  const emprestimo = porEmprestimo.get(pagamento.emprestimo_id)
  if (!emprestimo) return null

  if (emprestimo.tipo === 'parcelado' && pagamento.parcela_id) {
    const parcela = (parcelasPorEmprestimo.get(emprestimo.id) ?? []).find(
      (p) => p.id === pagamento.parcela_id,
    )
    if (parcela) return parcela.data_vencimento
  }

  const ciclos = ciclosPorEmprestimo.get(emprestimo.id) ?? []
  const vigente = [...ciclos]
    .filter((c) => c.data_inicio <= pagamento.data_pagamento)
    .sort((a, b) => b.numero_ciclo - a.numero_ciclo)[0]
  if (vigente) return vigente.data_vencimento

  return emprestimo.data_vencimento
}

function acumularResumoScore(
  emprestimos: Emprestimo[],
  pagamentos: Pagamento[],
  ciclos: Pick<Ciclo, 'numero_ciclo' | 'emprestimo_id' | 'data_inicio' | 'data_vencimento'>[],
  parcelas: Parcela[],
): ResumoScore {
  const quitados = emprestimos.filter((e) => e.saldo_atual <= 0).length
  const ativos = emprestimos.filter((e) => e.saldo_atual > 0).length
  const atrasos = emprestimos.filter(estaEmAtraso)

  const porEmprestimo = new Map(emprestimos.map((e) => [e.id, e]))
  const parcelasPorEmprestimo = new Map<string, Parcela[]>()
  for (const p of parcelas) {
    const arr = parcelasPorEmprestimo.get(p.emprestimo_id) ?? []
    arr.push(p)
    parcelasPorEmprestimo.set(p.emprestimo_id, arr)
  }
  const ciclosPorEmprestimo = new Map<string, Pick<Ciclo, 'numero_ciclo' | 'data_inicio' | 'data_vencimento'>[]>()
  for (const c of ciclos) {
    const arr = ciclosPorEmprestimo.get(c.emprestimo_id) ?? []
    arr.push(c)
    ciclosPorEmprestimo.set(c.emprestimo_id, arr)
  }

  let pagamentosEmDia = 0
  let pagamentosAntecipados = 0
  let pagamentosAtrasados = 0
  let diasAtrasoMaximo = 0
  for (const p of pagamentos) {
    const vencimento = vencimentoDeReferencia(p, porEmprestimo, parcelasPorEmprestimo, ciclosPorEmprestimo)
    if (!vencimento) continue
    const diff = diasEntre(vencimento, p.data_pagamento)
    if (diff <= 0) pagamentosEmDia++
    if (diff < -3) pagamentosAntecipados++
    if (diff > 0) {
      pagamentosAtrasados++
      diasAtrasoMaximo = Math.max(diasAtrasoMaximo, diff)
    }
  }
  for (const e of atrasos) {
    diasAtrasoMaximo = Math.max(
      diasAtrasoMaximo,
      Math.max(0, diasEntre(e.data_vencimento, new Date().toISOString().slice(0, 10))),
    )
  }

  return {
    totalEmprestimos: emprestimos.length,
    emprestimosQuitados: quitados,
    pagamentosEmDia,
    pagamentosAntecipados,
    pagamentosAtrasados,
    atrasosAtuais: atrasos.length,
    diasAtrasoMaximo,
    emprestimosAtivos: ativos,
  }
}

export function resumoCliente(
  emprestimos: Emprestimo[],
  pagamentos: Pagamento[],
  ciclos: Pick<Ciclo, 'numero_ciclo' | 'emprestimo_id' | 'data_inicio' | 'data_vencimento'>[] = [],
  parcelas: Parcela[] = [],
): ResumoCliente {
  const totalEmAberto = emprestimos.filter((e) => e.saldo_atual > 0).reduce((acc, e) => acc + e.saldo_atual, 0)
  const totalEmprestado = emprestimos.reduce((acc, e) => acc + e.valor_principal, 0)
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0)

  const jurosRecebidosTotal = emprestimos.reduce((acc, emp) => {
    const pagamentosDoEmprestimo = pagamentos.filter((p) => p.emprestimo_id === emp.id)
    const parcelasDoEmprestimo = parcelas.filter((p) => p.emprestimo_id === emp.id)
    return acc + jurosRecebidos(emp, pagamentosDoEmprestimo, parcelasDoEmprestimo)
  }, 0)

  const score = calcularScore(acumularResumoScore(emprestimos, pagamentos, ciclos, parcelas))

  return {
    totalEmAberto,
    totalEmprestado,
    totalPago,
    jurosRecebidos: jurosRecebidosTotal,
    emprestimosAtivos: emprestimos.filter((e) => e.saldo_atual > 0).length,
    score: score.score,
    classificacao: score.classificacao,
    atrasados: emprestimos.filter(estaEmAtraso).length,
  }
}

export function scoresPorCliente(
  emprestimos: Emprestimo[],
  pagamentos: Pagamento[],
  ciclos: Pick<Ciclo, 'emprestimo_id' | 'numero_ciclo' | 'data_inicio' | 'data_vencimento'>[],
  parcelas: Parcela[] = [],
): Map<string, ResultadoScore> {
  const emprestimoPorCliente = new Map<string, Emprestimo[]>()
  for (const e of emprestimos) {
    const arr = emprestimoPorCliente.get(e.cliente_id) ?? []
    arr.push(e)
    emprestimoPorCliente.set(e.cliente_id, arr)
  }
  const pagamentoPorCliente = new Map<string, Pagamento[]>()
  for (const p of pagamentos) {
    const arr = pagamentoPorCliente.get(p.cliente_id) ?? []
    arr.push(p)
    pagamentoPorCliente.set(p.cliente_id, arr)
  }
  const idClienteDoEmprestimo = new Map(emprestimos.map((e) => [e.id, e.cliente_id]))
  const cicloPorCliente = new Map<string, Pick<Ciclo, 'numero_ciclo' | 'emprestimo_id' | 'data_inicio' | 'data_vencimento'>[]>()
  for (const c of ciclos) {
    const cid = idClienteDoEmprestimo.get(c.emprestimo_id)
    if (!cid) continue
    const arr = cicloPorCliente.get(cid) ?? []
    arr.push(c)
    cicloPorCliente.set(cid, arr)
  }
  const parcelaPorCliente = new Map<string, Parcela[]>()
  for (const p of parcelas) {
    const cid = idClienteDoEmprestimo.get(p.emprestimo_id)
    if (!cid) continue
    const arr = parcelaPorCliente.get(cid) ?? []
    arr.push(p)
    parcelaPorCliente.set(cid, arr)
  }

  const ids = new Set([
    ...emprestimoPorCliente.keys(),
    ...pagamentoPorCliente.keys(),
    ...cicloPorCliente.keys(),
  ])
  const map = new Map<string, ResultadoScore>()
  for (const cid of ids) {
    const score = calcularScore(
      acumularResumoScore(
        emprestimoPorCliente.get(cid) ?? [],
        pagamentoPorCliente.get(cid) ?? [],
        cicloPorCliente.get(cid) ?? [],
        parcelaPorCliente.get(cid) ?? [],
      ),
    )
    map.set(cid, score)
  }
  return map
}
