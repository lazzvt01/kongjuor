import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ClienteForm } from '@/components/clientes/ClienteForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { criarCliente } from '@/services/api/clientes'

export function NovoCliente() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (values: {
    nome: string
    whatsapp: string
    cpf: string
    endereco: string
    cidade: string
    data_nascimento: string
    observacoes: string
  }) => {
    setSubmitting(true)
    try {
      const cliente = await criarCliente(values)
      toast.success('Cliente criado com sucesso!')
      navigate(`/clientes/${cliente.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Novo cliente" subtitle="Apenas o nome é obrigatório" backTo="/clientes" />
      <ClienteForm submitLabel="Cadastrar cliente" onSubmit={handleSubmit} submitting={submitting} />
    </div>
  )
}
