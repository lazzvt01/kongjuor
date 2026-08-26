export function formatarMoedaBR(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarDataBR(data: string | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR')
}

export function formatarDataCurtaBR(data: string | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
