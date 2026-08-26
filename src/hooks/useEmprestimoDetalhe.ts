import { useCallback, useEffect, useState } from 'react'

import { obterCliente } from '@/services/api/clientes'
import { listarCiclos } from '@/services/api/ciclos'
import { obterEmprestimo, listarParcelas } from '@/services/api/emprestimos'
import { listarPagamentos } from '@/services/api/pagamentos'
import type { Ciclo, Cliente, Emprestimo, Pagamento, Parcela } from '@/types'

export interface EmprestimoDetalheData {
  emprestimo: Emprestimo
  cliente: Cliente
  parcelas: Parcela[]
  pagamentos: Pagamento[]
  ciclos: Ciclo[]
}

export function useEmprestimoDetalhe(id: string | undefined) {
  const [data, setData] = useState<EmprestimoDetalheData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [emprestimo, parcelas, pagamentos, ciclos] = await Promise.all([
        obterEmprestimo(id),
        listarParcelas(id),
        listarPagamentos(id),
        listarCiclos(id),
      ])
      if (!emprestimo) {
        setError('Empréstimo não encontrado')
        setLoading(false)
        return
      }
      const cliente = await obterCliente(emprestimo.cliente_id)
      if (!cliente) {
        setError('Cliente não encontrado')
        setLoading(false)
        return
      }
      setData({ emprestimo, cliente, parcelas, pagamentos, ciclos })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, refresh: load }
}
