import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  calcularJuros,
  criarCicloSaldoAberto,
  gerarParcelasAmortizacao,
  gerarParcelasJurosTotal,
} from '@/services/financial/engine'
import { construirEmprestimo, resumoNovoEmprestimo, jurosDevidos, jurosRecebidos } from '@/services/financial/emprestimos'
import { distribuirPagamento, calcularJurosDevidosCiclos } from '@/services/financial/distribuicao'
import { saldoDevedor, principalAbatido } from '@/services/financial/saldos'
import { proximaDataPeriodica } from '@/services/financial/datas'
import type { Emprestimo, JurosTipo } from '@/types'

function soma(arr: { valor_total: number }[]): number {
  return arr.reduce((acc, p) => acc + p.valor_total, 0)
}

function somaPrincipal(arr: { valor_principal: number }[]): number {
  return arr.reduce((acc, p) => acc + p.valor_principal, 0)
}

function emprestimoSaldoAberto(parcial: Partial<Emprestimo> = {}): Emprestimo {
  return {
    id: 'e1',
    credor_id: 'c1',
    cliente_id: 'cl1',
    numero: null,
    tipo: 'saldo_aberto',
    forma_juros: null,
    valor_principal: 100000,
    juros_tipo: 'percentual',
    juros_valor: 1500,
    juros_periodicidade: 'mensal',
    intervalo: 1,
    data_inicio: '2026-01-01',
    data_vencimento: '2026-02-01',
    valor_total: 115000,
    saldo_atual: 115000,
    saldo_devedor: 100000,
    quantidade_parcelas: null,
    ciclo_atual: 1,
    status: 'ativo',
    deixou_garantia: false,
    garantia: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...parcial,
  }
}

describe('Motor financeiro — Juros total (parcelado)', () => {
  it('cenário 1: R$1.000 + R$800 fixo / 10 parcelas = R$180', () => {
    const parcelas = gerarParcelasJurosTotal(100000, 'fixo', 80000, 10, '2026-01-10', 'mensal', 1)
    assert.equal(parcelas.length, 10)
    assert.equal(soma(parcelas), 180000)
    assert.equal(parcelas[0].valor_total, 18000)
    assert.equal(parcelas[0].valor_principal, 10000)
    assert.equal(parcelas[0].valor_juros, 8000)
  })

  it('cenário 2: R$1.000 + 80% / 10 parcelas = R$180', () => {
    const parcelas = gerarParcelasJurosTotal(100000, 'percentual', 8000, 10, '2026-01-10', 'mensal', 1)
    assert.equal(parcelas.length, 10)
    assert.equal(soma(parcelas), 180000)
    assert.equal(parcelas[0].valor_total, 18000)
    assert.equal(parcelas[5].valor_total, 18000)
  })

  it('cenário 15a: arredondamento na última parcela (juros total)', () => {
    const parcelas = gerarParcelasJurosTotal(100000, 'percentual', 2500, 3, '2026-01-10', 'mensal', 1)
    assert.equal(soma(parcelas), 125000)
    assert.deepEqual(parcelas.map((p) => p.valor_total), [41667, 41667, 41666])
  })
})

