import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { usePlano } from '@/hooks/usePlano'
import { validarNome, validarWhatsappCampo } from '@/lib/validations'
import { atualizarPerfil } from '@/services/api/auth'

export function MeuPerfil() {
  const { profile, refresh } = useAuth()
  const { resumo } = usePlano()
  const navigate = useNavigate()
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    const nomeErr = validarNome(nome)
    if (nomeErr) erros.nome = nomeErr
    const whatsErr = validarWhatsappCampo(whatsapp)
    if (whatsErr) erros.whatsapp = whatsErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setSaving(true)
    try {
      await atualizarPerfil({ nome, whatsapp })
      await refresh()
      toast.success('Perfil atualizado com sucesso!')
      navigate('/configuracoes', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Meu perfil" backTo="/configuracoes" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" backTo="/configuracoes" />

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
              {profile.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold">{profile.nome}</p>
              <p className="text-sm text-muted-foreground">{profile.whatsapp || 'Sem WhatsApp'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" error={errors.nome}>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp}>
          <PhoneInput value={whatsapp} onChange={setWhatsapp} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>
    </div>
  )
}
