import { addDays, addMonths, addWeeks, differenceInCalendarDays, isSameDay, parseISO } from 'date-fns'

import type { JurosPeriodicidade } from '@/types'

export function hojeISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function proximaDataPeriodica(data: string, periodicidade: JurosPeriodicidade, intervalo = 1): string {
  const base = parseISO(data)
  if (periodicidade === 'diario') return formatDate(addDays(base, intervalo))
  if (periodicidade === 'semanal') return formatDate(addWeeks(base, intervalo))
  return formatDate(addMonths(base, intervalo))
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diasAtraso(vencimento: string, referencia?: string): number {
  const ref = referencia ?? hojeISO()
  return differenceInCalendarDays(parseISO(ref), parseISO(vencimento))
}

export function diasAteVencimento(vencimento: string, referencia?: string): number {
  return -diasAtraso(vencimento, referencia)
}

export function venceHoje(data: string, referencia?: string): boolean {
  const ref = referencia ?? hojeISO()
  return isSameDay(parseISO(data), parseISO(ref))
}

export function formatarData(data: string): string {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseISO(data))
}

export function formatarDataCurta(data: string): string {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(parseISO(data))
}
