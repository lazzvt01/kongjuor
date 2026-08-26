import { supabase } from '@/lib/supabase'
import { scoresPorCliente } from '@/services/financial/resumo'
import type { ResultadoScore } from '@/services/financial/score'
import type { Ciclo, Emprestimo, Pagamento, Parcela, ScoreHistorico } from '@/types'

export async function listarHistoricoScore(clienteId: string): Promise<ScoreHistorico[]> {
  const { data, error } = await supabase
    .from('score_historico')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(error.message)
  return (data as ScoreHistorico[]) ?? []
}

export async function listarScoresAtuais(): Promise<Map<string, ResultadoScore>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const map = new Map<string, ResultadoScore>()
  if (!user) return map
  const [emprestimosRes, pagamentosRes, ciclosRes, parcelasRes] = await Promise.all([
    supabase.from('emprestimos').select('*').eq('credor_id', user.id),
    supabase.from('pagamentos').select('*').eq('credor_id', user.id),
    supabase.from('emprestimo_ciclos').select('*').eq('credor_id', user.id),
    supabase.from('parcelas').select('*').eq('credor_id', user.id),
  ])
  const error =
    emprestimosRes.error?.message ??
    pagamentosRes.error?.message ??
    ciclosRes.error?.message ??
    parcelasRes.error?.message
  if (error) throw new Error(error)
  return scoresPorCliente(
    (emprestimosRes.data as Emprestimo[]) ?? [],
    (pagamentosRes.data as Pagamento[]) ?? [],
    (ciclosRes.data as Ciclo[]) ?? [],
    (parcelasRes.data as Parcela[]) ?? [],
  )
}

export async function gravarScore(clienteId: string, score: number, motivo?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('score_historico').insert({
    credor_id: user.id,
    cliente_id: clienteId,
    score,
    motivo: motivo ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function recalcularScore(clienteId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('recalcular_score', {
    p_cliente: clienteId,
  })
  if (error) throw new Error(error.message)
  return data as number | null
}
