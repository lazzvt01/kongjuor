import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CalendarClock,
  ChevronRight,
  HandCoins,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserRound,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusEmprestimoBadge, StatusParcelaBadge } from '@/components/shared/StatusBadge'
import { Timeline } from '@/components/shared/Timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmprestimoDetalhe } from '@/hooks/useEmprestimoDetalhe'
import { excluirEmprestimo } from '@/services/api/emprestimos'
import { formatarData } from '@/services/financial'
import { diasAtrasoEmprestimo } from '@/services/financial'
import { detalhesParcelado } from '@/services/financial'
import { jurosDoPeriodo, saldoDevedor } from '@/services/financial'
import { jurosRecebidos, numeroEmprestimo } from '@/services/financial'
import type { Emprestimo } from '@/types'

export function DetalheEmprestimo() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading } = useEmprestimoDetalhe(id)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Empréstimo" backTo="/emprestimos" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Empréstimo" backTo="/emprestimos" />
        <EmptyState icon={UserRound} title="Empréstimo não encontrado" actionHref="/emprestimos" actionLabel="Ver empréstimos" />
      </div>
    )
  }

  const { emprestimo, cliente } = data
  const saldoAberto = emprestimo.tipo === 'saldo_aberto'
  const valorPago = emprestimo.valor_total - emprestimo.saldo_atual
  const juros = Math.max(0, emprestimo.valor_total - emprestimo.valor_principal)
  const devedor = saldoDevedor(emprestimo)
  const jurosPeriodo = jurosDoPeriodo(emprestimo)
  const diasAtraso = diasAtrasoEmprestimo(emprestimo)
  const numero = numeroEmprestimo(emprestimo)
  const jurosRecebido = jurosRecebidos(emprestimo, data.pagamentos, data.parcelas, data.ciclos)
  const parceladoInfo = detalhesParcelado(emprestimo, data.parcelas)
  const parcelaAtual =
    data.parcelas.find((p) => p.saldo > 0) ?? data.parcelas[data.parcelas.length - 1]
  const parcelaVencimentoAtual = parcelaAtual?.data_vencimento ?? emprestimo.data_vencimento

  const handleExcluir = async () => {
    if (!id) return
    setExcluindo(true)
    try {
      await excluirEmprestimo(id)
      toast.success('Empréstimo excluído.')
      navigate('/emprestimos', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setExcluindo(false)
      setConfirmarExclusao(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${tipoLabel(emprestimo.tipo)}${numero ? ` · ${numero}` : ''}`}
        subtitle={cliente.nome}
        backTo="/emprestimos"
      />

      <button
        onClick={() => navigate(`/clientes/${cliente.id}`)}
        className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors active:bg-muted"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {cliente.nome.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{cliente.nome}</p>
          <p className="text-xs text-muted-foreground">{cliente.whatsapp || 'Ver perfil'}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {saldoAberto ? 'Total devido' : 'Saldo atual'}
              </p>
              <Money valor={emprestimo.saldo_atual} className="text-3xl font-bold text-primary" />
            </div>
            <StatusEmprestimoBadge status={emprestimo.status} />
          </div>
          {saldoAberto && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">Saldo devedor</p>
                <Money valor={devedor} className="font-semibold" />
              </div>
              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">Juros pendentes</p>
                <Money valor={jurosPeriodo} className="font-semibold" />
              </div>
            </div>
          )}
          {!saldoAberto && parceladoInfo.parcelaAtual && (
            <p className="mt-2 text-sm font-medium">
              Parcela {parceladoInfo.parcelaAtual} de {parceladoInfo.totalParcelas}
            </p>
          )}
          {diasAtraso > 0 && (
            <p className="mt-2 text-sm font-medium text-destructive">
              {diasAtraso} {diasAtraso === 1 ? 'dia atrasado' : 'dias atrasado'}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {saldoAberto ? (
              <>Vence {formatarData(emprestimo.data_vencimento)}</>
            ) : (
              <>Parcela atual vence {formatarData(parcelaVencimentoAtual)}</>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-center justify-between gap-3 p-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-success" />
              Juros recebidos (todos os ciclos)
            </p>
            <Money valor={jurosRecebido} className="mt-1 text-3xl font-bold text-success" />
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{data.pagamentos.length} pagamento{data.pagamentos.length === 1 ? '' : 's'}</p>
            {saldoAberto && (
              <p>{data.ciclos.length} ciclo{data.ciclos.length === 1 ? '' : 's'}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Detalhe label="Valor emprestado" valor={<Money valor={emprestimo.valor_principal} />} />
        {saldoAberto ? (
          <>
            <Detalhe label="Total a receber" valor={<Money valor={emprestimo.saldo_atual} />} />
            <Detalhe label="Ciclo atual" valor={String(emprestimo.ciclo_atual)} />
          </>
        ) : (
          <>
            <Detalhe
              label="Forma de juros"
              valor={emprestimo.forma_juros === 'periodico' ? 'Amortização' : 'Juros total'}
            />
            <Detalhe label="Juros" valor={<Money valor={juros} />} />
            <Detalhe label="Total" valor={<Money valor={emprestimo.valor_total} />} />
            <Detalhe label="Valor pago" valor={<Money valor={valorPago} />} />
            {parceladoInfo.parcelaAtual && (
              <Detalhe
                label="Parcela atual"
                valor={`${parceladoInfo.parcelaAtual} de ${parceladoInfo.totalParcelas}`}
              />
            )}
          </>
        )}
        <Detalhe label="Início" valor={formatarData(emprestimo.data_inicio)} />
        {!saldoAberto && emprestimo.ciclo_atual > 1 && (
          <Detalhe label="Ciclo atual" valor={String(emprestimo.ciclo_atual)} />
        )}
      </div>

      {emprestimo.deixou_garantia && emprestimo.garantia && (
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Garantia recebida
            </p>
            <p className="mt-1 text-sm">{emprestimo.garantia}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`/emprestimos/${emprestimo.id}/editar`)}
        >
          <Pencil className="h-5 w-5" />
          Editar
        </Button>
        <Button
          size="lg"
          variant="destructive"
          className="flex-1"
          onClick={() => setConfirmarExclusao(true)}
        >
          <Trash2 className="h-5 w-5" />
          Excluir
        </Button>
      </div>

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1"
          disabled={emprestimo.saldo_atual <= 0}
          onClick={() => navigate(`/emprestimos/${emprestimo.id}/pagamento`)}
        >
          <HandCoins className="h-5 w-5" />
          Registrar pagamento
        </Button>
        {saldoAberto && emprestimo.saldo_atual > 0 && (
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(`/emprestimos/${emprestimo.id}/renovar`)}
          >
            <RefreshCw className="h-5 w-5" />
            Renovar ciclo
          </Button>
        )}
      </div>

      {emprestimo.tipo === 'parcelado' && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            Parcelas ({data.parcelas.length})
          </h2>
          <Card>
            <CardContent className="p-2">
              {data.parcelas.map((parcela) => (
                <div
                  key={parcela.id}
                  onClick={() => navigate(`/emprestimos/${emprestimo.id}/pagamento?parcela=${parcela.id}`)}
                  className="group cursor-pointer rounded-lg px-3 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex w-full items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {parcela.numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{formatarData(parcela.data_vencimento)}</p>
                      <p className="text-xs text-muted-foreground">
                        Principal <Money valor={parcela.valor_principal} /> · Juros{' '}
                        <Money valor={parcela.valor_juros} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pago <Money valor={parcela.valor_pago} /> · Saldo <Money valor={parcela.saldo} />
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Money valor={parcela.valor_total} className="text-sm font-semibold" />
                      <StatusParcelaBadge status={parcela.status} />
                      {parcela.saldo > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 h-7 gap-1 px-2 text-[11px]"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/emprestimos/${emprestimo.id}/pagamento?parcela=${parcela.id}`)
                          }}
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          Receber
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {data.ciclos.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            Ciclos ({data.ciclos.length})
          </h2>
          <Card>
            <CardContent className="divide-y p-2">
              {data.ciclos.map((ciclo) => {
                const pendente = Math.max(0, ciclo.juros_devido - ciclo.juros_pago)
                return (
                  <div key={ciclo.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        Ciclo {ciclo.numero_ciclo}
                        {ciclo.juros_renegociado != null && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            renegociado
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatarData(ciclo.data_vencimento)}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p>
                        Juros <Money valor={ciclo.juros_devido} />
                        {ciclo.juros_renegociado != null && (
                          <>
                            {' '}
                            <span className="text-muted-foreground line-through">
                              <Money valor={ciclo.juros_calculado} />
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        Pago <Money valor={ciclo.juros_pago} />
                        {pendente > 0 && <> · Pendente <Money valor={pendente} /></>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Histórico do empréstimo</h2>
        <Card>
          <CardContent className="p-5">
            <Timeline
              emprestimos={[emprestimo]}
              pagamentos={data.pagamentos}
              ciclos={data.ciclos}
            />
          </CardContent>
        </Card>
      </section>

      <Dialog open={confirmarExclusao} onOpenChange={(open) => !open && setConfirmarExclusao(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir empréstimo?
            </DialogTitle>
            <DialogDescription>
              Esta ação apaga permanentemente o empréstimo, suas parcelas, ciclos, pagamentos e
              renovações. O histórico do cliente será recalculado. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={excluindo}
              onClick={() => setConfirmarExclusao(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={excluindo} onClick={handleExcluir}>
              {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detalhe({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-semibold">{valor}</p>
      </CardContent>
    </Card>
  )
}

function tipoLabel(tipo: Emprestimo['tipo']): string {
  const map: Record<Emprestimo['tipo'], string> = {
    parcelado: 'Empréstimo parcelado',
    saldo_aberto: 'Saldo aberto',
  }
  return map[tipo]
}
