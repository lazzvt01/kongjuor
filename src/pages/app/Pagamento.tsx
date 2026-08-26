import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, HandCoins, Repeat2 } from 'lucide-react'
import { toast } from 'sonner'

import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { Field } from '@/components/shared/Field'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useEmprestimoDetalhe } from '@/hooks/useEmprestimoDetalhe'
import { hojeISO, saldoDevedor } from '@/services/financial'
import { formatarMoeda } from '@/services/financial/money'
import { proximaDataPeriodica } from '@/services/financial/datas'
import { distribuirPagamento } from '@/services/financial/distribuicao'
import { registrarPagamento } from '@/services/api/pagamentos'
import type { FormaPagamento, OperacaoPagamento } from '@/types'

const FORMAS: { valor: FormaPagamento; label: string }[] = [
  { valor: 'pix', label: 'Pix' },
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'transferencia', label: 'Transferência' },
  { valor: 'outro', label: 'Outro' },
]

const OPERACOES: {
  valor: OperacaoPagamento
  label: string
  descricao: string
  icone: React.ElementType
}[] = [
  {
    valor: 'juros',
    label: 'Pagamento de juros',
    descricao: 'Paga todos os juros pendentes, encerra o ciclo atual e gera o próximo',
    icone: Repeat2,
  },
  {
    valor: 'padrao',
    label: 'Pagamento parcial',
    descricao: 'Distribuído primeiro nos juros e depois no saldo devedor',
    icone: HandCoins,
  },
  {
    valor: 'quitar',
    label: 'Quitar contrato',
    descricao: 'Encerra o empréstimo pagando 100%',
    icone: BadgeCheck,
  },
]

const MODOS_PARCELADO: { valor: 'total' | 'parcela'; label: string; descricao: string }[] = [
  {
    valor: 'total',
    label: 'Pagar total',
    descricao: 'Quita o saldo restante, distribuindo nas parcelas em aberto',
  },
  {
    valor: 'parcela',
    label: 'Pagar parcela',
    descricao: 'Aplica o valor em uma parcela específica',
  },
]

