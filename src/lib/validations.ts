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

export function validarCpfCnpj(valor: string): string | null {
  const limpo = valor.replace(/\D/g, '')
  if (!limpo) return 'Informe o CPF ou CNPJ.'
  if (limpo.length === 11) {
    if (!validarCpf(limpo)) return 'CPF inválido.'
    return null
  }
  if (limpo.length === 14) {
    if (!validarCnpj(limpo)) return 'CNPJ inválido.'
    return null
  }
  return 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.'
}

function validarCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  for (let j = 9; j <= 10; j++) {
    let soma = 0
    for (let i = 0; i < j; i++) soma += Number(cpf[i]) * (j + 1 - i)
    const digito = ((soma * 10) % 11) % 10
    if (digito !== Number(cpf[j])) return false
  }
  return true
}

function validarCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma1 = 0
  for (let i = 0; i < 12; i++) soma1 += Number(cnpj[i]) * pesos1[i]
  const d1 = soma1 % 11 < 2 ? 0 : 11 - (soma1 % 11)
  if (d1 !== Number(cnpj[12])) return false
  let soma2 = 0
  for (let i = 0; i < 13; i++) soma2 += Number(cnpj[i]) * pesos2[i]
  const d2 = soma2 % 11 < 2 ? 0 : 11 - (soma2 % 11)
  if (d2 !== Number(cnpj[13])) return false
  return true
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
