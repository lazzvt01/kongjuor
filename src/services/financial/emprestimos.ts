import type {
  Emprestimo,
  FormaJurosParcelado,
  NovoEmprestimoInput,
  Pagamento,
  Parcela,
  Ciclo,
} from '@/types'
import {
  calcularJuros,
  criarCicloSaldoAberto,
  gerarParcelasAmortizacao,
  gerarParcelasJurosTotal,
  type CicloGerado,
  type ParcelaGerada,
} from './engine'
import { formatarMoeda } from './money'
import { formatarTaxaPercentual, PERIODICIDADE_CURTA } from './juros'
import { saldoDevedor } from './saldos'

export interface ResumoNovoEmprestimo {
  valorJuros: number
  valorTotal: number
  valorParcela: number | null
  primeiroVencimento: string
  ultimoVencimento: string
  quantidadeParcelas: number | null
  parcelas: ParcelaGerada[] | null
  ciclos: CicloGerado[] | null
  saldoDevedor: number
}

export function construirEmprestimo(input: NovoEmprestimoInput): {
  emprestimo: Omit<Emprestimo, 'id' | 'credor_id' | 'created_at' | 'updated_at'>
  parcelas: ParcelaGerada[] | null
  ciclos: CicloGerado[] | null
} {
  const intervalo = input.intervalo ?? 1
  let parcelas: ParcelaGerada[] | null = null
  let ciclos: CicloGerado[] | null = null
  let vencimento = input.data_vencimento
  let quantidadeParcelas: number | null = null
  let saldoDevedorFinal: number | null = null
  let saldoAtual: number
  let valorTotal: number

  if (input.tipo === 'parcelado') {
    const forma = input.forma_juros ?? 'total'
    const qtd = input.quantidade_parcelas ?? 1
    if (forma === 'periodico') {
      parcelas = gerarParcelasAmortizacao(
        input.valor_principal,
        input.juros_tipo,
        input.juros_valor,
        qtd,
        input.data_vencimento,
        input.juros_periodicidade,
        intervalo,
      )
    } else {
      parcelas = gerarParcelasJurosTotal(
        input.valor_principal,
        input.juros_tipo,
        input.juros_valor,
        qtd,
        input.data_vencimento,
        input.juros_periodicidade,
        intervalo,
      )
    }
    quantidadeParcelas = qtd
    vencimento = parcelas[parcelas.length - 1]?.data_vencimento ?? input.data_vencimento
    valorTotal = parcelas.reduce((acc, p) => acc + p.valor_total, 0)
    saldoAtual = valorTotal
    saldoDevedorFinal = valorTotal
  } else {
    const juros = calcularJuros(input.valor_principal, input.juros_tipo, input.juros_valor)
    valorTotal = input.valor_principal + juros
    saldoAtual = valorTotal
    saldoDevedorFinal = input.valor_principal
    ciclos = [
      criarCicloSaldoAberto(
        input.valor_principal,
        input.juros_tipo,
        input.juros_valor,
        input.data_inicio,
        input.data_vencimento,
        1,
      ),
    ]
  }

  const emprestimo: Omit<Emprestimo, 'id' | 'credor_id' | 'created_at' | 'updated_at'> = {
    cliente_id: input.cliente_id,
    tipo: input.tipo,
    forma_juros: input.tipo === 'parcelado' ? (input.forma_juros ?? 'total') : null,
    valor_principal: input.valor_principal,
    juros_tipo: input.juros_tipo,
    juros_valor: input.juros_valor,
    juros_periodicidade: input.juros_periodicidade,
    intervalo,
    data_inicio: input.data_inicio,
    data_vencimento: vencimento,
    valor_total: valorTotal,
    saldo_atual: saldoAtual,
    saldo_devedor: saldoDevedorFinal,
    deixou_garantia: input.deixou_garantia ?? false,
    garantia: input.garantia?.trim() || null,
    status: 'ativo',
    quantidade_parcelas: quantidadeParcelas,
    ciclo_atual: 1,
    numero: null,
  }

  return { emprestimo, parcelas, ciclos }
}

export function resumoNovoEmprestimo(input: NovoEmprestimoInput): ResumoNovoEmprestimo {
  const { emprestimo, parcelas, ciclos } = construirEmprestimo(input)
  const valorJuros = calcularJuros(input.valor_principal, input.juros_tipo, input.juros_valor)
  const primeiroVencimento =
    parcelas?.[0]?.data_vencimento ?? ciclos?.[0]?.data_vencimento ?? input.data_vencimento
  const ultimoVencimento =
    parcelas?.[parcelas.length - 1]?.data_vencimento ?? primeiroVencimento
  return {
    valorJuros,
    valorTotal: emprestimo.valor_total,
    valorParcela: parcelas?.[0]?.valor_total ?? null,
    primeiroVencimento,
    ultimoVencimento,
    quantidadeParcelas: emprestimo.quantidade_parcelas,
    parcelas,
    ciclos,
    saldoDevedor: emprestimo.saldo_devedor ?? 0,
  }
}

export function numeroEmprestimo(emprestimo: Pick<Emprestimo, 'numero'>): string | null {
  if (emprestimo.numero == null) return null
  return `#${String(emprestimo.numero).padStart(4, '0')}`
}

export function jurosDevidos(
  emprestimo: Pick<Emprestimo, 'tipo' | 'saldo_atual' | 'saldo_devedor' | 'valor_principal'>,
): number {
  if (emprestimo.tipo === 'parcelado') return 0
  return Math.max(0, emprestimo.saldo_atual - saldoDevedor(emprestimo))
}

