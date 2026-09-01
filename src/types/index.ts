export interface Profile {
  id: string
  nome: string
  email: string
  whatsapp: string | null
  whatsapp_normalizado: string | null
  cpf_cnpj: string | null
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  credor_id: string
  nome: string
  whatsapp: string | null
  whatsapp_normalizado: string | null
  cpf: string | null
  endereco: string | null
  cidade: string | null
  data_nascimento: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type TipoEmprestimo = 'parcelado' | 'saldo_aberto'

export type FormaJurosParcelado = 'total' | 'periodico'

export type OperacaoPagamento = 'padrao' | 'juros' | 'juros_abate' | 'quitar'

export type JurosTipo = 'percentual' | 'fixo'

export type JurosPeriodicidade = 'diario' | 'semanal' | 'mensal'

export type StatusEmprestimo =
  | 'ativo'
  | 'em_dia'
  | 'vence_hoje'
  | 'atrasado'
  | 'quitado'
  | 'renovado'

export type StatusParcela =
  | 'pendente'
  | 'vence_hoje'
  | 'atrasado'
  | 'parcial'
  | 'pago'
  | 'quitado'

export type FormaPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'outro'

export interface Emprestimo {
  id: string
  credor_id: string
  cliente_id: string
  tipo: TipoEmprestimo
  forma_juros: FormaJurosParcelado | null
  valor_principal: number
  juros_tipo: JurosTipo
  juros_valor: number
  juros_periodicidade: JurosPeriodicidade
  intervalo: number
  data_inicio: string
  data_vencimento: string
  valor_total: number
  saldo_atual: number
  saldo_devedor: number | null
  deixou_garantia: boolean
  garantia: string | null
  observacao: string | null
  status: StatusEmprestimo
  quantidade_parcelas: number | null
  ciclo_atual: number
  numero: number | null
  created_at: string
  updated_at: string
}

export interface Parcela {
  id: string
  credor_id: string
  emprestimo_id: string
  numero: number
  data_vencimento: string
  valor_principal: number
  valor_juros: number
  valor_total: number
  valor_pago: number
  saldo: number
  status: StatusParcela
}

export interface Pagamento {
  id: string
  credor_id: string
  cliente_id: string
  emprestimo_id: string
  parcela_id: string | null
  valor: number
  forma_pagamento: FormaPagamento
  data_pagamento: string
  observacao: string | null
  created_at: string
}

export interface Renovacao {
  id: string
  credor_id: string
  emprestimo_id: string
  data_renovacao: string
  ciclo_anterior: number
  juros_pago: number
  capital_renovado: number
  novo_vencimento: string
  observacao: string | null
  created_at: string
}

export type StatusCiclo = 'aberto' | 'encerrado'

export interface Ciclo {
  id: string
  credor_id: string
  emprestimo_id: string
  numero_ciclo: number
  saldo_principal_inicial: number
  juros_calculado: number
  juros_renegociado: number | null
  juros_devido: number
  juros_pago: number
  principal_abatido: number
  valor_pago: number
  data_inicio: string
  data_vencimento: string
  data_encerramento: string | null
  status: StatusCiclo
  created_at: string
  updated_at: string
}

export interface ScoreHistorico {
  id: string
  credor_id: string
  cliente_id: string
  score: number
  motivo: string | null
  created_at: string
}

export interface NovoClienteInput {
  nome: string
  whatsapp?: string
  cpf?: string
  endereco?: string
  cidade?: string
  data_nascimento?: string
  observacoes?: string
}

export interface AtualizarClienteInput extends NovoClienteInput {}

export interface NovoEmprestimoInput {
  cliente_id: string
  tipo: TipoEmprestimo
  forma_juros?: FormaJurosParcelado | null
  valor_principal: number
  juros_tipo: JurosTipo
  juros_valor: number
  juros_periodicidade: JurosPeriodicidade
  intervalo?: number
  data_inicio: string
  data_vencimento: string
  quantidade_parcelas?: number
  deixou_garantia?: boolean
  garantia?: string
  observacao?: string
}

export interface NovoPagamentoInput {
  emprestimo_id: string
  cliente_id: string
  parcela_id?: string | null
  valor: number
  forma_pagamento: FormaPagamento
  data_pagamento: string
  operacao?: OperacaoPagamento
  observacao?: string
}

export interface NovaRenovacaoInput {
  emprestimo_id: string
  juros_pago: number
  capital_renovado: number
  novo_vencimento: string
  juros_tipo: JurosTipo
  juros_valor: number
  juros_periodicidade: JurosPeriodicidade
  observacao?: string
}

export type ScoreClassificacao = 'excelente' | 'bom' | 'regular' | 'ruim'

export type CodigoPlano = 'free' | 'basico' | 'pro' | 'pro_max'

export interface Plano {
  codigo: CodigoPlano
  nome: string
  preco_mensal: number
  limite_ativos: number | null
  descricao: string
  destaque: boolean
  ativo: boolean
}

export type StatusAssinatura = 'ativa' | 'pendente' | 'atrasada' | 'cancelada'

export interface Assinatura {
  id: string
  credor_id: string
  plano_codigo: CodigoPlano
  status: StatusAssinatura
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  data_proxima_cobranca: string | null
  data_inicio: string
  data_cancelamento: string | null
  created_at: string
  updated_at: string
}

export interface ResumoPlano {
  codigo: CodigoPlano
  nome: string
  preco_mensal: number
  limite_ativos: number | null
  ativos: number
  restantes: number | null
}

export interface CheckoutPix {
  encodedImage: string
  payload: string
}

export interface CheckoutResult {
  ok: boolean
  status?: string
  plano?: CodigoPlano
  asaas_subscription_id?: string
  pix?: CheckoutPix | null
  error?: string
}
