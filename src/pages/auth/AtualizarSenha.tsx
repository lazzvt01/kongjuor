import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field } from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { validarRepetirSenha, validarSenha } from '@/lib/validations'
import { atualizarSenha } from '@/services/api/auth'

export function AtualizarSenha() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [repetir, setRepetir] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [semSessao, setSemSessao] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setSemSessao(true)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    const senhaErr = validarSenha(senha)
    if (senhaErr) erros.senha = senhaErr
    const repErr = validarRepetirSenha(senha, repetir)
    if (repErr) erros.repetir = repErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setLoading(true)
    try {
      await atualizarSenha(senha)
      toast.success('Senha atualizada com sucesso!')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (semSessao) {
    return (
      <AuthLayout title="Link inválido" subtitle="Recuperação de senha">
        <div className="mt-4 space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            O link de recuperação expirou ou já foi utilizado.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/recuperar-senha">Solicitar novo link</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Defina uma nova senha para sua conta">
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Nova senha" htmlFor="senha" error={errors.senha}>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </Field>
        <Field label="Repetir senha" htmlFor="repetir" error={errors.repetir}>
          <Input
            id="repetir"
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            placeholder="Digite a senha novamente"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Salvando...' : 'Atualizar senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}
