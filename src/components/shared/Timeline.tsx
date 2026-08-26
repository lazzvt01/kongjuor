import { formatarData, formatarMoeda, formatarTaxaPercentual, numeroEmprestimo } from '@/services/financial'
import type { Ciclo, Emprestimo, Pagamento } from '@/types'

const FORMA_LABEL: Record<Pagamento['forma_pagamento'], string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outro',
}

interface TimelineEvent {
  id: string
  data: string
  ordenacao: number
  titulo: string
  descricao: string
  cor: string
}

function descricaoEmprestimo(emp: Emprestimo): string {
  const juros = Math.max(0, emp.valor_total - emp.valor_principal)
  const taxa =
    emp.juros_tipo === 'percentual'
      ? `${formatarTaxaPercentual(emp.juros_valor)}% juros`
      : `${formatarMoeda(juros)} juros`
  return `${formatarMoeda(emp.valor_principal)} + ${taxa} = ${formatarMoeda(emp.valor_total)}`
}

export function Timeline({
  emprestimos,
  pagamentos,
  ciclos,
}: {
  emprestimos: Emprestimo[]
  pagamentos: Pagamento[]
  ciclos: Ciclo[]
}) {
  const eventos: TimelineEvent[] = []
  const numeroPorId = new Map<string, string>()
  for (const emp of emprestimos) {
    const numero = numeroEmprestimo(emp)
    if (numero) numeroPorId.set(emp.id, numero)
  }

  for (const emp of emprestimos) {
    const numero = numeroEmprestimo(emp)
    eventos.push({
      id: `emp-${emp.id}`,
      data: emp.data_inicio,
      ordenacao: Date.parse(emp.created_at),
      titulo: numero ? `Empréstimo ${numero} realizado` : 'Empréstimo realizado',
      descricao: descricaoEmprestimo(emp),
      cor: 'bg-primary',
    })
    if (emp.saldo_atual <= 0) {
      eventos.push({
        id: `quit-${emp.id}`,
        data: emp.updated_at.slice(0, 10),
        ordenacao: Date.parse(emp.updated_at) + 2,
        titulo: 'Empréstimo quitado',
        descricao: `${formatarMoeda(emp.valor_total)} recebidos${numero ? ` · Empréstimo ${numero}` : ''}`,
        cor: 'bg-success',
      })
    }
  }

  for (const ciclo of ciclos) {
    if (ciclo.numero_ciclo <= 1) continue
    eventos.push({
      id: `ciclo-${ciclo.id}`,
      data: ciclo.data_inicio,
      ordenacao: Date.parse(ciclo.created_at) + 1,
      titulo: `Novo ciclo (${ciclo.numero_ciclo - 1} → ${ciclo.numero_ciclo})`,
      descricao: `Juros ${formatarMoeda(ciclo.juros_calculado)} · Saldo ${formatarMoeda(ciclo.saldo_principal_inicial)}`,
      cor: 'bg-warning',
    })
  }

  for (const pag of pagamentos) {
    eventos.push({
      id: `pag-${pag.id}`,
      data: pag.data_pagamento,
      ordenacao: Date.parse(pag.created_at),
      titulo: `Recebimento via ${FORMA_LABEL[pag.forma_pagamento]}`,
      descricao: `${formatarMoeda(pag.valor)} · Empréstimo ${numeroPorId.get(pag.emprestimo_id) ?? '—'}`,
      cor: 'bg-success',
    })
  }

  eventos.sort((a, b) => a.ordenacao - b.ordenacao)

  if (eventos.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
  }

  return (
    <ol className="relative ml-2 space-y-5 border-l pl-6">
      {eventos.map((ev) => (
        <li key={ev.id} className="relative">
          <span
            className={`absolute -left-[31px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ${ev.cor} ring-4 ring-background`}
          />
          <p className="text-sm font-medium">{ev.titulo}</p>
          <p className="text-xs text-muted-foreground">{ev.descricao}</p>
          <p className="text-[11px] text-muted-foreground/70">{formatarData(ev.data)}</p>
        </li>
      ))}
    </ol>
  )
}