export function jurosDoPeriodo(
  emprestimo: Pick<Emprestimo, 'tipo' | 'saldo_atual' | 'saldo_devedor' | 'valor_principal'>,
): number {
  return jurosDevidos(emprestimo)
}

export function jurosRecebidos(
  emprestimo: Pick<Emprestimo, 'tipo' | 'saldo_atual' | 'saldo_devedor' | 'valor_principal' | 'valor_total'>,
  pagamentos: Pick<Pagamento, 'valor'>[],
  parcelas?: Pick<Parcela, 'valor_total' | 'valor_juros' | 'valor_pago'>[],
  ciclos?: Pick<Ciclo, 'juros_pago'>[],
): number {
  if (emprestimo.tipo === 'parcelado') {
    if (parcelas) {
      return parcelas.reduce((acc, parc) => {
        if (parc.valor_pago <= 0) return acc
        if (parc.valor_pago >= parc.valor_total) return acc + parc.valor_juros
        return acc + Math.round(parc.valor_juros * (parc.valor_pago / Math.max(1, parc.valor_total)))
      }, 0)
    }
    const totalJuros = Math.max(0, emprestimo.valor_total - emprestimo.valor_principal)
    if (totalJuros <= 0) return 0
    return pagamentos.reduce(
      (acc, p) => acc + Math.round(totalJuros * (p.valor / Math.max(1, emprestimo.valor_total))),
      0,
    )
  }
  if (ciclos && ciclos.length > 0) {
    return ciclos.reduce((acc, c) => acc + (c.juros_pago ?? 0), 0)
  }
  const recebido = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const principalDevolvido = emprestimo.valor_principal - saldoDevedor(emprestimo)
  return Math.max(0, recebido - principalDevolvido)
}

export interface DetalhesJuros {
  valorPego: number
  juros: number
  jurosLabel: string
}

export function detalhesJuros(
  emprestimo: Pick<
    Emprestimo,
    | 'tipo'
    | 'forma_juros'
    | 'valor_total'
    | 'valor_principal'
    | 'saldo_atual'
    | 'saldo_devedor'
    | 'juros_tipo'
    | 'juros_valor'
    | 'juros_periodicidade'
    | 'intervalo'
  >,
): DetalhesJuros {
  const totalJuros = Math.max(0, emprestimo.valor_total - emprestimo.valor_principal)
  const jurosLabel =
    emprestimo.juros_tipo === 'percentual'
      ? `${formatarTaxaPercentual(emprestimo.juros_valor)}% ${PERIODICIDADE_CURTA[emprestimo.juros_periodicidade]}`
      : `${formatarMoeda(totalJuros)} fixo`

  if (emprestimo.tipo === 'parcelado') {
    if (emprestimo.forma_juros === 'periodico') {
      const juros = Math.max(0, emprestimo.valor_total - emprestimo.valor_principal)
      return { valorPego: emprestimo.saldo_atual - juros, juros, jurosLabel }
    }
    const proporcao = emprestimo.valor_total > 0 ? emprestimo.saldo_atual / emprestimo.valor_total : 0
    const juros = Math.round(totalJuros * proporcao)
    return { valorPego: emprestimo.saldo_atual - juros, juros, jurosLabel }
  }
  const devedor = saldoDevedor(emprestimo)
  const juros = Math.max(0, emprestimo.saldo_atual - devedor)
  return { valorPego: Math.min(devedor, emprestimo.saldo_atual), juros, jurosLabel }
}

export function tipoLabel(tipo: Emprestimo['tipo']): string {
  return tipo === 'parcelado' ? 'Parcelado' : 'Saldo aberto'
}

export function formaJurosLabel(forma: FormaJurosParcelado | null | undefined): string {
  if (forma === 'periodico') return 'Juros periódico / amortização'
  if (forma === 'total') return 'Juros total'
  return 'Saldo aberto / ciclos'
}

export interface DetalhesParcelado {
  totalParcelas: number
  parcelaAtual: number | null
  valorSemJuros: number
  formaJuros: FormaJurosParcelado | null
  jurosLabel: string
  valorJurosTotal: number
}

export function detalhesParcelado(
  emprestimo: Pick<
    Emprestimo,
    | 'tipo'
    | 'forma_juros'
    | 'quantidade_parcelas'
    | 'valor_principal'
    | 'valor_total'
    | 'juros_tipo'
    | 'juros_valor'
    | 'juros_periodicidade'
  >,
  parcelas: Pick<Parcela, 'numero' | 'saldo'>[] = [],
): DetalhesParcelado {
  const totalParcelas = emprestimo.quantidade_parcelas ?? parcelas.length
  const aberta = [...parcelas].sort((a, b) => a.numero - b.numero).find((p) => p.saldo > 0)
  return {
    totalParcelas,
    parcelaAtual: aberta?.numero ?? (totalParcelas > 0 ? totalParcelas : null),
    valorSemJuros: emprestimo.valor_principal,
    formaJuros: emprestimo.forma_juros,
    jurosLabel:
      emprestimo.juros_tipo === 'percentual'
        ? `${formatarTaxaPercentual(emprestimo.juros_valor)}% ${PERIODICIDADE_CURTA[emprestimo.juros_periodicidade]}`
        : `${formatarMoeda(emprestimo.juros_valor)} fixo`,
    valorJurosTotal: Math.max(0, emprestimo.valor_total - emprestimo.valor_principal),
  }
}
