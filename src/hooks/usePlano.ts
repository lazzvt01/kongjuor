import { useCallback, useEffect, useState } from 'react'

import { obterResumoPlano } from '@/services/api/planos'
import type { ResumoPlano } from '@/types'

export function usePlano() {
  const [resumo, setResumo] = useState<ResumoPlano | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await obterResumoPlano()
      setResumo(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const limiteAtingido =
    resumo !== null && resumo.limite_ativos !== null && resumo.ativos >= resumo.limite_ativos

  return {
    resumo,
    limiteAtingido,
    loading,
    error,
    refresh: load,
  }
}
