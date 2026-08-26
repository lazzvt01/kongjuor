import { useCallback, useEffect, useState } from 'react'

import { obterCliente } from '@/services/api/clientes'
import { listarCiclosDoCredor } from '@/services/api/ciclos'
import { listarEmprestimosPorCliente, listarParcelasDoCredor } from '@/services/api/emprestimos'
import { listarPagamentosDoCliente } from '@/services/api/pagamentos'
import { listarHistoricoScore } from '@/services/api/score'
import { resumoCliente } from '@/services/financial/resumo'
import type { Ciclo, Cliente, Emprestimo, Pagamento, Parcela, ScoreHistorico } from '@/types'

export interface ClientePerfilData {
  cliente: Cliente
  emprestimos: Emprestimo[]
  pagamentos: Pagamento[]
  ciclos: Ciclo[]
  parcelas: Parcela[]
  scoreHistorico: ScoreHistorico[]
  resumo: ReturnType<typeof resumoCliente>
}

export function useClientePerfil(id: string | undefined) {
  const [data, setData] = useState<ClientePerfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [cliente, emprestimos, pagamentos, ciclosCredor, parcelasCredor, scoreHistorico] =
        await Promise.all([
          obterCliente(id),
          listarEmprestimosPorCliente(id),
          listarPagamentosDoCliente(id),
          listarCiclosDoCredor(),
          listarParcelasDoCredor(),
          listarHistoricoScore(id),
        ])
      if (!cliente) {
        setError('Cliente não encontrado')
        setLoading(false)
        return
      }
      const emprestimoIds = new Set(emprestimos.map((e) => e.id))
      const ciclos = ciclosCredor.filter((c) => emprestimoIds.has(c.emprestimo_id))
      const parcelas = parcelasCredor.filter((p) => emprestimoIds.has(p.emprestimo_id))
      setData({
        cliente,
        emprestimos,
        pagamentos,
        ciclos,
        parcelas,
        scoreHistorico,
        resumo: resumoCliente(emprestimos, pagamentos, ciclos, parcelas),
      })
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
