# Planos de assinatura — Guia de deploy (KONGjuros)

Cobrança recorrente mensal via **Asaas (PIX)** com limite de empréstimos ativos
por plano. Abrange: migration SQL, Edge Functions (Supabase), secrets e
configuração do webhook no painel do Asaas.

## 1. Migration SQL (já aplicada)

Arquivo: `supabase/migrations/0005_planos.sql`

- Cria a tabela `planos` (catálogo: Free/Básico/Pro/Pro Max) com seed.
- Cria a tabela `assinaturas` (uma por credor) com RLS (leitura própria; escrita só via service role).
- Cria as funções `plano_atual(credor)` e `resumo_plano()`.
- Adiciona o enforcement de limite no RPC `criar_emprestimo`.

**A migration já foi aplicada na nuvem** (via pooler). Se você recriar o banco ou
mover o projeto, rode o arquivo inteiro no SQL Editor do Supabase.

Verificação rápida no SQL Editor:

```sql
select * from public.planos order by preco_mensal;
select public.plano_atual('<seu-uid>');
select * from public.resumo_plano();
```

## 2. Edge Functions

Arquivos em `supabase/functions/`:

- `asaas-checkout/` — cria/atualiza a assinatura Asaas e devolve o Pix (QR + copia-e-cola). Autenticada por JWT.
- `asaas-webhook/` — recebe os eventos da Asaas e atualiza o status da assinatura. Sem validação JWT (chamada pelo Asaas).
- `_shared/cors.ts` — headers CORS compartilhados.

### 2.1 Instalar o Supabase CLI

```bash
npm install -g supabase
```

### 2.2 Login e link do projeto

```bash
supabase login
supabase link --project-ref xhzcgllilfmhdlzsmgiv
```

### 2.3 Secrets

As secrets ficam fora do código (Edge Functions usam `Deno.env.get`):

```bash
supabase secrets set \
  ASAAS_API_KEY=aact_hmlg_xxxxxxxx \
  ASAAS_API_URL=https://sandbox.asaas.com/api/v3 \
  ASAAS_WEBHOOK_TOKEN=um-token-secreto-aleatorio
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pela
> plataforma em funções Edge; não precisa configurar.

### 2.4 Deploy

```bash
supabase functions deploy asaas-checkout --no-verify-jwt=false
supabase functions deploy asaas-webhook --no-verify-jwt
```

## 3. Webhook no painel do Asaas

No painel do Asaas (sandbox): **Configurações → Webhooks**.

- URL: `https://xhzcgllilfmhdlzsmgiv.supabase.co/functions/v1/asaas-webhook`
- Enviar o header `x-webhook-token` com o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
- Eventos a habilitar:
  - `PAYMENT_RECEIVED`
  - `PAYMENT_CONFIRMED`
  - `PAYMENT_OVERDUE`
  - `SUBSCRIPTION_CANCELLED`

### Semântica dos eventos

| Evento | Status da assinatura | Efeito no `plano_atual` |
|---|---|---|
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | `ativa` | mantém o plano |
| `PAYMENT_OVERDUE` | `atrasada` | mantém o plano por **3 dias** após a data de vencimento; depois volta a `free` (cálculo lazy) |
| `SUBSCRIPTION_CANCELLED` | `cancelada` | volta a `free` |

## 4. Fluxo do app (para testes)

1. Faça login no app → **Configurações → Meu plano → /planos**.
2. Clique em **Assinar** em um plano pago → abre o modal com QR Pix.
3. Pague o Pix de teste (sandbox) → o webhook marca `ativa` e o limite sobe.
4. Para voltar ao Free, use **Cancelar assinatura** (ou "Voltar para Free").
5. Ao atingir o limite de ativos, a tela "Novo empréstimo" mostra o aviso de
   upgrade e o backend também bloqueia (defesa dupla).

## 5. Observações

- **Sandbox**: use a chave Asaas com prefixo `aact_hmlg_`. Os Pix gerados são de
  teste; para pagar de verdade é preciso chave de produção (`ASAAS_API_URL` =
  `https://api.asaas.com/v3`).
- **Upgrade/downgrade**: reutiliza a mesma assinatura Asaas e apenas atualiza o
  valor cobrado; não gera duplicidade.
- **Pro Max** (`limite_ativos = null`) nunca bloqueia a criação.
- **RLS**: usuários só leem a própria assinatura e o catálogo de planos; a
  escrita é exclusiva da service role (Edge Functions), então o usuário não
  consegue se auto-promover editando o banco.
