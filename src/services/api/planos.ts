import { supabase } from '@/lib/supabase'
import type { Assinatura, CheckoutResult, CodigoPlano, Plano, ResumoPlano } from '@/types'

export async function listarPlanos(): Promise<Plano[]> {
  const { data, error } = await supabase
    .from('planos')
    .select('*')
    .eq('ativo', true)
    .order('preco_mensal', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Plano[]) ?? []
}

export async function obterResumoPlano(): Promise<ResumoPlano | null> {
  const { data, error } = await supabase.rpc('resumo_plano')
  if (error) throw new Error(error.message)
  return (data as ResumoPlano | null) ?? null
}

export async function obterAssinatura(): Promise<Assinatura | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('credor_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Assinatura | null) ?? null
}

export async function assinarPlano(
  plano: CodigoPlano,
  acao: 'assinar' | 'cancelar',
  cpfCnpj?: string,
): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('asaas-checkout', {
    body: { plano, acao, ...(cpfCnpj ? { cpfCnpj } : {}) },
  })
  if (error) throw new Error(error.message)
  return (data as CheckoutResult) ?? { ok: false, error: 'Resposta vazia da Edge Function' }
}

export function formatarPrecoPlano(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
