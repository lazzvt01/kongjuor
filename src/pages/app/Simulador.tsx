import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Calculator, Copy, MessageCircle, Send } from 'lucide-react'

import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Field } from '@/components/shared/Field'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  formatarData,
  formatarMoeda,
  formatarTaxaPercentual,
  hojeISO,
  PERIODICIDADE_LABEL,
  proximaDataPeriodica,
} from '@/services/financial'
import { resumoNovoEmprestimo } from '@/services/financial/emprestimos'
import type { FormaJurosParcelado, JurosPeriodicidade, JurosTipo } from '@/types'

const TIPO_OPTIONS: { valor: 'parcelado' | 'saldo_aberto'; label: string }[] = [
  { valor: 'parcelado', label: 'Parcelado' },
  { valor: 'saldo_aberto', label: 'Saldo aberto' },
]

const FORMA_OPTIONS: { valor: FormaJurosParcelado; label: string }[] = [
  { valor: 'total', label: 'Juros total' },
  { valor: 'periodico', label: 'Amortização' },
]

export function Simulador() {
  const [valor, setValor] = useState(0)
  const [jurosTipo, setJurosTipo] = useState<JurosTipo>('percentual')
  const [jurosTexto, setJurosTexto] = useState('')
  const [jurosValor, setJurosValor] = useState(0)
  const [periodicidade, setPeriodicidade] = useState<JurosPeriodicidade>('mensal')
  const [tipo, setTipo] = useState<'parcelado' | 'saldo_aberto'>('saldo_aberto')
  const [formaJuros, setFormaJuros] = useState<FormaJurosParcelado>('total')
  const [quantidade, setQuantidade] = useState(1)
  const [intervalo, setIntervalo] = useState(1)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [copiado, setCopiado] = useState(false)

  const venc = proximaDataPeriodica(hojeISO(), periodicidade, intervalo)

  const resultado = useMemo(() => {
    if (valor <= 0) return null
    return resumoNovoEmprestimo({
      cliente_id: '',
      tipo,
      forma_juros: tipo === 'parcelado' ? formaJuros : null,
      valor_principal: valor,
      juros_tipo: jurosTipo,
      juros_valor: jurosValor,
      juros_periodicidade: periodicidade,
      intervalo,
      data_inicio: hojeISO(),
      data_vencimento: venc,
      quantidade_parcelas: tipo === 'parcelado' ? quantidade : undefined,
    })
  }, [valor, jurosTipo, jurosValor, tipo, formaJuros, periodicidade, intervalo, quantidade, venc])

  const taxaTexto =
    jurosTipo === 'percentual'
      ? `${formatarTaxaPercentual(jurosValor)}% ${PERIODICIDADE_LABEL[periodicidade].toLowerCase()}`
      : formatarMoeda(jurosValor)

  const mensagem = useMemo(() => {
    if (!resultado) return ''
    const linhas = [
      '*Simulação de empréstimo*',
      '',
      ...(nomeCliente.trim() ? [`Cliente: ${nomeCliente.trim()}`] : []),
      `Valor do empréstimo: ${formatarMoeda(valor)}`,
      `Juros: ${taxaTexto}`,
      `Valor dos juros: ${formatarMoeda(resultado.valorJuros)}`,
      `Total a receber: ${formatarMoeda(resultado.valorTotal)}`,
      `Vencimento: ${formatarData(resultado.primeiroVencimento)}`,
      ...(tipo === 'parcelado' && resultado.valorParcela != null
        ? [`Parcelas: ${quantidade}x de ${formatarMoeda(resultado.valorParcela)}`]
        : []),
    ]
    return linhas.join('\n')
  }, [resultado, valor, taxaTexto, nomeCliente, tipo, quantidade])

  const handleJurosChange = (texto: string) => {
    setJurosTexto(texto)
    const num = parseFloat(texto.replace(',', '.'))
    setJurosValor(Number.isNaN(num) ? 0 : Math.round(num * 100))
  }

  const handleEnviar = () => {
    const digitos = telefone.replace(/\D/g, '')
    if (digitos.length < 10) {
      toast.error('Informe o WhatsApp do cliente.')
      return
    }
    if (!mensagem) {
      toast.error('Preencha a simulação antes de enviar.')
      return
    }
    window.open(`https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  const handleCopiar = async () => {
    if (!mensagem) {
      toast.error('Preencha a simulação antes de copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      toast.success('Mensagem copiada!')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar a mensagem.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador"
        subtitle="Calcule juros e envie a proposta pelo WhatsApp"
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <Field label="Valor do empréstimo">
            <CurrencyInput value={valor} onChange={setValor} autoFocus />
          </Field>

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
            <Field label={jurosTipo === 'percentual' ? 'Juros (%)' : 'Juros (R$)'}>
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
              <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as JurosPeriodicidade)}>
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
                onChange={(e) => setIntervalo(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </Field>
            {tipo === 'parcelado' ? (
              <Field label="Quantidade de parcelas">
                <Input
                  type="number"
                  min={1}
                  value={quantidade || ''}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                  placeholder="Ex.: 5"
                />
              </Field>
            ) : (
              <Field label="Vencimento">
                <Input type="date" value={venc} readOnly className="text-muted-foreground" />
              </Field>
            )}
          </div>

          {tipo === 'parcelado' && (
            <div>
              <p className="mb-2 text-sm font-medium">Forma de juros</p>
              <div className="grid grid-cols-2 gap-2">
                {FORMA_OPTIONS.map((opt) => (
                  <button
                    key={opt.valor}
                    onClick={() => setFormaJuros(opt.valor)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      formaJuros === opt.valor
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Tipo de empréstimo</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_OPTIONS.map((opt) => (
                <button
                  key={opt.valor}
                  onClick={() => setTipo(opt.valor)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    tipo === opt.valor
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input text-muted-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {resultado && valor > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Calculator className="h-4 w-4" />
              Resultado da simulação
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor</span>
                <Money valor={valor} className="font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Juros ({taxaTexto})</span>
                <Money valor={resultado.valorJuros} className="font-medium" />
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="font-semibold">Total a receber</span>
                <Money valor={resultado.valorTotal} className="font-bold" />
              </div>
              {tipo === 'parcelado' && resultado.valorParcela != null ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {quantidade} {quantidade === 1 ? 'parcela' : 'parcelas'} de
                  </span>
                  <Money valor={resultado.valorParcela} className="font-medium text-foreground" />
                </div>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>Vencimento do ciclo</span>
                  <span className="font-medium text-foreground">{formatarData(resultado.primeiroVencimento)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Send className="h-4 w-4 text-primary" />
            Enviar pelo WhatsApp
          </p>

          <Field label="Nome do cliente (opcional)">
            <Input
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              placeholder="Ex.: Maria"
            />
          </Field>
          <Field label="WhatsApp do cliente">
            <PhoneInput value={telefone} onChange={setTelefone} />
          </Field>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={handleEnviar} disabled={!resultado}>
              <MessageCircle className="h-4 w-4" />
              Enviar simulação
            </Button>
            <Button variant="outline" onClick={handleCopiar} disabled={!resultado}>
              {copiado ? <Copy className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copiado ? 'Copiada!' : 'Copiar mensagem'}
            </Button>
          </div>

          {mensagem && (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-xs text-muted-foreground">
              {mensagem}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
