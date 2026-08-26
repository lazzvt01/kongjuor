import { cn } from '@/lib/utils'
import { SCORE_CLASSIFICACAO_LABEL, classificarScore } from '@/services/financial'
import type { ScoreClassificacao } from '@/types'

export function ScoreBadge({
  score,
  classificacao,
}: {
  score?: number
  classificacao?: ScoreClassificacao
}) {
  const classe = classificacao ?? (score != null && score > 0 ? classificarScore(score) : null)
  if (!classe) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        Sem score
      </span>
    )
  }
  const color = colorPorClassificacao(classe)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        color,
      )}
      title={score != null && score > 0 ? `${score} pontos` : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {SCORE_CLASSIFICACAO_LABEL[classe]}
    </span>
  )
}

function colorPorClassificacao(c: ScoreClassificacao): string {
  switch (c) {
    case 'excelente':
      return 'bg-success/15 text-success'
    case 'bom':
      return 'bg-primary/15 text-primary'
    case 'regular':
      return 'bg-warning/15 text-warning'
    case 'ruim':
      return 'bg-destructive/15 text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
