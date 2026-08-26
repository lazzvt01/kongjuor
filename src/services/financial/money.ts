const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarMoeda(valorCentavos: number): string {
  return formatter.format(valorCentavos / 100)
}

export function formatarMoedaCompacta(valorCentavos: number): string {
  const reais = valorCentavos / 100
  if (Math.abs(reais) >= 1000000) {
    return `R$ ${(reais / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (Math.abs(reais) >= 1000) {
    return `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return formatter.format(reais)
}

export function arredondarCentavos(valor: number): number {
  return Math.round(valor)
}

export function moedaParaCentavos(texto: string): number {
  const limpo = texto
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(limpo)
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

export function centavosParaTexto(valorCentavos: number): string {
  const reais = Math.floor(valorCentavos / 100)
  const centavos = Math.abs(valorCentavos % 100)
  const inteiro = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiro},${String(centavos).padStart(2, '0')}`
}
