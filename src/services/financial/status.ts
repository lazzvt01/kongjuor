import type { Emprestimo, Parcela, StatusEmprestimo, StatusParcela } from '@/types'
import { diasAtraso, hojeISO, venceHoje } from './datas'

export function atualizarStatus(emprestimo: Emprestimo): StatusEmprestimo {
  if (emprestimo.saldo_atual <= 0) return 'quitado'
  if (diasAtraso(emprestimo.data_vencimento) > 0) return 'atrasado'
  if (venceHoje(emprestimo.data_vencimento)) return 'vence_hoje'
  return 'em_dia'
}

export function atualizarStatusParcela(parcela: Parcela): StatusParcela {
  if (parcela.valor_pago >= parcela.valor_total) return 'pago'
  if (parcela.valor_pago > 0) return 'parcial'
  if (diasAtraso(parcela.data_vencimento) > 0) return 'atrasado'
  if (venceHoje(parcela.data_vencimento)) return 'vence_hoje'
  return 'pendente'
}

export function estaEmAtraso(emprestimo: Pick<Emprestimo, 'saldo_atual' | 'data_vencimento'>): boolean {
  if (emprestimo.saldo_atual <= 0) return false
  return diasAtraso(emprestimo.data_vencimento) > 0
}

export function diasAtrasoEmprestimo(emprestimo: Pick<Emprestimo, 'data_vencimento'>): number {
  return diasAtraso(emprestimo.data_vencimento)
}

export function atualizarStatusEmprestimos(emprestimos: Emprestimo[]): Emprestimo[] {
  return emprestimos.map((emp) => ({ ...emp, status: atualizarStatus(emp) }))
}

export function statusEmprestimoLabel(status: StatusEmprestimo): string {
  const labels: Record<StatusEmprestimo, string> = {
    ativo: 'Ativo',
    em_dia: 'Em dia',
    vence_hoje: 'Vence hoje',
    atrasado: 'Atrasado',
    quitado: 'Quitado',
    renovado: 'Renovado',
  }
  return labels[status]
}

export function statusParcelaLabel(status: StatusParcela): string {
  const labels: Record<StatusParcela, string> = {
    pendente: 'Pendente',
    vence_hoje: 'Vence hoje',
    atrasado: 'Atrasado',
    parcial: 'Parcial',
    pago: 'Pago',
    quitado: 'Quitado',
  }
  return labels[status]
}

export function statusHoje(emprestimo: Emprestimo): StatusEmprestimo {
  void hojeISO
  return atualizarStatus(emprestimo)
}
