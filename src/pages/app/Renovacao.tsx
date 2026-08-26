import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/EmptyState'
import { Field } from '@/components/shared/Field'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmprestimoDetalhe } from '@/hooks/useEmprestimoDetalhe'
import { calcularJuros, jurosDoPeriodo, saldoDevedor } from '@/services/financial'
import { proximaDataPeriodica } from '@/services/financial/datas'
import { renovarCiclo } from '@/services/api/ciclos'

export function Renovacao() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading } = useEmprestimoDetalhe(id)

  const [novoVencimento, setNovoVencimento] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const emprestimo = data?.emprestimo

  useEffect(() => {
    if (emprestimo && !novoVencimento) {
      setNovoVencimento(
        proximaDataPeriodica(emprestimo.data_vencimento, emprestimo.juros_periodicidade, emprestimo.intervalo),
      )
    }
  }, [emprestimo, novoVencimento])

  const resumo = useMemo(() => {
    if (!emprestimo) return null
    const devedor = saldoDevedor(emprestimo)
    const jurosPendentes = jurosDoPeriodo(emprestimo)
    const novoJuros = calcularJuros(devedor, emprestimo.juros_tipo, emprestimo.juros_valor)
    return { devedor, jurosPendentes, novoJuros, novoTotal: devedor + novoJuros }
  }, [emprestimo])

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Renovar ciclo" backTo="/emprestimos" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Renovar ciclo" backTo="/emprestimos" />
        <EmptyState icon={RefreshCw} title="Empréstimo não encontrado" />
      </div>
    )
  }

  const { cliente } = data
  if (emprestimo!.tipo !== 'saldo_aberto') {
    return (
      <div className="space-y-4">
        <PageHeader title="Renovar ciclo" backTo={`/emprestimos/${emprestimo!.id}`} />
        <EmptyState
          icon={RefreshCw}
          title="Renovação por ciclos é exclusiva de saldo aberto"
          actionLabel="Voltar"
          actionHref={`/emprestimos/${emprestimo!.id}`}
        />
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!novoVencimento) {
      toast.error('Informe o novo vencimento.')
      return
    }
    setSubmitting(true)
    try {
      await renovarCiclo(emprestimo!.id, novoVencimento)
      toast.success('Novo ciclo iniciado!')
      navigate(`/emprestimos/${emprestimo!.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Renovar ciclo" subtitle={cliente.nome} backTo={`/emprestimos/${emprestimo!.id}`} />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo devedor (principal)</span>
            <Money valor={resumo!.devedor} className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Juros pendentes do ciclo atual</span>
            <Money valor={resumo!.jurosPendentes} className="font-medium" />
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Juros do próximo ciclo</span>
            <Money valor={resumo!.novoJuros} className="font-semibold text-success" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total devido no próximo ciclo</span>
            <Money valor={resumo!.novoTotal} className="font-semibold" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Field label="Novo vencimento *">
          <Input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} />
        </Field>

        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          O ciclo atual será encerrado e o próximo iniciado imediatamente. Juros pendentes do ciclo
          atual continuam devidos e são cobrados antes do principal nos próximos pagamentos.
        </p>
      </div>

      <Button size="xl" className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Renovando...' : 'Confirmar novo ciclo'}
      </Button>
    </div>
  )
}
