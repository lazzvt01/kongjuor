import { supabase } from '@/lib/supabase'
import type { Emprestimo, NovoEmprestimoInput, Parcela } from '@/types'
import { construirEmprestimo } from '@/services/financial'
import { atualizarStatusEmprestimos } from '@/services/financial'

export async function listarEmprestimos(): Promise<Emprestimo[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('credor_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return atualizarStatusEmprestimos((data as Emprestimo[]) ?? [])
}

export async function listarEmprestimosPorCliente(clienteId: string): Promise<Emprestimo[]> {
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return atualizarStatusEmprestimos((data as Emprestimo[]) ?? [])
}

export async function obterEmprestimo(id: string): Promise<Emprestimo | null> {
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const emp = data as Emprestimo
  return atualizarStatusEmprestimos([emp])[0]
}

export async function criarEmprestimo(input: NovoEmprestimoInput): Promise<string> {
  const { emprestimo, parcelas, ciclos } = construirEmprestimo(input)

  const parcelasArray = parcelas
    ? parcelas.map((p) => ({
        numero: p.numero,
        data_vencimento: p.data_vencimento,
        valor_principal: p.valor_principal,
        valor_juros: p.valor_juros,
        valor_total: p.valor_total,
      }))
    : null

  const ciclosArray = ciclos
    ? ciclos.map((c) => ({
        numero_ciclo: c.numero_ciclo,
        saldo_principal_inicial: c.saldo_principal_inicial,
        juros_calculado: c.juros_calculado,
        juros_devido: c.juros_devido,
        data_inicio: c.data_inicio,
        data_vencimento: c.data_vencimento,
      }))
    : null

  const { data, error } = await supabase.rpc('criar_emprestimo', {
    p_cliente: input.cliente_id,
    p_tipo: emprestimo.tipo,
    p_forma_juros: emprestimo.forma_juros,
    p_valor_principal: emprestimo.valor_principal,
    p_juros_tipo: emprestimo.juros_tipo,
    p_juros_valor: emprestimo.juros_valor,
    p_juros_periodicidade: emprestimo.juros_periodicidade,
    p_intervalo: emprestimo.intervalo,
    p_data_inicio: emprestimo.data_inicio,
    p_data_vencimento: emprestimo.data_vencimento,
    p_valor_total: emprestimo.valor_total,
    p_saldo_atual: emprestimo.saldo_atual,
    p_quantidade_parcelas: emprestimo.quantidade_parcelas,
    p_parcelas: parcelasArray,
    p_ciclos: ciclosArray,
    p_saldo_devedor: emprestimo.saldo_devedor,
    p_deixou_garantia: emprestimo.deixou_garantia,
    p_garantia: emprestimo.garantia,
    p_observacao: input.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
  void supabase.rpc('recalcular_score', { p_cliente: input.cliente_id })
  return data as string
}

export async function listarParcelas(emprestimoId: string): Promise<Parcela[]> {
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .order('numero', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Parcela[]) ?? []
}

export async function listarParcelasDoCredor(): Promise<Parcela[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('credor_id', user.id)
    .order('numero', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Parcela[]) ?? []
}

export async function obterParcela(id: string): Promise<Parcela | null> {
  const { data, error } = await supabase.from('parcelas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Parcela | null) ?? null
}
