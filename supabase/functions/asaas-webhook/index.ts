// Edge Function: asaas-webhook
// Chamada pela Asaas. Idempotente. Atualiza o status da assinatura
// conforme o evento recebido.
//
// Deploy:
//   supabase functions deploy asaas-webhook --no-verify-jwt
//   Asaas -> Webhooks -> URL: https://<proj>.supabase.co/functions/v1/asaas-webhook
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  const headerToken = req.headers.get('x-webhook-token') ?? ''
  if (WEBHOOK_TOKEN && headerToken !== WEBHOOK_TOKEN) {
    return json({ error: 'Não autorizado' }, 401)
  }

  let body: {
    event?: string
    payment?: { subscription?: string | null; dueDate?: string | null; nextDueDate?: string | null }
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const subscriptionId = body.payment?.subscription
  if (!subscriptionId) {
    return json({ ok: true })
  }

  const event = body.event ?? ''
  let novoStatus: string | null = null
  let novaCobranca: string | null = null

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    novoStatus = 'ativa'
    novaCobranca = body.payment?.nextDueDate ?? body.payment?.dueDate ?? null
  } else if (event === 'PAYMENT_OVERDUE') {
    novoStatus = 'atrasada'
  } else if (event === 'SUBSCRIPTION_CANCELLED') {
    novoStatus = 'cancelada'
  }

  if (!novoStatus) {
    return json({ ok: true })
  }

  const updates: Record<string, unknown> = { status: novoStatus }
  if (novaCobranca) updates.data_proxima_cobranca = novaCobranca

  const { error } = await supabase
    .from('assinaturas')
    .update(updates)
    .eq('asaas_subscription_id', subscriptionId)

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true })
})
