export function normalizarWhatsApp(whatsapp: string): string {
  return whatsapp.replace(/\D/g, '')
}

export function whatsappParaEmail(whatsappNormalizado: string): string {
  return `${whatsappNormalizado}@juros.com`
}

export function emailParaWhatsapp(email: string): string | null {
  const match = email.match(/^(\d{10,13})@juros\.com$/)
  return match ? match[1] : null
}

export function validarWhatsApp(whatsapp: string): boolean {
  const normalizado = normalizarWhatsApp(whatsapp)
  return /^\d{10,13}$/.test(normalizado)
}

export function formatarWhatsAppMascara(whatsapp: string): string {
  const digitos = normalizarWhatsApp(whatsapp)
  if (digitos.length <= 11) {
    return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }
  return digitos.replace(/^(\d{2})(\d{5})(\d{4})(\d{1,4})$/, '($1) $2-$3')
}
