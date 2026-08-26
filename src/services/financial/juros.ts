import type { JurosPeriodicidade, JurosTipo } from '@/types'
import { calcularJuros } from './engine'

export interface ResumoJuros {
  valorJuros: number
  valorTotal: number
}

export function resumoJuros(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
): ResumoJuros {
  const valorJuros = calcularJuros(valorPrincipal, jurosTipo, jurosValor)
  return { valorJuros, valorTotal: valorPrincipal + valorJuros }
}

export function calcularParcelaBase(
  valorTotal: number,
  quantidadeParcelas: number,
): { base: number; primeira: number; quantidadePrimeiras: number } {
  const base = Math.floor(valorTotal / quantidadeParcelas)
  const resto = valorTotal - base * quantidadeParcelas
  return { base, primeira: base + 1, quantidadePrimeiras: resto }
}

export const PERIODICIDADE_LABEL: Record<JurosPeriodicidade, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

export const JUROS_TIPO_LABEL: Record<JurosTipo, string> = {
  percentual: 'Percentual',
  fixo: 'Valor fixo',
}

export function formatarTaxaPercentual(jurosValor: number): string {
  const taxa = jurosValor / 100
  const texto = Number.isInteger(taxa)
    ? taxa.toFixed(0)
    : taxa.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return texto.replace('.', ',')
}

export const PERIODICIDADE_CURTA: Record<JurosPeriodicidade, string> = {
  diario: 'a.d.',
  semanal: 'a.s.',
  mensal: 'a.m.',
}
