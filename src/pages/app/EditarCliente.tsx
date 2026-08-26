import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ClienteForm } from '@/components/clientes/ClienteForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { obterCliente, atualizarCliente } from '@/services/api/clientes'

export function EditarCliente() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [initial, setInitial] = useState<Record<string, string> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    obterCliente(id).then((c) => {
      if (!c) {
        navigate('/clientes', { replace: true })
        return
      }
      setInitial({
        nome: c.nome,
        whatsapp: c.whatsapp ?? '',
        cpf: c.cpf ?? '',
        endereco: c.endereco ?? '',
        cidade: c.cidade ?? '',
        data_nascimento: c.data_nascimento ?? '',
        observacoes: c.observacoes ?? '',
      })
    })
  }, [id, navigate])

  const handleSubmit = async (values: {
    nome: string
    whatsapp: string
    cpf: string
    endereco: string
    cidade: string
    data_nascimento: string
    observacoes: string
  }) => {
    if (!id) return
    setSubmitting(true)
    try {
      await atualizarCliente(id, values)
      toast.success('Cliente atualizado!')
      navigate(`/clientes/${id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Editar cliente" backTo={id ? `/clientes/${id}` : '/clientes'} />
      {!initial ? (
        <div className="space-y-4">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : (
        <ClienteForm
          initial={initial}
          submitLabel="Salvar alterações"
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  )
}