describe('Motor financeiro — Amortização (parcelado, juros periódicos)', () => {
  it('cenário 3: R$1.000 + 10% a.m. / 10x ≈ R$162,75', () => {
    const parcelas = gerarParcelasAmortizacao(100000, 'percentual', 1000, 10, '2026-01-10', 'mensal', 1)
    assert.equal(parcelas.length, 10)
    assert.equal(parcelas[0].valor_total, 16275)
    assert.equal(parcelas[0].valor_juros, 10000)
    assert.equal(parcelas[0].valor_principal, 6275)
    assert.equal(somaPrincipal(parcelas), 100000)
  })

  it('cenário 12: juros periódico percentual decrescente sobre o saldo', () => {
    const parcelas = gerarParcelasAmortizacao(100000, 'percentual', 1000, 10, '2026-01-10', 'mensal', 1)
    assert.ok(parcelas[1].valor_juros < parcelas[0].valor_juros)
    assert.ok(parcelas[1].valor_principal > parcelas[0].valor_principal)
    assert.equal(parcelas[9].valor_total, parcelas[9].valor_principal + parcelas[9].valor_juros)
  })

  it('cenário 11: amortização com juros fixos por período', () => {
    const parcelas = gerarParcelasAmortizacao(100000, 'fixo', 5000, 10, '2026-01-10', 'mensal', 1)
    assert.equal(somaPrincipal(parcelas), 100000)
    for (const p of parcelas) {
      assert.equal(p.valor_juros, 5000)
      assert.equal(p.valor_total, p.valor_principal + 5000)
    }
    assert.equal(parcelas[0].valor_total, 15000)
  })

  it('cenário 15b: arredondamento de centavos na amortização fixa', () => {
    const parcelas = gerarParcelasAmortizacao(100001, 'fixo', 1, 3, '2026-01-10', 'mensal', 1)
    assert.equal(somaPrincipal(parcelas), 100001)
    assert.equal(parcelas[2].valor_principal, 100001 - 66668)
  })
})

describe('Motor financeiro — Saldo aberto por ciclos', () => {
  it('cenário 4: ciclo de 15% sobre R$1.000 gera R$150 de juros', () => {
    const ciclo = criarCicloSaldoAberto(100000, 'percentual', 1500, '2026-01-01', '2026-02-01', 1)
    assert.equal(ciclo.saldo_principal_inicial, 100000)
    assert.equal(ciclo.juros_calculado, 15000)
    assert.equal(ciclo.juros_devido, 15000)
    assert.equal(ciclo.numero_ciclo, 1)
    assert.equal(ciclo.status, 'aberto')
  })

  it('cenário 5: pagamento R$300 cobre juros (R$150) e abate principal (R$150)', () => {
    const r = distribuirPagamento(30000, 0, 15000, 100000)
    assert.equal(r.jurosAnterioresPago, 0)
    assert.equal(r.jurosAtualPago, 15000)
    assert.equal(r.principalAbatido, 15000)
    assert.equal(r.resto, 0)
    assert.equal(100000 - r.principalAbatido, 85000)
  })

  it('cenário 6: próximo ciclo calcula juros sobre o saldo reduzido (R$850 → 15% = R$127,50)', () => {
    const ciclo = criarCicloSaldoAberto(85000, 'percentual', 1500, '2026-03-01', '2026-04-01', 2)
    assert.equal(ciclo.saldo_principal_inicial, 85000)
    assert.equal(ciclo.juros_calculado, 12750)
  })

  it('cenário 7: pagamento menor que os juros NÃO abate principal', () => {
    const r = distribuirPagamento(5000, 0, 15000, 100000)
    assert.equal(r.jurosAtualPago, 5000)
    assert.equal(r.principalAbatido, 0)
    assert.equal(r.resto, 0)
  })

  it('cenário 8: atrasos de ciclos anteriores acumulam e são pagos primeiro', () => {
    const ciclos: Parameters<typeof calcularJurosDevidosCiclos>[0] = [
      { status: 'encerrado', juros_devido: 15000, juros_pago: 0 },
      { status: 'aberto', juros_devido: 15000, juros_pago: 0 },
    ]
    const pendentes = calcularJurosDevidosCiclos(ciclos)
    assert.deepEqual(pendentes, { anteriores: 15000, atual: 15000 })

    const r1 = distribuirPagamento(30000, pendentes.anteriores, pendentes.atual, 100000)
    assert.equal(r1.jurosAnterioresPago, 15000)
    assert.equal(r1.jurosAtualPago, 15000)
    assert.equal(r1.principalAbatido, 0)

    const r2 = distribuirPagamento(40000, 15000, 15000, 100000)
    assert.equal(r2.principalAbatido, 10000)
  })

  it('cenário 9: pagamento antecipado acima do devido abate tudo e gera troco', () => {
    const r = distribuirPagamento(140000, 15000, 15000, 100000)
    assert.equal(r.jurosAnterioresPago, 15000)
    assert.equal(r.jurosAtualPago, 15000)
    assert.equal(r.principalAbatido, 100000)
    assert.equal(r.resto, 10000)
  })

  it('cenário 10: renegociação mantém juros original e usa o renegociado como devido', () => {
    const ciclos: Parameters<typeof calcularJurosDevidosCiclos>[0] = [
      { status: 'aberto', juros_devido: 6000, juros_pago: 0 },
    ]
    const pendentes = calcularJurosDevidosCiclos(ciclos)
    assert.equal(pendentes.atual, 6000)
    assert.equal(pendentes.anteriores, 0)

    const emp = emprestimoSaldoAberto({ saldo_atual: 106000, saldo_devedor: 100000, valor_total: 106000 })
    assert.equal(jurosDevidos(emp), 6000)
  })

  it('cenário 14: quitação zera saldo devedor e saldo atual', () => {
    const emp = emprestimoSaldoAberto({ saldo_atual: 0, saldo_devedor: 0, valor_total: 0 })
    assert.equal(saldoDevedor(emp), 0)
    assert.equal(jurosDevidos(emp), 0)
    assert.equal(principalAbatido(emp), 100000)
  })

  it('cenário 14b: jurosRecebidos usa os ciclos no saldo aberto', () => {
    const emp = emprestimoSaldoAberto()
    const ciclos = [{ juros_pago: 15000 }, { juros_pago: 12750 }]
    assert.equal(jurosRecebidos(emp, [], undefined, ciclos), 27750)
  })
})

