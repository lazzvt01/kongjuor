import type { JurosPeriodicidade, JurosTipo } from '@/types'
import { proximaDataPeriodica } from './datas'
import { arredondarCentavos } from './money'

export interface ParcelaGerada {
  numero: number
  data_vencimento: string
  valor_total: number
  valor_principal: number
  valor_juros: number
}

export interface CicloGerado {
  numero_ciclo: number
  saldo_principal_inicial: number
  juros_calculado: number
  juros_devido: number
  data_inicio: string
  data_vencimento: string
  status: 'aberto'
}

export function calcularJuros(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
): number {
  if (jurosTipo === 'percentual') {
    return arredondarCentavos(valorPrincipal * (jurosValor / 10000))
  }
  return jurosValor
}

export function calcularTotal(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
): number {
  return valorPrincipal + calcularJuros(valorPrincipal, jurosTipo, jurosValor)
}

function calcularParcelaBase(
  valorTotal: number,
  quantidadeParcelas: number,
): { base: number; primeira: number; quantidadePrimeiras: number } {
  const base = Math.floor(valorTotal / quantidadeParcelas)
  const resto = valorTotal - base * quantidadeParcelas
  return { base, primeira: base + 1, quantidadePrimeiras: resto }
}

export function taxaPercentual(jurosValor: number): number {
  return jurosValor / 10000
}

export function calcularParcelaAnnuity(valorPrincipal: number, taxa: number, quantidade: number): number {
  if (taxa <= 0) return Math.round(valorPrincipal / quantidade)
  if (quantidade <= 1) return valorPrincipal
  return Math.round((valorPrincipal * taxa) / (1 - Math.pow(1 + taxa, -quantidade)))
}

export function gerarParcelasJurosTotal(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
  quantidade: number,
  primeiroVencimento: string,
  periodicidade: JurosPeriodicidade,
  intervalo: number,
): ParcelaGerada[] {
  const valorTotal = calcularTotal(valorPrincipal, jurosTipo, jurosValor)
  const { base, primeira, quantidadePrimeiras } = calcularParcelaBase(valorTotal, quantidade)

  const parcelas: ParcelaGerada[] = []
  let data = primeiroVencimento
  for (let i = 0; i < quantidade; i++) {
    const valor = i < quantidadePrimeiras ? primeira : base
    const proporcao = valorTotal > 0 ? valor / valorTotal : 0
    const valorPrincipalParcela = Math.round(valorPrincipal * proporcao)
    parcelas.push({
      numero: i + 1,
      data_vencimento: data,
      valor_total: valor,
      valor_principal: valorPrincipalParcela,
      valor_juros: valor - valorPrincipalParcela,
    })
    data = proximaDataPeriodica(data, periodicidade, intervalo)
  }
  return parcelas
}

export function gerarParcelasAmortizacao(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
  quantidade: number,
  primeiroVencimento: string,
  periodicidade: JurosPeriodicidade,
  intervalo: number,
): ParcelaGerada[] {
  let saldo = valorPrincipal
  let data = primeiroVencimento
  const parcelas: ParcelaGerada[] = []

  if (jurosTipo === 'percentual') {
    const taxa = taxaPercentual(jurosValor)
    const parcela = calcularParcelaAnnuity(valorPrincipal, taxa, quantidade)
    for (let i = 1; i <= quantidade; i++) {
      const juros = arredondarCentavos(saldo * taxa)
      const isUltima = i === quantidade
      const amortizacao = isUltima ? saldo : Math.max(0, parcela - juros)
      const valorTotal = isUltima ? saldo + juros : parcela
      parcelas.push({
        numero: i,
        data_vencimento: data,
        valor_total: valorTotal,
        valor_principal: amortizacao,
        valor_juros: juros,
      })
      saldo -= amortizacao
      data = proximaDataPeriodica(data, periodicidade, intervalo)
    }
  } else {
    const base = Math.floor(valorPrincipal / quantidade)
    const resto = valorPrincipal - base * quantidade
    let principalAcumulado = 0
    for (let i = 1; i <= quantidade; i++) {
      const isUltima = i === quantidade
      const amortizacao = isUltima
        ? valorPrincipal - principalAcumulado
        : i <= resto
          ? base + 1
          : base
      const juros = jurosValor
      parcelas.push({
        numero: i,
        data_vencimento: data,
        valor_total: amortizacao + juros,
        valor_principal: amortizacao,
        valor_juros: juros,
      })
      principalAcumulado += amortizacao
      saldo -= amortizacao
      data = proximaDataPeriodica(data, periodicidade, intervalo)
    }
  }
  return parcelas
}

export function criarCicloSaldoAberto(
  valorPrincipal: number,
  jurosTipo: JurosTipo,
  jurosValor: number,
  dataInicio: string,
  dataVencimento: string,
  numeroCiclo: number,
): CicloGerado {
  const juros = calcularJuros(valorPrincipal, jurosTipo, jurosValor)
  return {
    numero_ciclo: numeroCiclo,
    saldo_principal_inicial: valorPrincipal,
    juros_calculado: juros,
    juros_devido: juros,
    data_inicio: dataInicio,
    data_vencimento: dataVencimento,
    status: 'aberto',
  }
}
