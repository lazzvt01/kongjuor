import { NavLink, useNavigate } from 'react-router-dom'
import {
  Banknote,
  BarChart3,
  Calculator,
  HandCoins,
  Home,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { sair } from '@/services/api/auth'
import type { LucideIcon } from 'lucide-react'

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground transition-colors',
          isActive && 'text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function MobileNav() {
  const navigate = useNavigate()
  const { profile, refresh } = useAuth()

  const handleSair = async () => {
    await sair()
    await refresh()
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      <nav className="mx-auto flex h-16 max-w-lg items-stretch px-1">
        <NavItem to="/" label="Início" icon={Home} />
        <NavItem to="/clientes" label="Clientes" icon={Users} />

        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={() => navigate('/emprestimos/novo')}
            aria-label="Novo empréstimo"
            className="group flex flex-col items-center gap-1"
          >
            <span className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform group-hover:scale-105 group-active:scale-95">
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <span className="-mt-2.5 text-[11px] font-semibold text-primary">Novo</span>
          </button>
        </div>

        <NavItem to="/receber" label="Receber" icon={HandCoins} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="mb-2 w-56">
            <DropdownMenuLabel>{profile?.nome ?? 'Conta'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/emprestimos')}>
              <Banknote className="h-4 w-4" />
              Empréstimos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/simulador')}>
              <Calculator className="h-4 w-4" />
              Simulador
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/relatorios')}>
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              <Settings className="h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <UserRound className="h-4 w-4" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSair} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="safe-bottom" />
    </div>
  )
}
