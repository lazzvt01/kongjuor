import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, CalendarDays, Plus, Search, Wallet } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { StatusEmprestimoBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useEmprestimosComCliente, type EmprestimoComCliente } from '@/hooks/useEmprestimosComCliente'
import {
  detalhesParcelado,
  formatarData,
  formatarMoeda,
  formatarTaxaPercentual,
  numeroEmprestimo,
  PERIODICIDADE_CURTA,
} from '@/services/financial'
import type { Emprestimo, StatusEmprestimo } from '@/types'

const FILTROS: { valor: 'todos' | StatusEmprestimo; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'ativo', label: 'Ativos' },
  { valor: 'em_dia', label: 'Em dia' },
  { valor: 'vence_hoje', label: 'Vencendo hoje' },
  { valor: 'atrasado', label: 'Atrasados' },
  { valor: 'quitado', label: 'Quitados' },
  { valor: 'renovado', label: 'Renovados' },
]

function correspondeAoFiltro(emprestimo: Emprestimo, filtro: 'todos' | StatusEmprestimo): boolean {
  switch (filtro) {
    case 'todos':
      return true
    case 'ativo':
      return emprestimo.saldo_atual > 0
    case 'renovado':
      return emprestimo.ciclo_atual > 1
    default:
      return emprestimo.status === filtro
  }
}

export function Emprestimos() {
  const navigate = useNavigate()
  const { items, loading, error } = useEmprestimosComCliente()
  const [filtro, setFiltro] = useState<'todos' | StatusEmprestimo>('todos')
  const [busca, setBusca] = useState('')

  const filtrados = items.filter((e) => {
    if (!correspondeAoFiltro(e, filtro)) return false
    const q = busca.trim().toLowerCase()
    if (!q) return true
    return (e.cliente?.nome ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empréstimos"
        subtitle="Acompanhe seus empréstimos"
        action={
          <Button onClick={() => navigate('/emprestimos/novo')}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente"
          className="pl-9"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filtro === f.valor
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-muted-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && filtrados.length === 0 && (
        <EmptyState
          icon={Banknote}
          title="Nenhum empréstimo encontrado"
          description="Crie um empréstimo para começar."
          actionLabel="Novo empréstimo"
          onAction={() => navigate('/emprestimos/novo')}
        />
      )}

      {!loading && filtrados.length > 0 && (
        <div className="space-y-3">
          {filtrados.map((emp) => (
            <EmprestimoCard key={emp.id} emprestimo={emp} onClick={() => navigate(`/emprestimos/${emp.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmprestimoCard({
  emprestimo,
  onClick,
}: {
  emprestimo: EmprestimoComCliente
  onClick: () => void
}) {
  const juros = Math.max(0, emprestimo.valor_total - emprestimo.valor_principal)
  const parcelado = emprestimo.tipo === 'parcelado'
  const detalhes = parcelado ? detalhesParcelado(emprestimo, emprestimo.parcelas) : null
  const taxa =
    emprestimo.juros_tipo === 'percentual'
      ? `${formatarTaxaPercentual(emprestimo.juros_valor)}% ${PERIODICIDADE_CURTA[emprestimo.juros_periodicidade]}`
      : `${formatarMoeda(juros)} fixo`

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors active:bg-muted"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(emprestimo.cliente?.nome ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{emprestimo.cliente?.nome ?? 'Cliente'}</p>
              {numeroEmprestimo(emprestimo) && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {numeroEmprestimo(emprestimo)}
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {tipoLabel(emprestimo.tipo)}
              {parcelado && detalhes ? ` · ${detalhes.totalParcelas} parcelas` : ''} · Emprestado em{' '}
              {formatarData(emprestimo.data_inicio)}
            </p>
          </div>
        </div>
        <ScoreBadge score={emprestimo.score} classificacao={emprestimo.classificacao} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CardStat label="Valor pego" value={<Money valor={emprestimo.valor_principal} />} />
        <CardStat label="Juros" value={taxa} />
        <CardStat label="Próximo vencimento" value={formatarData(emprestimo.data_vencimento)} />
        <CardStat label="A receber" value={<Money valor={emprestimo.saldo_atual} />} strong />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
        <StatusEmprestimoBadge status={emprestimo.status} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet className="h-3 w-3" />
          {parcelado && detalhes?.parcelaAtual
            ? `Parcela ${detalhes.parcelaAtual} de ${detalhes.totalParcelas}`
            : emprestimo.ciclo_atual > 1
              ? `${emprestimo.ciclo_atual}º ciclo`
              : '1º ciclo'}
        </span>
      </div>
    </button>
  )
}

function CardStat({
  label,
  value,
  strong,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-semibold', strong && 'text-primary')}>{value}</p>
    </div>
  )
}

function tipoLabel(tipo: Emprestimo['tipo']): string {
  const map = {
    parcelado: 'Parcelado',
    saldo_aberto: 'Saldo aberto',
  } as const
  return map[tipo]
}
