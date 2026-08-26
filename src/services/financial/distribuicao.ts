export interface DistribuicaoResultado {
  jurosAnterioresPago: number
  jurosAtualPago: number
  principalAbatido: number
  resto: number
}

export interface CicloParaDistribuicao {
  status: 'aberto' | 'encerrado'
  juros_devido: number
  juros_pago: number
}

export function distribuirPagamento(
  valor: number,
  jurosDevidosAnteriores: number,
  jurosDevidosCicloAtual: number,
  saldoPrincipal: number,
): DistribuicaoResultado {
  let resto = Math.max(0, valor)
  const jurosAnterioresPago = Math.min(resto, jurosDevidosAnteriores)
  resto -= jurosAnterioresPago
  const jurosAtualPago = Math.min(resto, jurosDevidosCicloAtual)
  resto -= jurosAtualPago
  const principalAbatido = Math.min(resto, saldoPrincipal)
  return {
    jurosAnterioresPago,
    jurosAtualPago,
    principalAbatido,
    resto: resto - principalAbatido,
  }
}

export function calcularJurosDevidosCiclos(ciclos: CicloParaDistribuicao[]): {
  anteriores: number
  atual: number
} {
  let anteriores = 0
  let atual = 0
  for (const ciclo of ciclos) {
    const pendente = ciclo.juros_devido - ciclo.juros_pago
    if (ciclo.status === 'aberto') atual += Math.max(0, pendente)
    else anteriores += Math.max(0, pendente)
  }
  return { anteriores, atual }
}
