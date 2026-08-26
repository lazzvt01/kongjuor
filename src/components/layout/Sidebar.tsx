import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, Banknote, HandCoins, BarChart3, Settings, Plus, Handshake, Calculator } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const ITENS = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/emprestimos', label: 'Empréstimos', icon: Banknote },
  { to: '/receber', label: 'Receber', icon: HandCoins },
  { to: '/simulador', label: 'Simulador', icon: Calculator },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Handshake className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">KONGjuros</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ITENS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <Button size="lg" className="w-full" onClick={() => navigate('/emprestimos/novo')}>
          <Plus className="h-5 w-5" />
          Novo empréstimo
        </Button>
        <div className="mt-4 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(profile?.nome ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.nome ?? 'Credor'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.whatsapp ?? profile?.email ?? ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
