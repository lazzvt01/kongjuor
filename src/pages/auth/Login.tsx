import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field } from '@/components/shared/Field'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validarWhatsappCampo } from '@/lib/validations'
import { entrar } from '@/services/api/auth'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [whatsapp, setWhatsapp] = useState('')
  const [senha, setSenha] = useState('')
  const [errors, setErrors] = useState<{ whatsapp?: string; senha?: string }>({})
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: typeof errors = {}
    const whatsappErr = validarWhatsappCampo(whatsapp)
    if (whatsappErr) erros.whatsapp = whatsappErr
    if (!senha) erros.senha = 'Informe a senha.'
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setLoading(true)
    try {
      await entrar(whatsapp, senha)
      toast.success('Bem-vindo de volta!')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Seu gerenciador de empréstimos"
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp}>
          <PhoneInput
            id="whatsapp"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="Senha" htmlFor="senha" error={errors.senha}>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/recuperar-senha" className="text-sm text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
