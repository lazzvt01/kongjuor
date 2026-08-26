import { useNavigate } from 'react-router-dom'
import { HandCoins, Wallet } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useData } from '@/hooks/useData'
import { obterDashboard, type Cobranca } from '@/services/api/dashboard'
import { formatarData, numeroEmprestimo } from '@/services/financial'
import type { Emprestimo } from '@/types'

export function Receber() {
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useData(() => obterDashboard())

  return (
    <div className="space-y-4">
      <PageHeader title="Receber" subtitle="Cobranças organizadas por situação" />

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-destructive">Não foi possível carregar as cobranças: {error}</p>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && data && (
        <Tabs defaultValue="hoje">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hoje">Hoje ({data.aReceberHoje.length})</TabsTrigger>
            <TabsTrigger value="atrasados">Atrasados ({data.atrasados.length})</TabsTrigger>
            <TabsTrigger value="proximos">Próximos ({data.proximos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="hoje" className="space-y-2">
            <ResumoLinha label="A receber hoje" valor={data.indicadores.aReceberHoje} />
            {data.aReceberHoje.length === 0 ? (
              <Vazio titulo="Nada vence hoje" />
            ) : (
              data.aReceberHoje.map((c) => (
                <CobrancaRow key={c.emprestimo.id} cobranca={c} navigate={navigate} />
              ))
            )}
          </TabsContent>

          <TabsContent value="atrasados" className="space-y-2">
            <ResumoLinha label="Total em atraso" valor={data.indicadores.emAtraso} danger />
            {data.atrasados.length === 0 ? (
              <Vazio titulo="Nenhum atraso. Tudo em dia!" />
            ) : (
              data.atrasados.map((c) => (
                <CobrancaRow key={c.emprestimo.id} cobranca={c} navigate={navigate} atrasado />
              ))
            )}
          </TabsContent>

          <TabsContent value="proximos" className="space-y-2">
            {data.proximos.length === 0 ? (
              <Vazio titulo="Nenhum recebimento futuro" />
            ) : (
              data.proximos.map((c) => (
                <CobrancaRow key={c.emprestimo.id} cobranca={c} navigate={navigate} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function ResumoLinha({ label, valor, danger }: { label: string; valor: number; danger?: boolean }) {
  return (
    <Card className={danger && valor > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Money
          valor={valor}
          className={`text-lg font-bold ${danger && valor > 0 ? 'text-destructive' : ''}`}
        />
      </CardContent>
    </Card>
  )
}

function Vazio({ titulo }: { titulo: string }) {
  return (
    <EmptyState icon={Wallet} title={titulo} description="Nenhuma cobrança nesta categoria." />
  )
}

function CobrancaRow({
  cobranca,
  navigate,
  atrasado,
}: {
  cobranca: Cobranca
  navigate: (to: string) => void
  atrasado?: boolean
}) {
  const { emprestimo, cliente, parcela } = cobranca
  const nome = cliente?.nome ?? 'Cliente'
  const numero = numeroEmprestimo(emprestimo)
  const inicial = (nome.trim().charAt(0) || '?').toUpperCase()
  const vencimentoInfo = atrasado
    ? `${cobranca.diasAtraso} ${cobranca.diasAtraso === 1 ? 'dia' : 'dias'} atrasado`
    : cobranca.diasAtraso === 0
      ? 'Vence hoje'
      : `Vence ${formatarData(cobranca.dataVencimento)}`

  return (
    <Card className={cn('overflow-hidden', atrasado && 'border-destructive/40')}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
            {inicial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{nome}</p>
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
                : ''}{' '}
              · {cobranca.jurosLabel}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="space-y-0.5">
              <div>
                <p className="text-[11px] text-muted-foreground">Valor pego</p>
                <Money valor={cobranca.valorPego} className="text-sm font-semibold" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Juros {cobranca.jurosLabel}</p>
                <Money valor={cobranca.jurosDevido} className="text-sm font-semibold text-primary" />
              </div>
            </div>
            <p
              className={cn(
                'mt-1 text-[11px] font-medium',
                atrasado
                  ? 'text-destructive'
                  : cobranca.diasAtraso === 0
                    ? 'text-warning'
                    : 'text-muted-foreground',
              )}
            >
              {vencimentoInfo}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() =>
            navigate(
              parcela
                ? `/emprestimos/${emprestimo.id}/pagamento?parcela=${parcela.id}`
                : `/emprestimos/${emprestimo.id}/pagamento`,
            )
          }
        >
          <HandCoins className="h-4 w-4" />
          Registrar recebimento
        </Button>
      </CardContent>
    </Card>
  )
}

function tipoLabel(tipo: Emprestimo['tipo']): string {
  const map = {
    parcelado: 'Parcelado',
    saldo_aberto: 'Saldo aberto',
  } as const
  return map[tipo]
}
