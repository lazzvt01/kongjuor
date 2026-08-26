import { useNavigate, useParams } from 'react-router-dom'
import { Banknote, HandCoins, Pencil, Phone, Plus, UserRound } from 'lucide-react'

import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusEmprestimoBadge } from '@/components/shared/StatusBadge'
import { Timeline } from '@/components/shared/Timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientePerfil } from '@/hooks/useClientePerfil'
import { detalhesJuros, detalhesParcelado, formatarData, numeroEmprestimo } from '@/services/financial'
import type { Emprestimo } from '@/types'

export function PerfilCliente() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading } = useClientePerfil(id)

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Perfil" backTo="/clientes" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Perfil" backTo="/clientes" />
        <EmptyState
          icon={UserRound}
          title="Cliente não encontrado"
          actionLabel="Ver clientes"
          actionHref="/clientes"
        />
      </div>
    )
  }

  const { cliente, resumo } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title={cliente.nome}
        backTo="/clientes"
        action={
          <Button variant="outline" size="icon" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                {cliente.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold">{cliente.nome}</p>
                {cliente.whatsapp && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {cliente.whatsapp}
                  </p>
                )}
              </div>
            </div>
            <ScoreBadge score={resumo.score} classificacao={resumo.classificacao} />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <MiniStat label="Em aberto" value={<Money valor={resumo.totalEmAberto} />} />
            <MiniStat label="Empréstimos ativos" value={resumo.emprestimosAtivos} />
            <MiniStat label="Em atraso" value={resumo.atrasados} danger={resumo.atrasados > 0} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center border-t pt-4">
            <MiniStat label="Total emprestado" value={<Money valor={resumo.totalEmprestado} />} />
            <MiniStat label="Total pago" value={<Money valor={resumo.totalPago} />} />
            <MiniStat label="Juros recebidos" value={<Money valor={resumo.jurosRecebidos} />} />
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={() => navigate(`/emprestimos/novo/definir?cliente=${cliente.id}`)}>
        <Plus className="h-5 w-5" />
        Novo empréstimo
      </Button>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Empréstimos</h2>
        {data.emprestimos.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Nenhum empréstimo"
            description="Este cliente ainda não possui empréstimos."
          />
        ) : (
          <div className="space-y-2">
            {data.emprestimos.map((emp) => {
              const parcelasDoEmp = data.parcelas.filter((p) => p.emprestimo_id === emp.id)
              const { valorPego, juros, jurosLabel } = detalhesJuros(emp)
              const parcelado = emp.tipo === 'parcelado'
              const detalhes = parcelado ? detalhesParcelado(emp, parcelasDoEmp) : null
              return (
                <div
                  key={emp.id}
                  className="rounded-xl border bg-card p-3.5"
                >
                  <button
                    onClick={() => navigate(`/emprestimos/${emp.id}`)}
                    className="flex w-full items-center gap-3 text-left transition-colors active:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {tipoLabel(emp.tipo)}
                          {parcelado && detalhes && ` · ${detalhes.totalParcelas} parcelas`}
                        </p>
                        {numeroEmprestimo(emp) && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {numeroEmprestimo(emp)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {parcelado && detalhes?.parcelaAtual
                          ? `Parcela ${detalhes.parcelaAtual} de ${detalhes.totalParcelas} · `
                          : ''}
                        vence {formatarData(emp.data_vencimento)}
                      </p>
                      {parcelado && detalhes && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {detalhes.formaJuros === 'periodico'
                            ? 'Juros por amortização'
                            : detalhes.formaJuros === 'total'
                              ? 'Juros total'
                              : 'Saldo aberto'}{' '}
                          · {detalhes.jurosLabel}
                        </p>
                      )}
                      <div className="mt-1">
                        <StatusEmprestimoBadge status={emp.status} />
                      </div>
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Valor pego</p>
                        <Money valor={parcelado ? emp.valor_principal : valorPego} className="text-sm font-semibold" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Juros {jurosLabel}</p>
                        <Money valor={juros} className="text-sm font-semibold text-primary" />
                      </div>
                    </div>
                  </button>
                  {emp.saldo_atual > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => navigate(`/emprestimos/${emp.id}/pagamento`)}
                    >
                      <HandCoins className="h-4 w-4" />
                      Receber pagamento
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Histórico</h2>
        <Card>
          <CardContent className="p-5">
            <Timeline
              emprestimos={data.emprestimos}
              pagamentos={data.pagamentos}
              ciclos={data.ciclos}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MiniStat({
  label,
  value,
  danger,
}: {
  label: string
  value: React.ReactNode
  danger?: boolean
}) {
  return (
    <div>
      <p className={`text-sm font-bold ${danger ? 'text-destructive' : ''}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function tipoLabel(tipo: Emprestimo['tipo']): string {
  const map: Record<Emprestimo['tipo'], string> = {
    parcelado: 'Parcelado',
    saldo_aberto: 'Saldo aberto',
  }
  return map[tipo]
}
