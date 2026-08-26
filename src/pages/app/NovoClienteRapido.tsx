import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validarNome, validarWhatsappCampo } from '@/lib/validations'
import { criarCliente } from '@/services/api/clientes'

export function NovoClienteRapido() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    const nomeErr = validarNome(nome)
    if (nomeErr) erros.nome = nomeErr
    const whatsErr = validarWhatsappCampo(whatsapp)
    if (whatsErr) erros.whatsapp = whatsErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return

    setSubmitting(true)
    try {
      const cliente = await criarCliente({ nome, whatsapp })
      toast.success('Cliente cadastrado com sucesso!')
      navigate(`/emprestimos/novo/definir?cliente=${cliente.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo cliente"
        subtitle="Apenas o nome é obrigatório"
        backTo="/emprestimos/novo"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome *" htmlFor="nome" error={errors.nome}>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
            autoFocus
          />
        </Field>
        <Field
          label="WhatsApp"
          htmlFor="whatsapp"
          error={errors.whatsapp}
          hint="Opcional, mas recomendado"
        >
          <PhoneInput id="whatsapp" value={whatsapp} onChange={setWhatsapp} />
        </Field>

        <Button type="submit" size="xl" className="w-full" disabled={submitting}>
          {submitting ? 'Cadastrando...' : 'Continuar para o empréstimo'}
        </Button>
      </form>
    </div>
  )
}
