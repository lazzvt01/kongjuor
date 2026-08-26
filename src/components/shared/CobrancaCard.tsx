import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { Money } from '@/components/shared/Money'
import {
  diasAtrasoEmprestimo,
  formatarData,
  numeroEmprestimo,
} from '@/services/financial'
import type { Emprestimo, Parcela } from '@/types'

interface CobrancaItemProps {
  emprestimo: Emprestimo
  clienteNome: string
  valorPego: number
  jurosDevido: number
  jurosLabel: string
  parcela?: Parcela | null
}

export function CobrancaCard({
  emprestimo,
  clienteNome,
  valorPego,
  jurosDevido,
  jurosLabel,
  parcela,
}: CobrancaItemProps) {
  const navigate = useNavigate()
  const dias = diasAtrasoEmprestimo(emprestimo)
  const numero = numeroEmprestimo(emprestimo)
  const inicial = (clienteNome.trim().charAt(0) || '?').toUpperCase()

  return (
    <button
      onClick={() => navigate(`/emprestimos/${emprestimo.id}`)}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors active:bg-muted"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
        {inicial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{clienteNome}</p>
          {numero && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {numero}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {tipoLabel(emprestimo.tipo)}
          {parcela && emprestimo.quantidade_parcelas
            ? ` · Parcela ${parcela.numero} de ${emprestimo.quantidade_parcelas}`
            : ''}
        </p>
        <p className="mt-0.5 truncate text-xs">
          {dias > 0 ? (
            <span className="font-medium text-destructive">
              {dias} {dias === 1 ? 'dia atrasado' : 'dias atrasado'}
            </span>
          ) : dias === 0 ? (
            <span className="font-medium text-warning">vence hoje</span>
          ) : (
            <>vence {formatarData(emprestimo.data_vencimento)}</>
          )}
        </p>
      </div>
      <div className="shrink-0 space-y-1 text-right">
        <div>
          <p className="text-[11px] text-muted-foreground">Valor pego</p>
          <Money valor={valorPego} className="text-sm font-semibold" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Juros {jurosLabel}</p>
          <Money valor={jurosDevido} className="text-sm font-semibold text-primary" />
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

function tipoLabel(tipo: Emprestimo['tipo']): string {
  const map = {
    parcelado: 'Parcelado',
    saldo_aberto: 'Saldo aberto',
  } as const
  return map[tipo]
}
