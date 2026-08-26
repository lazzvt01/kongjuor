import { useState } from 'react'

import { Field } from '@/components/shared/Field'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { validarNome, validarWhatsappCampo } from '@/lib/validations'

interface ClienteFormValues {
  nome: string
  whatsapp: string
  cpf: string
  endereco: string
  cidade: string
  data_nascimento: string
  observacoes: string
}

interface ClienteFormProps {
  initial?: Partial<ClienteFormValues>
  submitLabel: string
  onSubmit: (values: ClienteFormValues) => Promise<void>
  submitting: boolean
}

export function ClienteForm({ initial, submitLabel, onSubmit, submitting }: ClienteFormProps) {
  const [values, setValues] = useState<ClienteFormValues>({
    nome: initial?.nome ?? '',
    whatsapp: initial?.whatsapp ?? '',
    cpf: initial?.cpf ?? '',
    endereco: initial?.endereco ?? '',
    cidade: initial?.cidade ?? '',
    data_nascimento: initial?.data_nascimento ?? '',
    observacoes: initial?.observacoes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (key: keyof ClienteFormValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros: Record<string, string> = {}
    const nomeErr = validarNome(values.nome)
    if (nomeErr) erros.nome = nomeErr
    const whatsErr = validarWhatsappCampo(values.whatsapp)
    if (whatsErr) erros.whatsapp = whatsErr
    setErrors(erros)
    if (Object.keys(erros).length > 0) return
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome *" htmlFor="nome" error={errors.nome}>
        <Input
          id="nome"
          value={values.nome}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder="Nome do cliente"
        />
      </Field>
      <Field
        label="WhatsApp"
        htmlFor="whatsapp"
        error={errors.whatsapp}
        hint="Opcional, mas recomendado"
      >
        <PhoneInput id="whatsapp" value={values.whatsapp} onChange={set('whatsapp')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CPF" htmlFor="cpf">
          <Input
            id="cpf"
            value={values.cpf}
            onChange={(e) => set('cpf')(e.target.value)}
            placeholder="000.000.000-00"
          />
        </Field>
        <Field label="Cidade" htmlFor="cidade">
          <Input
            id="cidade"
            value={values.cidade}
            onChange={(e) => set('cidade')(e.target.value)}
            placeholder="Cidade"
          />
        </Field>
      </div>

      <Field label="Endereço" htmlFor="endereco">
        <Input
          id="endereco"
          value={values.endereco}
          onChange={(e) => set('endereco')(e.target.value)}
          placeholder="Endereço completo"
        />
      </Field>

      <Field label="Data de nascimento" htmlFor="data_nascimento">
        <Input
          id="data_nascimento"
          type="date"
          value={values.data_nascimento}
          onChange={(e) => set('data_nascimento')(e.target.value)}
        />
      </Field>

      <Field label="Observações" htmlFor="observacoes">
        <Textarea
          id="observacoes"
          value={values.observacoes}
          onChange={(e) => set('observacoes')(e.target.value)}
          placeholder="Anotações sobre o cliente"
          rows={3}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  )
}