describe('Motor financeiro — Intervalos e simulação', () => {
  it('cenário 13a: intervalo diário/semanal/mensal', () => {
    assert.equal(proximaDataPeriodica('2026-01-10', 'diario', 5), '2026-01-15')
    assert.equal(proximaDataPeriodica('2026-01-10', 'semanal', 2), '2026-01-24')
    assert.equal(proximaDataPeriodica('2026-01-10', 'mensal', 3), '2026-04-10')
  })

  it('cenário 13b: intervalo 2 mensal espaça as parcelas', () => {
    const parcelas = gerarParcelasJurosTotal(100000, 'percentual', 8000, 3, '2026-01-10', 'mensal', 2)
    assert.deepEqual(
      parcelas.map((p) => p.data_vencimento),
      ['2026-01-10', '2026-03-10', '2026-05-10'],
    )
  })

  it('construirEmprestimo: saldo aberto mantém principal aberto e juros no saldo_atual', () => {
    const { emprestimo, ciclos } = construirEmprestimo({
      cliente_id: 'cl1',
      tipo: 'saldo_aberto',
      forma_juros: null,
      valor_principal: 100000,
      juros_tipo: 'percentual',
      juros_valor: 1500,
      juros_periodicidade: 'mensal',
      intervalo: 1,
      data_inicio: '2026-01-01',
      data_vencimento: '2026-02-01',
    })
    assert.equal(emprestimo.saldo_atual, 115000)
    assert.equal(emprestimo.saldo_devedor, 100000)
    assert.equal(ciclos?.length, 1)
    assert.equal(ciclos?.[0].juros_devido, 15000)
  })

  it('resumoNovoEmprestimo: simulação de parcela mensal do parcelado', () => {
    const resumo = resumoNovoEmprestimo({
      cliente_id: 'cl1',
      tipo: 'parcelado',
      forma_juros: 'total',
      valor_principal: 100000,
      juros_tipo: 'percentual',
      juros_valor: 8000,
      juros_periodicidade: 'mensal',
      intervalo: 1,
      data_inicio: '2026-01-01',
      data_vencimento: '2026-02-01',
      quantidade_parcelas: 10,
    })
    assert.equal(resumo.valorJuros, 80000)
    assert.equal(resumo.valorTotal, 180000)
    assert.equal(resumo.valorParcela, 18000)
    assert.equal(resumo.quantidadeParcelas, 10)
  })

  it('cenário de taxa fixa simples: calcularJuros percentual e fixo', () => {
    assert.equal(calcularJuros(100000, 'percentual' as JurosTipo, 1250), 12500)
    assert.equal(calcularJuros(100000, 'fixo' as JurosTipo, 50000), 50000)
  })
})
