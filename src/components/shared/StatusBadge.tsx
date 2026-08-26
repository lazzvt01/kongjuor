import { Badge } from '@/components/ui/badge'
import { statusEmprestimoLabel, statusParcelaLabel } from '@/services/financial'
import type { StatusEmprestimo, StatusParcela } from '@/types'

const EMPRESTIMO_VARIANT: Record<StatusEmprestimo, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'muted'> = {
  ativo: 'secondary',
  em_dia: 'success',
  vence_hoje: 'warning',
  atrasado: 'destructive',
  quitado: 'muted',
  renovado: 'secondary',
}

const PARCELA_VARIANT: Record<StatusParcela, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'muted'> = {
  pendente: 'secondary',
  vence_hoje: 'warning',
  atrasado: 'destructive',
  parcial: 'warning',
  pago: 'success',
  quitado: 'muted',
}

export function StatusEmprestimoBadge({ status }: { status: StatusEmprestimo }) {
  return <Badge variant={EMPRESTIMO_VARIANT[status]}>{statusEmprestimoLabel(status)}</Badge>
}

export function StatusParcelaBadge({ status }: { status: StatusParcela }) {
  return <Badge variant={PARCELA_VARIANT[status]}>{statusParcelaLabel(status)}</Badge>
}
