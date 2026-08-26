import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard, Search, UserPlus, Users } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientesComResumo } from '@/hooks/useClientesComResumo'
import { usePlano } from '@/hooks/usePlano'

export function NovoEmprestimoSelecionar() {
  const navigate = useNavigate()
  const { clientes, loading } = useClientesComResumo()
  const { resumo, limiteAtingido } = usePlano()
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
    <div className="space-y-6">
      <PageHeader title="Novo empréstimo" subtitle="Para quem será o empréstimo?" backTo="/emprestimos" />

      {limiteAtingido && resumo && (
        <Card className="border-destructive/50">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold">Limite de empréstimos ativos atingido</p>
              <p className="text-sm text-muted-foreground">
                Você está usando {resumo.ativos} de{' '}
                {resumo.limite_ativos === null ? 'ilimitados' : resumo.limite_ativos} no plano{' '}
                {resumo.nome}. Quite empréstimos para liberar espaço ou faça upgrade.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={() => navigate('/planos')}>
              Ver planos e fazer upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {!limiteAtingido && (
        <>
          <Button
            size="xl"
            variant="outline"
            className="h-auto w-full flex-col gap-1 border-2 border-dashed py-6"
            onClick={() => navigate('/emprestimos/novo/novo-cliente')}
          >
            <UserPlus className="h-6 w-6 text-primary" />
            <span className="font-semibold">Cliente novo</span>
            <span className="text-xs font-normal text-muted-foreground">
              Cadastre apenas com nome e WhatsApp
            </span>
          </Button>

          <div className="space-y-3">
            <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
              <Users className="h-4 w-4" />
              Emprestar a cliente existente
            </h2>

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

            {!loading && clientes.length === 0 && (
              <EmptyState
                icon={Users}
                title="Nenhum cliente cadastrado"
                description="Cadastre o primeiro cliente para fazer um empréstimo."
              />
            )}

            {!loading && clientes.length > 0 && filtrados.length === 0 && (
              <EmptyState icon={Search} title="Nada encontrado" description="Tente outro nome ou WhatsApp." />
            )}

            {filtrados.length > 0 && (
              <div className="space-y-2">
                {filtrados.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => navigate(`/emprestimos/novo/definir?cliente=${cliente.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors active:bg-muted"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {cliente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{cliente.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cliente.whatsapp_normalizado ? `+${cliente.whatsapp_normalizado}` : 'Sem WhatsApp'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
