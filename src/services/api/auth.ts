import { supabase } from '@/lib/supabase'
import { normalizarWhatsApp, whatsappParaEmail } from '@/lib/phone'
import type { Profile } from '@/types'

function msgErro(mensagem: string | null): string {
  if (!mensagem) return 'Algo deu errado. Tente novamente.'
  const map: Record<string, string> = {
    'Invalid login credentials': 'WhatsApp ou senha incorretos.',
    'Email not confirmed': 'Conta ainda não confirmada. Verifique seu acesso.',
    'User already registered': 'Este WhatsApp já possui cadastro. Faça login.',
    'Password should be at least 6 characters':
      'A senha deve ter pelo menos 6 caracteres.',
    'For security purposes, you can only request this after 60 seconds.':
      'Aguarde um instante antes de tentar novamente.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde um instante.',
  }
  for (const [key, value] of Object.entries(map)) {
    if (mensagem.toLowerCase().includes(key.toLowerCase())) return value
  }
  return mensagem
}

export async function entrar(whatsapp: string, senha: string) {
  const email = whatsappParaEmail(normalizarWhatsApp(whatsapp))
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(msgErro(error.message))
  return data
}

export async function cadastrar(dados: {
  nome: string
  whatsapp: string
  senha: string
}) {
  const whatsappNormalizado = normalizarWhatsApp(dados.whatsapp)
  const email = whatsappParaEmail(whatsappNormalizado)
  const { data, error } = await supabase.auth.signUp({
    email,
    password: dados.senha,
    options: {
      data: {
        nome: dados.nome,
        whatsapp: dados.whatsapp,
        whatsapp_normalizado: whatsappNormalizado,
      },
    },
  })
  if (error) throw new Error(msgErro(error.message))
  return data
}

export async function recuperarSenha(whatsapp: string) {
  const email = whatsappParaEmail(normalizarWhatsApp(whatsapp))
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/atualizar-senha`,
  })
  if (error) throw new Error(msgErro(error.message))
  return data
}

export async function atualizarSenha(senha: string) {
  const { data, error } = await supabase.auth.updateUser({ password: senha })
  if (error) throw new Error(msgErro(error.message))
  return data
}

export async function sair() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(msgErro(error.message))
}

export async function obterPerfil(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  return (data as Profile | null) ?? null
}

export async function atualizarPerfil(dados: {
  nome: string
  whatsapp: string
  cpf_cnpj?: string | null
}) {
  const whatsappNormalizado = normalizarWhatsApp(dados.whatsapp)
  const { data, error } = await supabase
    .from('profiles')
    .update({
      nome: dados.nome,
      whatsapp: dados.whatsapp,
      whatsapp_normalizado: whatsappNormalizado,
      ...(dados.cpf_cnpj !== undefined ? { cpf_cnpj: dados.cpf_cnpj ?? null } : {}),
    })
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export function verificarWhatsappDuplicado(whatsappNormalizado: string): boolean {
  return whatsappNormalizado.length >= 10
}
