import { supabase } from '@/lib/supabase'
import type { NovaRenovacaoInput, Renovacao } from '@/types'

export async function renovarEmprestimo(input: NovaRenovacaoInput) {
  const { data: emp, error: empErr } = await supabase
    .from('emprestimos')
    .select('cliente_id')
    .eq('id', input.emprestimo_id)
    .single()
  if (empErr) throw new Error(empErr.message)

  const { error } = await supabase.rpc('renovar_emprestimo', {
    p_emprestimo: input.emprestimo_id,
    p_juros_pago: input.juros_pago,
    p_capital_renovado: input.capital_renovado,
    p_novo_vencimento: input.novo_vencimento,
    p_juros_tipo: input.juros_tipo,
    p_juros_valor: input.juros_valor,
    p_juros_periodicidade: input.juros_periodicidade,
    p_observacao: input.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
  const clienteId = (emp as { cliente_id: string } | null)?.cliente_id
  if (clienteId) {
    void supabase.rpc('recalcular_score', { p_cliente: clienteId })
  }
}

export async function listarRenovacoes(emprestimoId: string): Promise<Renovacao[]> {
  const { data, error } = await supabase
    .from('renovacoes')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .order('data_renovacao', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Renovacao[]) ?? []
}

export async function listarRenovacoesDoCliente(clienteId: string): Promise<Renovacao[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data: emps } = await supabase
    .from('emprestimos')
    .select('id')
    .eq('cliente_id', clienteId)
  const ids = (emps ?? []).map((e) => (e as { id: string }).id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('renovacoes')
    .select('*')
    .eq('credor_id', user.id)
    .in('emprestimo_id', ids)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Renovacao[]) ?? []
}
