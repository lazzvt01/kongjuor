import { supabase } from '@/lib/supabase'
import type { Ciclo } from '@/types'

export async function listarCiclos(emprestimoId: string): Promise<Ciclo[]> {
  const { data, error } = await supabase
    .from('emprestimo_ciclos')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .order('numero_ciclo', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Ciclo[]) ?? []
}

export async function listarCiclosDoCredor(): Promise<Ciclo[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('emprestimo_ciclos')
    .select('*')
    .eq('credor_id', user.id)
    .order('numero_ciclo', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Ciclo[]) ?? []
}

export async function renovarCiclo(emprestimoId: string, novoVencimento: string) {
  const { data: emp } = await supabase
    .from('emprestimos')
    .select('cliente_id')
    .eq('id', emprestimoId)
    .single()
  const { error } = await supabase.rpc('renovar_ciclo', {
    p_emprestimo: emprestimoId,
    p_novo_vencimento: novoVencimento,
  })
  if (error) throw new Error(error.message)
  const clienteId = (emp as { cliente_id: string } | null)?.cliente_id
  if (clienteId) {
    void supabase.rpc('recalcular_score', { p_cliente: clienteId })
  }
}

export async function renegociarCiclo(emprestimoId: string, jurosRenegociado: number) {
  const { data: emp } = await supabase
    .from('emprestimos')
    .select('cliente_id')
    .eq('id', emprestimoId)
    .single()
  const { error } = await supabase.rpc('renegociar_ciclo', {
    p_emprestimo: emprestimoId,
    p_juros_renegociado: jurosRenegociado,
  })
  if (error) throw new Error(error.message)
  const clienteId = (emp as { cliente_id: string } | null)?.cliente_id
  if (clienteId) {
    void supabase.rpc('recalcular_score', { p_cliente: clienteId })
  }
}
