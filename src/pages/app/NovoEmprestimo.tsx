import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CurrencyInput } from '@/components/shared/CurrencyInput'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useClientesComResumo } from '@/hooks/useClientesComResumo'
import { hojeISO } from '@/services/financial'
import { PERIODICIDADE_LABEL } from '@/services/financial'
import { proximaDataPeriodica } from '@/services/financial/datas'
import { resumoNovoEmprestimo } from '@/services/financial/emprestimos'
import { criarEmprestimo } from '@/services/api/emprestimos'
import type {
  FormaJurosParcelado,
  JurosPeriodicidade,
  JurosTipo,
  TipoEmprestimo,
} from '@/types'

const TIPO_OPTIONS: { valor: TipoEmprestimo; label: string; descricao: string }[] = [
  { valor: 'parcelado', label: 'Parcelado', descricao: 'Valor dividido em parcelas' },
  {
    valor: 'saldo_aberto',
    label: 'Saldo aberto',
    descricao: 'Principal em aberto, juros cobrados por ciclos',
  },
]

const FORMA_OPTIONS: { valor: FormaJurosParcelado; label: string; descricao: string }[] = [
  {
    valor: 'total',
    label: 'Juros total',
    descricao: 'Juros únicos sobre o valor original, parcelado',
  },
  {
    valor: 'periodico',
    label: 'Juros periódico / amortização',
    descricao: 'Juros sobre o saldo devedor, parcela fixa',
  },
]

