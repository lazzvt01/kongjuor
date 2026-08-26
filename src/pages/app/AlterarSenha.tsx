import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { validarRepetirSenha, validarSenha } from '@/lib/validations'
import { atualizarSenha } from '@/services/api/auth'

export function AlterarSenha() {
  const navigate = useNavigate()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    if (!atual) erros.atual = 'Informe a senha atual.'
    const novaErr = validarSenha(nova)
    if (novaErr) erros.nova = novaErr
    const repErr = validarRepetirSenha(nova, repetir)
    if (repErr) erros.repetir = repErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Sessão expirada.')

      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: atual,
      })
      if (checkError) {
        toast.error('Senha atual incorreta.')
        setSaving(false)
        return
      }
      await atualizarSenha(nova)
      toast.success('Senha alterada com sucesso!')
      navigate('/configuracoes', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Alterar senha" backTo="/configuracoes" />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Senha atual" error={errors.atual}>
              <Input
                type="password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                placeholder="••••••"
              />
            </Field>
            <Field label="Nova senha" error={errors.nova}>
              <Input
                type="password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </Field>
            <Field label="Repetir nova senha" error={errors.repetir}>
              <Input
                type="password"
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                placeholder="Digite novamente"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
