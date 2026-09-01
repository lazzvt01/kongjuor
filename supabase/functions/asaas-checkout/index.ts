// Edge Function: asaas-checkout
// Autenticada via JWT do Supabase. Cria/atualiza assinatura Asaas e
// retorna o Pix da primeira cobrança (QR + copia-e-cola).
//
// Body:
//   { plano: 'basico'|'pro'|'pro_max', acao: 'assinar'|'cancelar', cpfCnpj?: string }
//
// Deploy:
//   supabase secrets set ASAAS_API_KEY=... ASAAS_API_URL=https://sandbox.asaas.com/api/v3
//   supabase functions deploy asaas-checkout --no-verify-jwt=false
import { createClient } from 'npm:@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''
const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? 'https://api.asaas.com/api/v3'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PLANOS_PAGOS = new Set(['basico', 'pro', 'pro_max'])

interface AsaasCustomer {
  id: string
}

interface AsaasSubscription {
  id: string
  status: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function asaasHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  }
}

async function getOrCreateCustomer(credorId: string, cpfCnpj?: string): Promise<string> {
  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('asaas_customer_id')
    .eq('credor_id', credorId)
    .maybeSingle()

  const doc = cpfCnpj?.replace(/[^0-9]/g, '')
  if (assinatura?.asaas_customer_id) {
    if (doc) {
      await fetch(`${ASAAS_API_URL}/customers/${assinatura.asaas_customer_id}`, {
        method: 'POST',
        headers: asaasHeaders(),
        body: JSON.stringify({ cpfCnpj: doc }),
      })
    }
    return assinatura.asaas_customer_id
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email, cpf_cnpj')
    .eq('id', credorId)
    .single()

  const body = {
    name: profile?.nome ?? 'Cliente KONGjuros',
    email: profile?.email ?? undefined,
    ...(doc ?? profile?.cpf_cnpj ? { cpfCnpj: doc ?? profile?.cpf_cnpj } : {}),
  }

  const res = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify(body),
  })
  const data: AsaasCustomer = await res.json()

  if (!res.ok) {
    throw new Error(`Falha ao criar customer Asaas: ${JSON.stringify(data)}`)
  }
  return data.id
}

async function getSubscription(id: string): Promise<AsaasSubscription | null> {
  const res = await fetch(`${ASAAS_API_URL}/subscriptions/${id}`, {
    headers: asaasHeaders(),
  })
  if (!res.ok) return null
  return res.json()
}

async function createSubscription(
  customerId: string,
  valueCents: number,
): Promise<{ id: string }> {
  const hoje = new Date()
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000)
  const nextDueDate = amanha.toISOString().slice(0, 10)

  const body = {
    customer: customerId,
    billingType: 'PIX',
    value: valueCents / 100,
    nextDueDate,
    cycle: 'MONTHLY',
    description: 'Assinatura KONGjuros',
  }

  const res = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify(body),
  })
  const data: AsaasSubscription = await res.json()

  if (!res.ok) {
    throw new Error(`Falha ao criar assinatura Asaas: ${JSON.stringify(data)}`)
  }
  return { id: data.id }
}

async function getPixQr(paymentId: string): Promise<{ encodedImage: string; payload: string }> {
  const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
    headers: asaasHeaders(),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao gerar Pix: ${JSON.stringify(data)}`)
  }
  return { encodedImage: data.encodedImage, payload: data.payload }
}

async function getFirstPendingPayment(subscriptionId: string): Promise<{ id: string; dueDate: string } | null> {
  const res = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments`, {
    headers: asaasHeaders(),
  })
  const data = await res.json()
  if (!res.ok) return null
  const pending = data.data?.find((p: { status: string }) =>
    ['PENDING', 'RECEIVED', 'CONFIRMED'].includes(p.status),
  )
  return pending ? { id: pending.id, dueDate: pending.dueDate } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return json({ error: 'Não autorizado' }, 401)
  }

  let body: { plano?: string; acao?: string; cpfCnpj?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const plano = body.plano ?? ''
  const acao = body.acao ?? 'assinar'

  const cpfCnpj = body.cpfCnpj?.replace(/[^0-9]/g, '') ?? ''
  if (cpfCnpj) {
    await supabase
      .from('profiles')
      .update({ cpf_cnpj: cpfCnpj })
      .eq('id', user.id)
  }

  if (acao === 'cancelar') {
    const { data: assinatura } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('credor_id', user.id)
      .maybeSingle()

    if (assinatura?.asaas_subscription_id) {
      await fetch(`${ASAAS_API_URL}/subscriptions/${assinatura.asaas_subscription_id}`, {
        method: 'DELETE',
        headers: asaasHeaders(),
      })
    }

    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert({
        credor_id: user.id,
        plano_codigo: assinatura?.plano_codigo ?? 'free',
        status: 'cancelada',
        data_cancelamento: new Date().toISOString().slice(0, 10),
        asaas_customer_id: assinatura?.asaas_customer_id ?? null,
        asaas_subscription_id: assinatura?.asaas_subscription_id ?? null,
      }, { onConflict: 'credor_id' })

    if (upsertError) {
      return json({ error: `Falha ao gravar cancelamento: ${upsertError.message}` }, 500)
    }
    return json({ ok: true, status: 'cancelada' })
  }

  if (!PLANOS_PAGOS.has(plano)) {
    return json({ error: 'Plano inválido' }, 400)
  }

  const { data: planoInfo } = await supabase
    .from('planos')
    .select('*')
    .eq('codigo', plano)
    .single()

  if (!planoInfo) {
    return json({ error: 'Plano não encontrado' }, 404)
  }

  try {
    const customerId = await getOrCreateCustomer(user.id, cpfCnpj)

    const { data: assinaturaAtual } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('credor_id', user.id)
      .maybeSingle()

    let subscriptionId = assinaturaAtual?.asaas_subscription_id ?? ''

    if (subscriptionId) {
      const asaasSub = await getSubscription(subscriptionId)
      if (asaasSub && asaasSub.status !== 'REMOVED') {
        await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
          method: 'POST',
          headers: asaasHeaders(),
          body: JSON.stringify({ value: planoInfo.preco_mensal / 100 }),
        })
      } else {
        const created = await createSubscription(customerId, planoInfo.preco_mensal)
        subscriptionId = created.id
      }
    } else {
      const created = await createSubscription(customerId, planoInfo.preco_mensal)
      subscriptionId = created.id
    }

    const payment = await getFirstPendingPayment(subscriptionId)
    let pix: { encodedImage: string; payload: string } | null = null
    if (payment) {
      pix = await getPixQr(payment.id)
    }

    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert({
        credor_id: user.id,
        plano_codigo: plano,
        status: 'pendente',
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        data_proxima_cobranca: payment?.dueDate ?? null,
        data_cancelamento: null,
      }, { onConflict: 'credor_id' })

    if (upsertError) {
      return json({ error: `Falha ao gravar assinatura: ${upsertError.message}` }, 500)
    }

    return json({
      ok: true,
      plano,
      asaas_subscription_id: subscriptionId,
      pix,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido no Asaas'
    return json({ error: msg }, 502)
  }
})
