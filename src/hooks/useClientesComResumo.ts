import { useCallback, useEffect, useState } from 'react'

import { listarClientes } from '@/services/api/clientes'
import { listarEmprestimos } from '@/services/api/emprestimos'
import { listarScoresAtuais } from '@/services/api/score'
import { diasAtraso, hojeISO } from '@/services/financial'
import type { ScoreClassificacao, Cliente } from '@/types'

export interface ClienteResumo extends Cliente {
  valorEmAberto: number
  totalEmprestado: number
  emprestimosAtivos: number
  score: number
  classificacao: ScoreClassificacao
  atrasos: number
  proximoVencimento: string | null
}

export function useClientesComResumo() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lista, emprestimos, scores] = await Promise.all([
        listarClientes(),
        listarEmprestimos(),
        listarScoresAtuais(),
      ])
      const porCliente = new Map<Cliente['id'], ClienteResumo>()

      for (const c of lista) {
        const doCliente = emprestimos.filter((e) => e.cliente_id === c.id)
        const ativos = doCliente.filter((e) => e.saldo_atual > 0)
        const emAberto = ativos.reduce((acc, e) => acc + e.saldo_atual, 0)
        const atrasos = ativos.filter((e) => diasAtraso(e.data_vencimento) > 0).length
        const proximos = ativos
          .map((e) => e.data_vencimento)
          .sort()
          .filter((d) => d >= hojeISO())
        porCliente.set(c.id, {
          ...c,
          valorEmAberto: emAberto,
          totalEmprestado: ativos.reduce((acc, e) => acc + e.valor_principal, 0),
          emprestimosAtivos: ativos.length,
          score: scores.get(c.id)?.score ?? 0,
          classificacao: scores.get(c.id)?.classificacao ?? 'regular',
          atrasos,
          proximoVencimento: proximos[0] ?? null,
        })
      }
      setClientes([...porCliente.values()])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { clientes, loading, error, refresh: load }
}