function formatarData(data: string): string {
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

export function NovoEmprestimo() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { clientes, loading: carregandoClientes } = useClientesComResumo()

  const [tipo, setTipo] = useState<TipoEmprestimo>('parcelado')
  const [formaJuros, setFormaJuros] = useState<FormaJurosParcelado>('total')
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '')
  const [valor, setValor] = useState(0)
  const [jurosTipo, setJurosTipo] = useState<JurosTipo>('percentual')
  const [jurosValor, setJurosValor] = useState(0)
  const [jurosTexto, setJurosTexto] = useState('')
  const [periodicidade, setPeriodicidade] = useState<JurosPeriodicidade>('mensal')
  const [intervalo, setIntervalo] = useState(1)
  const [quantidade, setQuantidade] = useState(1)
  const [vencimento, setVencimento] = useState(proximaDataPeriodica(hojeISO(), 'mensal'))
  const [vencimentoManual, setVencimentoManual] = useState(false)
  const [deixouGarantia, setDeixouGarantia] = useState(false)
  const [garantia, setGarantia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const c = params.get('cliente')
    if (c && clientes.some((cl) => cl.id === c)) setClienteId(c)
  }, [params, clientes])

  const handlePeriodicidadeChange = (p: JurosPeriodicidade) => {
    setPeriodicidade(p)
    if (!vencimentoManual) {
      setVencimento(proximaDataPeriodica(hojeISO(), p, intervalo))
    }
  }

  const handleIntervaloChange = (v: number) => {
    const val = Math.max(1, v || 1)
    setIntervalo(val)
    if (!vencimentoManual) {
      setVencimento(proximaDataPeriodica(hojeISO(), periodicidade, val))
    }
  }

  const handleVencimentoChange = (v: string) => {
    setVencimento(v)
    setVencimentoManual(true)
  }

  const resumo = useMemo(() => {
    if (valor <= 0) return null
    return resumoNovoEmprestimo({
      cliente_id: clienteId,
      tipo,
      forma_juros: tipo === 'parcelado' ? formaJuros : null,
      valor_principal: valor,
      juros_tipo: jurosTipo,
      juros_valor: jurosValor,
      juros_periodicidade: periodicidade,
      intervalo,
      data_inicio: hojeISO(),
      data_vencimento: vencimento,
      quantidade_parcelas: tipo === 'parcelado' ? quantidade : undefined,
    })
  }, [tipo, formaJuros, clienteId, valor, jurosTipo, jurosValor, periodicidade, intervalo, quantidade, vencimento])

  const handleJurosChange = (texto: string) => {
    setJurosTexto(texto)
    const limpo = texto.replace(',', '.')
    const num = parseFloat(limpo)
    setJurosValor(Number.isNaN(num) ? 0 : Math.round(num * 100))
  }

  const handleSubmit = async () => {
    const erros: Record<string, string> = {}
    if (!clienteId) erros.cliente = 'Selecione um cliente.'
    if (valor <= 0) erros.valor = 'Informe o valor do empréstimo.'
    if (jurosValor < 0) erros.juros = 'Juros inválidos.'
    if (!vencimento) erros.vencimento = 'Informe a data.'
    if (tipo === 'parcelado' && (!quantidade || quantidade < 1)) {
      erros.quantidade = 'Informe a quantidade de parcelas.'
    }
    setErrors(erros)
    if (Object.keys(erros).length > 0) {
      toast.error('Verifique os campos destacados.')
      return
    }

    setSubmitting(true)
    try {
      const id = await criarEmprestimo({
        cliente_id: clienteId,
        tipo,
        forma_juros: tipo === 'parcelado' ? formaJuros : null,
        valor_principal: valor,
        juros_tipo: jurosTipo,
        juros_valor: jurosValor,
        juros_periodicidade: periodicidade,
        intervalo,
        data_inicio: hojeISO(),
        data_vencimento: vencimento,
        quantidade_parcelas: tipo === 'parcelado' ? quantidade : undefined,
        deixou_garantia: deixouGarantia,
        garantia: deixouGarantia ? garantia : undefined,
        observacao: observacao.trim() || undefined,
      })
      toast.success('Empréstimo criado com sucesso!')
      navigate(`/emprestimos/${id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Novo empréstimo" subtitle="Defina os valores e condições" backTo="/emprestimos/novo" />

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">1. Tipo de empréstimo</CardTitle>
          <CardDescription>Como o principal será devolvido</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 pt-1 sm:grid-cols-2">
          {TIPO_OPTIONS.map((opt) => (
            <button
              key={opt.valor}
              onClick={() => setTipo(opt.valor)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                tipo === opt.valor
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/40'
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.descricao}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">2. Cliente e valor</CardTitle>
          <CardDescription>Para quem e quanto será emprestado</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-1 sm:grid-cols-2">
          <Field label="Cliente *" htmlFor="cliente" error={errors.cliente}>
            {carregandoClientes ? (
              <Skeleton className="h-11" />
            ) : (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="cliente">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                      {c.whatsapp_normalizado ? ` — ${c.whatsapp_normalizado}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Valor do empréstimo *" error={errors.valor}>
            <CurrencyInput value={valor} onChange={setValor} autoFocus />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">3. Juros</CardTitle>
          <CardDescription>Taxa, forma e parcelas do contrato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-1">
          {tipo === 'parcelado' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMA_OPTIONS.map((opt) => (
                <button
                  key={opt.valor}
                  onClick={() => setFormaJuros(opt.valor)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    formaJuros === opt.valor
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/40'
                  }`}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.descricao}</p>
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de juros">
              <Select value={jurosTipo} onValueChange={(v) => setJurosTipo(v as JurosTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={jurosTipo === 'percentual' ? 'Juros (%)' : 'Juros (R$)'}
              error={errors.juros}
            >
              <Input
                type="text"
                inputMode="decimal"
                value={jurosTexto}
                onChange={(e) => handleJurosChange(e.target.value)}
                placeholder={jurosTipo === 'percentual' ? 'Ex.: 10' : 'Ex.: 100'}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Periodicidade">
              <Select value={periodicidade} onValueChange={handlePeriodicidadeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIODICIDADE_LABEL) as JurosPeriodicidade[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIODICIDADE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Intervalo">
              <Input
                type="number"
                min={1}
                value={intervalo || ''}
                onChange={(e) => handleIntervaloChange(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </Field>
            {tipo === 'parcelado' ? (
              <Field label="Quantidade de parcelas" error={errors.quantidade}>
                <Input
                  type="number"
                  min={1}
                  value={quantidade || ''}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                  placeholder="Ex.: 5"
                />
              </Field>
            ) : (
              <Field label="Vencimento do ciclo *" error={errors.vencimento}>
                <Input type="date" value={vencimento} onChange={(e) => handleVencimentoChange(e.target.value)} />
              </Field>
            )}
          </div>

          {tipo === 'parcelado' && (
            <Field label="Primeiro vencimento *" error={errors.vencimento}>
              <Input type="date" value={vencimento} onChange={(e) => handleVencimentoChange(e.target.value)} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">4. Condições</CardTitle>
          <CardDescription>Garantia e anotações opcionais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Deixou garantia</p>
              <p className="text-xs text-muted-foreground">
                Registre a garantia recebida neste empréstimo
              </p>
            </div>
            <Switch checked={deixouGarantia} onCheckedChange={setDeixouGarantia} />
          </div>
          {deixouGarantia && (
            <Textarea
              value={garantia}
              onChange={(e) => setGarantia(e.target.value)}
              placeholder="Descreva a garantia (ex.: celular, documento, joia...)"
              rows={2}
            />
          )}
          <Field label="Observação">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Anotações opcionais sobre este empréstimo"
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {resumo && valor > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base text-primary">Simulação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-1">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Total a receber</span>
              <Money valor={resumo.valorTotal} className="text-2xl font-bold text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-primary/20 pt-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Principal</p>
                <Money valor={valor} className="text-sm font-medium" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Juros{tipo === 'saldo_aberto' ? ' por ciclo' : ''}
                </p>
                <Money valor={resumo.valorJuros} className="text-sm font-medium" />
              </div>
              {tipo === 'parcelado' && resumo.valorParcela != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor da parcela</p>
                  <Money valor={resumo.valorParcela} className="text-sm font-medium" />
                </div>
              )}
              {tipo === 'saldo_aberto' && (
                <div>
                  <p className="text-xs text-muted-foreground">Saldo devedor</p>
                  <Money valor={resumo.saldoDevedor} className="text-sm font-medium" />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Quantidade</p>
                <p className="text-sm font-medium">
                  {tipo === 'parcelado'
                    ? `${resumo.quantidadeParcelas ?? 0} parcelas`
                    : 'ciclos'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {tipo === 'saldo_aberto' ? 'Vencimento do ciclo' : 'Vencimento final'}
                </p>
                <p className="text-sm font-medium">
                  {formatarData(tipo === 'saldo_aberto' ? resumo.primeiroVencimento : resumo.ultimoVencimento)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button size="xl" className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Criando...' : 'Confirmar empréstimo'}
      </Button>
    </div>
  )
}
