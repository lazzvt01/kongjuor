import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field } from '@/components/shared/Field'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { validarWhatsappCampo } from '@/lib/validations'
import { recuperarSenha } from '@/services/api/auth'

export function RecuperarSenha() {
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validarWhatsappCampo(whatsapp)
    if (err) {
      setError(err)
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await recuperarSenha(whatsapp)
      setEnviado(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <AuthLayout title="Link enviado" subtitle="Recuperação de senha">
        <div className="mt-4 space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Se o WhatsApp informado estiver cadastrado, enviamos um link de redefinição de senha.
            Verifique seu e-mail de recuperação.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe seu WhatsApp para recuperar o acesso"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Lembrou a senha? Entrar
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="WhatsApp" htmlFor="whatsapp" error={error}>
          <PhoneInput
            id="whatsapp"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </Button>
      </form>
    </AuthLayout>
  )
}
