import { normalizarWhatsApp, validarWhatsApp } from './phone'

export function validarNome(nome: string): string | null {
  if (!nome.trim()) return 'Informe o nome.'
  if (nome.trim().length < 2) return 'Nome muito curto.'
  return null
}

export function validarWhatsappCampo(whatsapp: string): string | null {
  const normalizado = normalizarWhatsApp(whatsapp)
  if (!normalizado) return null
  if (!validarWhatsApp(normalizado)) return 'WhatsApp inválido. Use DDD + número.'
  return null
}

export function validarSenha(senha: string): string | null {
  if (!senha) return 'Informe a senha.'
  if (senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
  return null
}

export function validarRepetirSenha(senha: string, repetir: string): string | null {
  if (!repetir) return 'Repita a senha.'
  if (senha !== repetir) return 'As senhas não coincidem.'
  return null
}

export function validarValor(centavos: number): string | null {
  if (centavos <= 0) return 'Informe um valor maior que zero.'
  return null
}

export function validarData(data: string): string | null {
  if (!data) return 'Informe a data.'
  return null
}

export function validarQuantidadeParcelas(qtd: number): string | null {
  if (!qtd || qtd < 1) return 'Informe a quantidade de parcelas.'
  if (qtd > 360) return 'Máximo de 360 parcelas.'
  return null
}

export function validarJuros(valor: number, tipo: 'percentual' | 'fixo'): string | null {
  if (valor < 0) return 'Juros não podem ser negativos.'
  if (tipo === 'percentual' && valor > 10000) return 'Percentual máximo de 100%.'
  return null
}