function formatarDataISO(data: string): string {
  if (!data) return '—'
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

function tipoLabel(tipo: 'parcelado' | 'saldo_aberto'): string {
  const map = {
    parcelado: 'Empréstimo parcelado',
    saldo_aberto: 'Saldo aberto',
  } as const
  return map[tipo]
}

export function Pagamento() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, loading } = useEmprestimoDetalhe(id)

  const parcelaSelecionadaId = params.get('parcela')

  const [valor, setValor] = useState(0)
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [dataPagamento, setDataPagamento] = useState(hojeISO())
  const [observacao, setObservacao] = useState('')
  const [operacao, setOperacao] = useState<OperacaoPagamento>('padrao')
  const [modoParcelado, setModoParcelado] = useState<'total' | 'parcela'>(
    parcelaSelecionadaId ? 'parcela' : 'total',
  )
  const [parcelaId, setParcelaId] = useState<string>(parcelaSelecionadaId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  const parcelaSelecionada = useMemo(() => {
    if (!parcelaId || !data) return null
    return data.parcelas.find((p) => p.id === parcelaId) ?? null
  }, [parcelaId, data])

  const saldoAberto = data?.emprestimo.tipo === 'saldo_aberto'

  const jurosPendentes = useMemo(() => {
    if (!saldoAberto || !data) return 0
    return data.ciclos.reduce((acc, c) => acc + Math.max(0, c.juros_devido - c.juros_pago), 0)
  }, [saldoAberto, data])

  const devedor = data ? saldoDevedor(data.emprestimo) : 0

  const jurosDisponivel = saldoAberto && jurosPendentes > 0 && devedor > 0

  const novoVencimento = useMemo(() => {
    if (!data || !saldoAberto || operacao !== 'juros') return null
    return proximaDataPeriodica(dataPagamento, data.emprestimo.juros_periodicidade, data.emprestimo.intervalo)
  }, [data, saldoAberto, operacao, dataPagamento])

  const preview = useMemo(() => {
    if (!data || !saldoAberto || valor <= 0) return null
    const r = distribuirPagamento(valor, jurosPendentes, 0, devedor)
    return {
      jurosPago: r.jurosAnterioresPago + r.jurosAtualPago,
      principalAbatido: r.principalAbatido,
      novoDevedor: Math.max(0, devedor - r.principalAbatido),
      novoTotalDevido:
        Math.max(0, devedor - r.principalAbatido) +
        Math.max(0, jurosPendentes - r.jurosAnterioresPago - r.jurosAtualPago),
    }
  }, [data, saldoAberto, valor, jurosPendentes, devedor])

  useEffect(() => {
    if (!data) return
    if (saldoAberto) {
      if (operacao === 'juros') {
        setValor(jurosPendentes)
        return
      }
      if (data.emprestimo.saldo_atual > 0) setValor(data.emprestimo.saldo_atual)
      return
    }
    // parcelado
    if (modoParcelado === 'parcela') {
      const parcela = data.parcelas.find((p) => p.id === parcelaId)
      if (parcela) {
        setValor(parcela.saldo)
        return
      }
    }
    if (data.emprestimo.saldo_atual > 0) setValor(data.emprestimo.saldo_atual)
  }, [parcelaSelecionada, data, saldoAberto, operacao, jurosPendentes, modoParcelado, parcelaId])

  const handleOperacaoChange = (op: OperacaoPagamento) => {
    setOperacao(op)
    if (!data) return
    if (op === 'juros') setValor(jurosPendentes)
    else if (data.emprestimo.saldo_atual > 0) setValor(data.emprestimo.saldo_atual)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Registrar pagamento" backTo="/emprestimos" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Registrar pagamento" backTo="/emprestimos" />
        <EmptyState icon={HandCoins} title="Empréstimo não encontrado" />
      </div>
    )
  }

  const { emprestimo, cliente } = data
  const emModoParcela = !saldoAberto && modoParcelado === 'parcela'
  const valorDevido = emModoParcela && parcelaSelecionada ? parcelaSelecionada.saldo : emprestimo.saldo_atual
  const valorPago = emModoParcela && parcelaSelecionada
    ? parcelaSelecionada.valor_pago
    : emprestimo.valor_total - emprestimo.saldo_atual
  const excessoJuros = Math.max(0, valor - jurosPendentes)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (valor <= 0) {
      setError('Informe o valor do pagamento.')
      return
    }
    if (!saldoAberto && modoParcelado === 'parcela' && !parcelaId) {
      setError('Selecione a parcela a ser paga.')
      return
    }
    if (saldoAberto && operacao === 'quitar' && valor < emprestimo.saldo_atual) {
      setError('Para quitar, o valor deve cobrir o total devido.')
      return
    }
    if (saldoAberto && operacao === 'juros' && valor < jurosPendentes) {
      setError('Para pagar os juros, o valor deve cobrir todos os juros pendentes.')
      return
    }
    setError(undefined)
    setSubmitting(true)
    try {
      await registrarPagamento({
        emprestimo_id: emprestimo.id,
        cliente_id: cliente.id,
        parcela_id:
          !saldoAberto && modoParcelado === 'parcela' ? parcelaSelecionada?.id ?? null : null,
        valor,
        forma_pagamento: forma,
        data_pagamento: dataPagamento,
        operacao: saldoAberto ? operacao : 'padrao',
        observacao,
      })
      toast.success('Pagamento registrado!')
      navigate(`/emprestimos/${emprestimo.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Registrar pagamento" backTo={`/emprestimos/${emprestimo.id}`} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{cliente.nome}</p>
              <p className="text-xs text-muted-foreground">
                {emModoParcela && parcelaSelecionada
                  ? `Parcela ${parcelaSelecionada.numero} de ${emprestimo.quantidade_parcelas}`
                  : tipoLabel(emprestimo.tipo)}
              </p>
            </div>
          </div>

          {saldoAberto ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Saldo devedor</p>
                <Money valor={devedor} className="text-sm font-bold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Juros pendentes</p>
                <Money valor={jurosPendentes} className="text-sm font-semibold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total devido</p>
                <Money valor={emprestimo.saldo_atual} className="text-sm font-semibold" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Valor devido</p>
                <Money valor={valorDevido} className="text-sm font-bold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor pago</p>
                <Money valor={valorPago} className="text-sm font-semibold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <Money valor={emprestimo.saldo_atual} className="text-sm font-semibold" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!saldoAberto && (
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Como aplicar o pagamento?</CardTitle>
            <CardDescription>Escolha entre quitar o total ou pagar uma parcela específica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-1">
            {MODOS_PARCELADO.map((modo) => {
              const ativo = modoParcelado === modo.valor
              return (
                <button
                  key={modo.valor}
                  type="button"
                  onClick={() => setModoParcelado(modo.valor)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-colors ${
                    ativo ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/40'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{modo.label}</span>
                    <span className="block text-xs text-muted-foreground">{modo.descricao}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    }`}
                  >
                    {ativo && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                </button>
              )
            })}

            {modoParcelado === 'parcela' && (
              <Field label="Parcela *">
                <Select value={parcelaId} onValueChange={setParcelaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a parcela" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.parcelas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Parcela {p.numero} · vence {formatarDataISO(p.data_vencimento)} ·{' '}
                        {formatarMoeda(p.saldo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      {saldoAberto && (
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">O que está sendo pago?</CardTitle>
            <CardDescription>Escolha como o valor será aplicado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-1">
            {OPERACOES.map((op) => {
              const ativo = operacao === op.valor
              const desabilitado = op.valor === 'juros' && !jurosDisponivel
              const Icone = op.icone
              return (
                <button
                  key={op.valor}
                  type="button"
                  disabled={desabilitado}
                  onClick={() => handleOperacaoChange(op.valor)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    ativo ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/40'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      ativo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{op.label}</span>
                    <span className="block text-xs text-muted-foreground">{op.descricao}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    }`}
                  >
                    {ativo && <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Valor do pagamento</CardTitle>
            <CardDescription>
              {saldoAberto && operacao === 'juros' && (
                <>Valor padrão: todos os juros pendentes ({<Money valor={jurosPendentes} />})</>
              )}
              {saldoAberto && operacao === 'padrao' && <>O valor paga os juros pendentes primeiro</>}
              {saldoAberto && operacao === 'quitar' && <>Valor padrão: total devido</>}
              {!saldoAberto && modoParcelado === 'total' && (
                <>Valor distribuído nas parcelas em aberto até quitar o saldo</>
              )}
              {!saldoAberto && modoParcelado === 'parcela' && <>Valor aplicado à parcela selecionada</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-1">
            <Field label="Valor do pagamento *" error={error}>
              <CurrencyInput value={valor} onChange={setValor} autoFocus />
            </Field>

            {saldoAberto && operacao === 'juros' && valor > 0 && (
              <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Juros pendentes a pagar</span>
                  <Money valor={Math.min(valor, jurosPendentes)} className="font-semibold" />
                </p>
                {excessoJuros > 0 && (
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">Excesso (abate no saldo devedor)</span>
                    <Money valor={excessoJuros} className="font-semibold" />
                  </p>
                )}
                <div className="my-1.5 border-t border-primary/20" />
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ciclo atual</span>
                  <span className="font-medium">encerrado e gera o próximo</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Novo vencimento do ciclo</span>
                  <span className="font-medium">
                    {novoVencimento ? formatarDataISO(novoVencimento) : '—'}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Saldo devedor após</span>
                  <Money valor={Math.max(0, devedor - excessoJuros)} className="font-semibold" />
                </p>
              </div>
            )}

            {saldoAberto && operacao === 'padrao' && preview && (
              <div className="space-y-1.5 rounded-xl bg-muted px-3.5 py-3 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Juros pendentes quitados</span>
                  <Money valor={preview.jurosPago} className="font-semibold" />
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Abate no saldo devedor</span>
                  <Money valor={preview.principalAbatido} className="font-semibold" />
                </p>
                <div className="my-1.5 border-t" />
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Novo saldo devedor</span>
                  <Money valor={preview.novoDevedor} className="font-semibold" />
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Novo total devido</span>
                  <Money valor={preview.novoTotalDevido} className="font-semibold" />
                </p>
              </div>
            )}

            {saldoAberto && operacao === 'quitar' && (
              <div className="space-y-1.5 rounded-xl bg-muted px-3.5 py-3 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total a receber</span>
                  <Money valor={emprestimo.saldo_atual} className="font-semibold" />
                </p>
                <p className="text-xs text-muted-foreground">
                  Encerra o contrato, quita juros e saldo devedor
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Forma de pagamento e data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-1 sm:grid-cols-2">
            <Field label="Forma de pagamento">
              <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS.map((f) => (
                    <SelectItem key={f.valor} value={f.valor}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data do pagamento">
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Observação</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-1">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </CardContent>
        </Card>

        <Button type="submit" size="xl" className="w-full" disabled={submitting || valorDevido <= 0}>
          {submitting ? 'Confirmando...' : 'Confirmar pagamento'}
        </Button>
      </form>
    </div>
  )
}
