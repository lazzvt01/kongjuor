import { useCallback, useEffect, useState } from 'react'

import { listarClientes } from '@/services/api/clientes'
import { listarEmprestimos, listarParcelasDoCredor } from '@/services/api/emprestimos'
import { listarScoresAtuais } from '@/services/api/score'
import type { ScoreClassificacao, Cliente, Emprestimo, Parcela } from '@/types'

export interface EmprestimoComCliente extends Emprestimo {
  cliente?: Cliente
  score: number
  classificacao: ScoreClassificacao
  parcelas: Parcela[]
}

export function useEmprestimosComCliente() {
  const [items, setItems] = useState<EmprestimoComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [emprestimos, clientes, scores, parcelas] = await Promise.all([
        listarEmprestimos(),
        listarClientes(),
        listarScoresAtuais(),
        listarParcelasDoCredor(),
      ])
      const mapa = new Map(clientes.map((c) => [c.id, c]))
      const parcelasPorEmprestimo = new Map<string, Parcela[]>()
      for (const p of parcelas) {
        const arr = parcelasPorEmprestimo.get(p.emprestimo_id) ?? []
        arr.push(p)
        parcelasPorEmprestimo.set(p.emprestimo_id, arr)
      }
      setItems(
        emprestimos.map((e) => ({
          ...e,
          cliente: mapa.get(e.cliente_id),
          score: scores.get(e.cliente_id)?.score ?? 0,
          classificacao: scores.get(e.cliente_id)?.classificacao ?? 'regular',
          parcelas: parcelasPorEmprestimo.get(e.id) ?? [],
        })),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, refresh: load }
}
