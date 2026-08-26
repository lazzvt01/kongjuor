import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Money } from '@/components/shared/Money'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useClientesComResumo, type ClienteResumo } from '@/hooks/useClientesComResumo'
import { formatarData } from '@/services/financial'

export function Clientes() {
  const navigate = useNavigate()
  const { clientes, loading, error } = useClientesComResumo()
  const [busca, setBusca] = useState('')

  const filtrados = clientes.filter((c) => {
    const q = busca.trim().toLowerCase()
    if (!q) return true
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.whatsapp_normalizado ?? '').includes(q.replace(/\D/g, ''))
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus clientes</p>
        </div>
        <Button onClick={() => navigate('/clientes/novo')}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo cliente</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou WhatsApp"
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && filtrados.length === 0 && (
        <EmptyState
          icon={Users}
          title="Você ainda não possui clientes"
          description="Cadastre seu primeiro cliente para começar a emprestar."
          actionLabel="Cadastrar cliente"
          onAction={() => navigate('/clientes/novo')}
        />
      )}

      {!loading && filtrados.length > 0 && (
        <div className="space-y-2">
          {filtrados.map((cliente) => (
            <ClienteRow key={cliente.id} cliente={cliente} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClienteRow({ cliente }: { cliente: ClienteResumo }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/clientes/${cliente.id}`)}
      className="w-full rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors active:bg-muted"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
          {cliente.nome.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{cliente.nome}</p>
            {cliente.atrasos > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                {cliente.atrasos} atraso{cliente.atrasos > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cliente.whatsapp_normalizado ? `+${cliente.whatsapp_normalizado}` : 'Sem WhatsApp'}
          </p>
        </div>
        <ScoreBadge score={cliente.score} classificacao={cliente.classificacao} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <CardStat label="Em aberto" value={<Money valor={cliente.valorEmAberto} />} />
        <CardStat label="Empréstimos" value={cliente.emprestimosAtivos} />
        <CardStat label="Atrasos" value={cliente.atrasos} danger={cliente.atrasos > 0} />
      </div>

      {cliente.proximoVencimento && (
        <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
          <span>Próximo vencimento</span>
          <span className="font-medium text-foreground">{formatarData(cliente.proximoVencimento)}</span>
        </div>
      )}
    </button>
  )
}

function CardStat({
  label,
  value,
  danger,
}: {
  label: string
  value: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5 text-center">
      <p className={danger ? 'text-sm font-bold text-destructive' : 'text-sm font-bold'}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}
