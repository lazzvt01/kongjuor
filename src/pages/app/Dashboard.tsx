import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Wallet } from 'lucide-react'

import { CobrancaCard } from '@/components/shared/CobrancaCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useData } from '@/hooks/useData'
import { obterDashboard } from '@/services/api/dashboard'

export function Dashboard() {
  const navigate = useNavigate()
  const { data, loading } = useData(() => obterDashboard())

  const indicadores = data?.indicadores ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Início</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos seus empréstimos</p>
        </div>
      </div>

      {loading && (
        <Skeleton className="h-36 rounded-2xl bg-gradient-to-br from-primary to-primary/70" />
      )}

      {indicadores && (
        <>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg">
            <CardContent className="flex flex-col justify-between gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/90">
                <Wallet className="h-4 w-4" />
                Total emprestado
              </div>
              <p className="text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                <Money valor={indicadores.totalEmprestado} />
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-foreground/80">
                <span>{indicadores.emprestimosAtivos} empréstimos ativos</span>
                <span>{indicadores.totalClientes} clientes</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <IndicadorCard
              label="A receber hoje"
              valor={indicadores.aReceberHoje}
              highlight
              onClick={() => navigate('/receber')}
            />
            <IndicadorCard
              label="Juros previstos hoje"
              valor={indicadores.jurosPrevistoHoje}
              onClick={() => navigate('/receber')}
            />
            <IndicadorCard
              label="Em atraso"
              valor={indicadores.emAtraso}
              danger={indicadores.emAtraso > 0}
              onClick={() => navigate('/receber')}
            />
            <IndicadorCard
              label="Clientes"
              valor={indicadores.totalClientes}
              valorMoeda={false}
              onClick={() => navigate('/clientes')}
            />
            <IndicadorCard
              label="Empréstimos ativos"
              valor={indicadores.emprestimosAtivos}
              valorMoeda={false}
              onClick={() => navigate('/emprestimos')}
            />
          </div>
        </>
      )}

      {!loading && data && (data.aReceberHoje.length > 0 || data.atrasados.length > 0 || data.proximos.length > 0) && (
        <>
          {data.atrasados.length > 0 && (
            <Section title="Em atraso" count={data.atrasados.length}>
              {data.atrasados.map((c) => (
                <CobrancaCard
                  key={c.emprestimo.id}
                  emprestimo={c.emprestimo}
                  clienteNome={c.cliente?.nome ?? 'Cliente'}
                  valorPego={c.valorPego}
                  jurosDevido={c.jurosDevido}
                  jurosLabel={c.jurosLabel}
                    parcela={c.parcela ?? null}
                />
              ))}
            </Section>
          )}

          {data.aReceberHoje.length > 0 && (
            <Section title="Vence hoje" count={data.aReceberHoje.length}>
              {data.aReceberHoje.map((c) => (
                <CobrancaCard
                  key={c.emprestimo.id}
                  emprestimo={c.emprestimo}
                  clienteNome={c.cliente?.nome ?? 'Cliente'}
                  valorPego={c.valorPego}
                  jurosDevido={c.jurosDevido}
                  jurosLabel={c.jurosLabel}
                    parcela={c.parcela ?? null}
                />
              ))}
            </Section>
          )}

          {data.proximos.length > 0 && (
            <Section title="Próximos recebimentos" count={data.proximos.length}>
              {data.proximos.slice(0, 5).map((c) => (
                <CobrancaCard
                  key={c.emprestimo.id}
                  emprestimo={c.emprestimo}
                  clienteNome={c.cliente?.nome ?? 'Cliente'}
                  valorPego={c.valorPego}
                  jurosDevido={c.jurosDevido}
                  jurosLabel={c.jurosLabel}
                    parcela={c.parcela ?? null}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {!loading && data && data.aReceberHoje.length === 0 && data.atrasados.length === 0 && data.proximos.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Nada para receber"
          description="Você ainda não possui empréstimos com cobranças pendentes."
          actionLabel="Criar empréstimo"
          onAction={() => navigate('/emprestimos/novo')}
        />
      )}
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{count}</span>
        )}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function IndicadorCard({
  label,
  valor,
  valorMoeda = true,
  highlight,
  danger,
  onClick,
}: {
  label: string
  valor: number
  valorMoeda?: boolean
  highlight?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className={`h-full transition-colors ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
        <CardContent className="flex h-24 flex-col justify-between p-4">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={`text-lg font-bold leading-tight ${
              danger ? 'text-destructive' : highlight ? 'text-primary' : ''
            }`}
          >
            {valorMoeda ? <Money valor={valor} /> : valor}
          </p>
        </CardContent>
      </Card>
    </button>
  )
}

export function NovoEmprestimoFAB() {
  const navigate = useNavigate()
  return (
    <Button size="lg" className="w-full" onClick={() => navigate('/emprestimos/novo')}>
      <Plus className="h-5 w-5" />
      Novo empréstimo
    </Button>
  )
}
