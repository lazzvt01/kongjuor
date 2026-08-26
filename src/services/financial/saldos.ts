import type { Emprestimo } from '@/types'

export function saldoDevedor(
  emprestimo: Pick<Emprestimo, 'tipo' | 'saldo_atual' | 'saldo_devedor' | 'valor_principal'>,
): number {
  if (emprestimo.tipo === 'parcelado') return emprestimo.saldo_atual
  return emprestimo.saldo_devedor ?? emprestimo.valor_principal
}

export function principalAbatido(emprestimo: Pick<Emprestimo, 'valor_principal'> & { saldo_devedor: number | null }): number {
  if (emprestimo.saldo_devedor == null) return 0
  return Math.max(0, emprestimo.valor_principal - emprestimo.saldo_devedor)
}
