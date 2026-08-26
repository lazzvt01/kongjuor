import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field } from '@/components/shared/Field'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validarNome, validarRepetirSenha, validarSenha, validarWhatsappCampo } from '@/lib/validations'
import { cadastrar } from '@/services/api/auth'

export function Cadastro() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [senha, setSenha] = useState('')
  const [repetir, setRepetir] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    const nomeErr = validarNome(nome)
    if (nomeErr) erros.nome = nomeErr
    const whatsErr = validarWhatsappCampo(whatsapp)
    if (whatsErr) erros.whatsapp = whatsErr
    const senhaErr = validarSenha(senha)
    if (senhaErr) erros.senha = senhaErr
    const repErr = validarRepetirSenha(senha, repetir)
    if (repErr) erros.repetir = repErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setLoading(true)
    try {
      const data = await cadastrar({ nome, whatsapp, senha })
      if (data.session) {
        toast.success('Conta criada com sucesso!')
        navigate('/', { replace: true })
      } else {
        toast.success('Conta criada! Entre para começar.')
        navigate('/login', { replace: true })
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Cadastre-se em segundos"
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Nome" htmlFor="nome" error={errors.nome}>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
          />
        </Field>
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
          {loading ? 'Criando conta...' : 'Criar conta'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Seu acesso usa seu WhatsApp. Os dados ficam protegidos por criptografia.
        </p>
      </form>
    </AuthLayout>
  )
}
