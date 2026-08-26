import { useCallback, useState } from 'react'
import { BarChart3, Users } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SCORE_CLASSIFICACAO_LABEL, classificarScore } from '@/services/financial/score'
import { obterRelatorio, type RelatorioData } from '@/services/api/dashboard'

const PERIODOS = [
  { valor: 'mes', label: 'Este mês', inicio: () => novoMes(), fim: () => hoje() },
  { valor: '3meses', label: 'Últimos 3 meses', inicio: () => haMeses(3), fim: () => hoje() },
  { valor: 'ano', label: 'Este ano', inicio: () => inicioAno(), fim: () => hoje() },
  { valor: 'custom', label: 'Período personalizado', inicio: () => '', fim: () => '' },
  { valor: 'tudo', label: 'Todo período', inicio: () => '', fim: () => '' },
]

function hoje() {
  return new Date().toISOString().slice(0, 10)
}
function novoMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function haMeses(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}
function inicioAno() {
  return `${new Date().getFullYear()}-01-01`
}

export function Relatorios() {
  const [periodo, setPeriodo] = useState('mes')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [data, setData] = useState<RelatorioData | null>(null)
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setAviso(null)
    let ini = inicio || null
    let fimD = fim || null
    if (periodo !== 'custom' && periodo !== 'tudo') {
      const p = PERIODOS.find((x) => x.valor === periodo) ?? PERIODOS[0]
      ini = p.inicio() || null
      fimD = p.fim() || null
    }
    if (periodo === 'custom' && (!ini || !fimD)) {
      setAviso('Informe as datas de início e fim do período.')
      return
    }
    setLoading(true)
    try {
      const result = await obterRelatorio(ini, fimD)
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [periodo, inicio, fim])

  const handlePeriodoChange = (v: string) => {
    setPeriodo(v)
    setData(null)
    setAviso(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios" subtitle="Resumo do seu negócio" />

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="periodo" className="sr-only">
            Período
          </Label>
          <select
            id="periodo"
            value={periodo}
            onChange={(e) => handlePeriodoChange(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={carregar} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar relatório'}
        </Button>
      </div>

      {periodo === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="inicio">Início</Label>
            <Input
              id="inicio"
              type="date"
              value={inicio}
              max={fim || undefined}
              onChange={(e) => setInicio(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="fim">Fim</Label>
            <Input
              id="fim"
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => setFim(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {aviso && <p className="text-sm text-destructive">{aviso}</p>}

      {!data && !loading && (
        <EmptyState
          icon={BarChart3}
          title="Selecione um período"
          description="Escolha o período e gere o relatório."
        />
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      )}

      {data && !loading && <RelatorioConteudo data={data} />}
    </div>
  )
}

function RelatorioConteudo({ data }: { data: RelatorioData }) {
  return (
    <div className="space-y-4">
      <Section titulo="Financeiro">
        <Linha label="Total emprestado" valor={<Money valor={data.totalEmprestado} />} />
        <Linha label="Total recebido" valor={<Money valor={data.totalRecebido} />} />
        <Linha label="Total em aberto" valor={<Money valor={data.totalEmAberto} />} />
        <Linha
          label="Total atrasado"
          valor={<Money valor={data.totalAtrasado} />}
          danger={data.totalAtrasado > 0}
        />
        <Linha label="Juros recebidos" valor={<Money valor={data.jurosRecebidos} />} />
      </Section>

      <Section titulo="Empréstimos">
        <Linha label="Ativos" valor={data.emprestimosAtivos} />
        <Linha label="Quitados" valor={data.emprestimosQuitados} />
        <Linha label="Atrasados" valor={data.emprestimosAtrasados} danger={data.emprestimosAtrasados > 0} />
        <Linha label="Renovados" valor={data.emprestimosRenovados} />
      </Section>

      <Section titulo="Clientes">
        <Linha label="Total de clientes" valor={data.totalClientes} />
        <Linha label="Clientes com atraso" valor={data.clientesAtrasados} danger={data.clientesAtrasados > 0} />
      </Section>

      {data.melhoresScores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Melhores scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.melhoresScores.map(({ cliente, score }) => (
              <div key={cliente.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm">{cliente.nome}</span>
                <span className="text-sm font-bold">
                  {score > 0 ? SCORE_CLASSIFICACAO_LABEL[classificarScore(score)] : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {children}
      </CardContent>
    </Card>
  )
}

function Linha({
  label,
  valor,
  danger,
}: {
  label: string
  valor: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${danger ? 'text-destructive' : ''}`}>{valor}</span>
    </div>
  )
}
