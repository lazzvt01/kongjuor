import { supabase } from '@/lib/supabase'
import type { NovoPagamentoInput, Pagamento } from '@/types'

export async function registrarPagamento(input: NovoPagamentoInput) {
  const { error } = await supabase.rpc('registrar_pagamento', {
    p_emprestimo: input.emprestimo_id,
    p_cliente: input.cliente_id,
    p_parcela: input.parcela_id ?? null,
    p_valor: input.valor,
    p_forma: input.forma_pagamento,
    p_data: input.data_pagamento,
    p_observacao: input.observacao?.trim() || null,
    p_operacao: input.operacao ?? 'padrao',
  })
  if (error) throw new Error(error.message)
  void supabase.rpc('recalcular_score', { p_cliente: input.cliente_id })
}

export async function listarPagamentos(emprestimoId: string): Promise<Pagamento[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .order('data_pagamento', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Pagamento[]) ?? []
}

export async function listarPagamentosDoCliente(clienteId: string): Promise<Pagamento[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data_pagamento', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Pagamento[]) ?? []
}
