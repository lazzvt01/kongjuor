import { useNavigate } from 'react-router-dom'
import { Bell, CreditCard, LogOut, Moon, Sun, UserRound, KeyRound, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { usePlano } from '@/hooks/usePlano'
import { useTheme } from '@/hooks/useTheme'
import { sair } from '@/services/api/auth'

export function Configuracoes() {
  const navigate = useNavigate()
  const { profile, refresh } = useAuth()
  const { resumo } = usePlano()
  const { theme, toggleTheme } = useTheme()

  const handleSair = async () => {
    await sair()
    await refresh()
    toast.success('Você saiu da sua conta.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Ajustes da sua conta e do aplicativo" />

      <Card>
        <CardContent className="divide-y p-0">
          <button
            onClick={() => navigate('/perfil')}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Meu perfil</p>
              <p className="text-xs text-muted-foreground">
                {profile?.nome} · {profile?.whatsapp}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Assinatura</h2>
        <Card>
          <CardContent className="divide-y p-0">
            <button
              onClick={() => navigate('/planos')}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Meu plano</p>
                <p className="text-xs text-muted-foreground">
                  {resumo
                    ? `${resumo.nome}${resumo.limite_ativos === null ? ' · ilimitado' : ` · ${resumo.ativos}/${resumo.limite_ativos} ativos`}`
                    : 'Free'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Segurança</h2>
        <Card>
          <CardContent className="divide-y p-0">
            <button
              onClick={() => navigate('/alterar-senha')}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Alterar senha</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleSair}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Sair da conta</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Aplicativo</h2>
        <Card>
          <CardContent className="divide-y p-0">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Aparência</p>
                <p className="text-xs text-muted-foreground">
                  {theme === 'dark' ? 'Tema escuro' : 'Tema claro'}
                </p>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>
            <div className="flex items-center gap-3 px-4 py-4 opacity-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Notificações</p>
                <p className="text-xs text-muted-foreground">Em breve</p>
              </div>
              <Switch disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="px-1 text-center text-xs text-muted-foreground">KONGjuros v1.0.0</p>
    </div>
  )
}
