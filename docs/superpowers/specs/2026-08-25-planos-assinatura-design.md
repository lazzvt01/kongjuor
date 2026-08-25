# Plano de Assinatura (Planos) — Design

**Data:** 2026-08-25
**Status:** Aprovado pelo usuário (seções 1–4)
**Objetivo:** Permitir que credores assinem planos para usar o app, com limite de empréstimos ativos por plano e cobrança recorrente via Asaas.

## Planos

| codigo | nome | limite_ativos | preco_mensal (centavos) |
|---|---|---|---|
| `free` | Free | 5 | 0 |
| `basico` | Básico | 25 | 1999 |
| `pro` | Pro | 50 | 4999 |
| `pro_max` | Pro Max | `null` (ilimitado) | 9999 |

- Contagem de limite = empréstimos **ativos** (`saldo_atual > 0`).
- Ao quitar um empréstimo, o espaço é liberado.

## Regras de negócio

1. Usuário novo começa no plano `free` (sem assinatura → plano efetivo `free`).
2. Ao atingir o limite, a criação de novos empréstimos é **bloqueada** no backend (RPC `criar_emprestimo`) e o frontend mostra tela de upgrade.
3. Downgrade com excesso de ativos: permitido, mas bloqueia novos empréstimos até o usuário quitar e voltar abaixo do limite.
4. Pagamento não confirmado no vencimento: carência de **3 dias** mantém o plano efetivo; após isso, plano efetivo volta a `free` (cálculo lazy, sem cron).
5. Pro Max (`limite_ativos = null`) nunca bloqueia.

## Modelo de dados (migration `0005_planos.sql`)

### Tabela `planos`

```sql
create table if not exists public.planos (
  codigo text primary key,
  nome text not null,
  limite_ativos int,            -- null = ilimitado
  preco_mensal bigint not null, -- centavos
  ativo boolean not null default true
);
-- seed dos 4 planos
```

RLS: `select` para usuários autenticados; sem escrita pública.

### Tabela `assinaturas`

```sql
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  plano_codigo text not null references public.planos(codigo),
  status text not null default 'pendente'
    check (status in ('ativa','pendente','atrasada','cancelada')),
  asaas_customer_id text,
  asaas_subscription_id text,
  data_proxima_cobranca date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credor_id)
);
```

RLS: `select` do próprio credor; escrita apenas via service role (Edge Functions). Usuário não consegue burlar o plano.

### Função `plano_atual(p_credor uuid) returns text`

- Sem assinatura → `free`.
- `status = 'cancelada'` → `free`.
- `status = 'ativa'` → `plano_codigo`.
- `status` em `('pendente','atrasada')` → mantém `plano_codigo` se `current_date <= data_proxima_cobranca + 3 dias`; caso contrário → `free`.

Carência configurável como constante `3` (dia).

### Enforcement no RPC `criar_emprestimo`

No início da função (após auth):

```sql
select public.plano_atual(auth.uid()) into v_plano;
select limite_ativos into v_limite from public.planos where codigo = v_plano;
if v_limite is not null then
  select count(*) into v_ativos
  from public.emprestimos
  where credor_id = auth.uid() and saldo_atual > 0;
  if v_ativos >= v_limite then
    raise exception 'Limite de empréstimos ativos do plano % atingido (%/%). Faça upgrade ou quite empréstimos.',
      v_plano, v_ativos, v_limite;
  end if;
end if;
```

## Edge Functions (`supabase/functions/`)

Deploy manual pelo usuário. Duas funções em Deno:

### `asaas-checkout`

- Autenticada via JWT do Supabase.
- Body: `{ plano, acao }` onde `plano` ∈ (basico/pro/pro_max) e `acao` ∈ (`assinar` | `cancelar`).
- **`acao = cancelar`**: cancela a assinatura Asaas existente, marca `assinaturas.status = 'cancelada'` via service role, retorna sucesso.
- **`acao = assinar`**:
  - Cria/obtém `customer` Asaas (reutiliza `asaas_customer_id` da `assinaturas`).
  - Se já existe `asaas_subscription_id` **ativa**: atualiza o valor da assinatura Asaas para o novo plano (upgrade/downgrade) e atualiza `plano_codigo` na `assinaturas`.
  - Se não existe: cria assinatura Asaas com valor do plano, `nextDueDate = hoje + 1`, `billingType = PIX`.
  - Grava/atualiza linha em `assinaturas` via service role (status `pendente`).
  - Retorna Pix da primeira cobrança (QR code + copia-e-cola) + `asaas_subscription_id`.

### `asaas-webhook`

- Chamada pela Asaas (valida por header/token opcional).
- Eventos tratados:
  - `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → status `ativa`, `data_proxima_cobranca` do evento.
  - `PAYMENT_OVERDUE` → status `atrasada`.
  - `SUBSCRIPTION_CANCELLED` → status `cancelada`.
- Atualiza `assinaturas` via service role, de forma idempotente.
- Responde `200` rapidamente.

### Secrets necessárias

- `ASAAS_API_KEY`
- `ASAAS_API_URL` (ex: `https://api.asaas.com/v3` produção ou sandbox)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Frontend

### Hook `usePlano`

- Chama RPC `plano_atual`, lê `planos` (limite) e conta empréstimos ativos.
- Expõe: `{ plano, limite, ativos, restantes, limiteAtingido, loading, refresh }`.

### Página `/planos`

- Rota nova no `App.tsx` (dentro de `ProtectedRoute`).
- Cards comparativos dos 4 planos.
- Plano atual destacado com badge "Plano atual".
- Botões: "Assinar"/"Trocar plano" (abre modal Pix via `asaas-checkout` com `acao=assinar`), "Cancelar assinatura" (chama `asaas-checkout` com `acao=cancelar`, com confirmação).
- Modal Pix: QR code + copia-e-cola + status "Aguardando pagamento" (atualiza via `usePlano`).

### Bloqueio em `NovoEmprestimoSelecionar.tsx`

- Se `limiteAtingido`, substituir formulário por tela "Limite atingido" com CTA "Ver planos" (`/planos`).
- Mostrar `ativos`/`limite` e aviso de que quitar libera espaço.

### Acesso em `Configuracoes.tsx` / `MeuPerfil.tsx`

- Linha "Meu plano" (label + limite) com link para `/planos`.

### Erro do RPC

- `criar_emprestimo` lança mensagem amigável; toast existente já exibe. (Opcional: mapear para navegar a `/planos`.)

## Testes e validação

- Aplicar `0005_planos.sql` em banco local (kongtest6) com auth stub.
- Cenários SQL:
  1. `plano_atual` sem assinatura → `free`.
  2. `criar_emprestimo` bloqueia no 6º ativo no Free.
  3. Upgrade simulado (insert service role em `assinaturas`) → limite sobe.
  4. Downgrade com excesso → bloqueia novos até quitar.
  5. Carência: `atrasada` mantém plano ≤3 dias; depois → `free` (testar com `data_proxima_cobranca` no passado).
- `npx tsc -b`, `npx oxlint`, `npm run build`, testes TS existentes (21) e novos casos se houver lógica TS de fronteira.
- Documento de deploy (migration + Edge Functions + secrets) entregue ao usuário.

## Fora de escopo (YAGNI)

- Trial gratuito.
- Faturamento de multa/juros de atraso.
- Cupons/descontos.
- Multi-conta por credor (um plano por `credor_id`).
