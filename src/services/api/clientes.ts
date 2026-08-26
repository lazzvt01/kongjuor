import { supabase } from '@/lib/supabase'
import { normalizarWhatsApp } from '@/lib/phone'
import type { AtualizarClienteInput, Cliente, NovoClienteInput } from '@/types'

export async function listarClientes(): Promise<Cliente[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('credor_id', user.id)
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Cliente[]) ?? []
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Cliente | null) ?? null
}

export async function criarCliente(input: NovoClienteInput): Promise<Cliente> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão expirada. Faça login novamente.')

  const whatsappNormalizado = input.whatsapp ? normalizarWhatsApp(input.whatsapp) : null
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      credor_id: user.id,
      nome: input.nome,
      whatsapp: input.whatsapp?.trim() || null,
      whatsapp_normalizado: whatsappNormalizado,
      cpf: input.cpf?.trim() || null,
      endereco: input.endereco?.trim() || null,
      cidade: input.cidade?.trim() || null,
      data_nascimento: input.data_nascimento || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}

export async function atualizarCliente(id: string, input: AtualizarClienteInput): Promise<Cliente> {
  const whatsappNormalizado = input.whatsapp ? normalizarWhatsApp(input.whatsapp) : null
  const { data, error } = await supabase
    .from('clientes')
    .update({
      nome: input.nome,
      whatsapp: input.whatsapp?.trim() || null,
      whatsapp_normalizado: whatsappNormalizado,
      cpf: input.cpf?.trim() || null,
      endereco: input.endereco?.trim() || null,
      cidade: input.cidade?.trim() || null,
      data_nascimento: input.data_nascimento || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}

export async function excluirCliente(id: string) {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
