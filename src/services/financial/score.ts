import type { ScoreClassificacao } from '@/types'

export interface ResumoScore {
  totalEmprestimos: number
  emprestimosQuitados: number
  pagamentosEmDia: number
  pagamentosAntecipados: number
  pagamentosAtrasados: number
  atrasosAtuais: number
  diasAtrasoMaximo: number
  emprestimosAtivos: number
}

export interface ResultadoScore {
  score: number
  classificacao: ScoreClassificacao
}

export const SCORE_CLASSIFICACAO_LABEL: Record<ScoreClassificacao, string> = {
  excelente: 'Excelente',
  bom: 'Bom',
  regular: 'Regular',
  ruim: 'Ruim',
}

const CLASSIFICACAO_SCORE: Record<ScoreClassificacao, number> = {
  excelente: 900,
  bom: 700,
  regular: 500,
  ruim: 250,
}

function classificarQualitativamente(resumo: ResumoScore): ScoreClassificacao {
  const totalPagamentos =
    resumo.pagamentosEmDia + resumo.pagamentosAntecipados + resumo.pagamentosAtrasados

  // Sem histórico: novo cliente (sem pagamentos e sem atraso atual).
  if (resumo.totalEmprestimos === 0 || (totalPagamentos === 0 && resumo.atrasosAtuais === 0)) {
    return 'regular'
  }

  // Nunca atrasou: paga no vencimento ou antes, e nada em atraso hoje.
  if (resumo.pagamentosAtrasados === 0 && resumo.atrasosAtuais === 0) {
    return 'excelente'
  }

  // Sempre atrasa ou atrasa muitos dias.
  const taxaAtraso = totalPagamentos > 0 ? resumo.pagamentosAtrasados / totalPagamentos : 1
  const atrasoGrave = resumo.diasAtrasoMaximo > 30
  const maioriaAtrasada = taxaAtraso >= 0.5
  if (maioriaAtrasada || atrasoGrave) {
    return 'ruim'
  }

  return 'bom'
}

export function calcularScore(resumo: ResumoScore): ResultadoScore {
  const classificacao = classificarQualitativamente(resumo)
  return { score: CLASSIFICACAO_SCORE[classificacao], classificacao }
}

export function classificarScore(score: number): ScoreClassificacao {
  if (score >= 800) return 'excelente'
  if (score >= 600) return 'bom'
  if (score >= 450) return 'regular'
  return 'ruim'
}

export function scoreColor(score: number): string {
  const cor: Record<ScoreClassificacao, string> = {
    excelente: 'text-success',
    bom: 'text-primary',
    regular: 'text-warning',
    ruim: 'text-destructive',
  }
  return cor[classificarScore(score)]
}
