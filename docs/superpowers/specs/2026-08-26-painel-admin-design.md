# Painel Admin — Design

**Data:** 2026-08-26
**Status:** Aprovado pelo usuário (seções 1–4)
**Objetivo:** Painel administrativo dentro do app para gerir e analisar todas as contas e assinaturas. O admin é o credor com WhatsApp `83991515427`.

## Abordagem escolhida

**A — RLS ampliado + RPCs admin.** Autorização via coluna `is_admin` no `profiles` e função `is_admin()` usada em policies e RPCs. Escrita exclusivamente por RPCs `security definer` que validam `is_admin()`. Enforcement de bloqueio no `criar_emprestimo`. Sem Edge Functions novas obrigatórias; o ajuste de valor/cancelamento no Asaas usa a Edge Function `asaas-checkout` existente com ação nova.

## Regras de negócio

1. **Admin**: credor com `profiles.is_admin = true`. Seed: `whatsapp_normalizado = '83991515427'`.
2. Admin vê todas as contas, assinaturas, empréstimos, clientes, pagamentos e histórico de assinatura.
3. Não-admin não enxerga dados de terceiros (RLS atual preservado) e não acessa `/admin`.
4. **Bloqueio de conta**: só impede **novos empréstimos** (`criar_emprestimo` lança erro). Pagamentos e demais operações continuam liberados.
5. **Alterar plano / cancelar** pelo admin: grava no banco + histórico; o ajuste do Asaas é feito via Edge Function `asaas-checkout` (se falhar, banco já atualizado e aviso de ajuste manual).
6. Usuário comum não consegue se auto-promover a admin (`profiles` RLS não permite alterar `is_admin`; único caminho é RPC admin/service role).

## Modelo de dados (migration `0006_admin.sql`)

### `profiles` — colunas novas

```sql
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists bloqueado_em timestamptz;
```

Seed:
```sql
update public.profiles set is_admin = true where whatsapp_normalizado = '83991515427';
```

### Trigger de proteção do `is_admin`

A policy existente `profiles_update_own` (`for update using (id = auth.uid())`) permitiria
um usuário comum alterar o próprio `is_admin`/`bloqueado_em`. Para fechar isso, adiciona-se
um trigger `before update`:

```sql
create or replace function public.trg_profiles_admin_guard() returns trigger as $$
begin
  -- auth.uid() nulo = service role / SQL Editor (caminho legítimo de seed);
  -- autenticado precisa ser is_admin() para tocar is_admin/bloqueado_em.
  if auth.uid() is not null
     and not public.is_admin()
     and (new.is_admin is distinct from old.is_admin
          or new.bloqueado_em is distinct from old.bloqueado_em) then
    raise exception 'Permissão negada: apenas administradores podem alterar is_admin ou bloqueio.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_admin_guard on public.profiles;
create trigger trg_profiles_admin_guard
  before update on public.profiles
  for each row execute function public.trg_profiles_admin_guard();
```

> **Ordem na migration:** criar `is_admin()` **antes** do trigger `trg_profiles_admin_guard`
> (o trigger chama a função). O enforcement no `criar_emprestimo` é aplicado ao final,
> recriando a função da 0005 com o novo bloco.
>
> A service role (SQL Editor/pooler/Edge Function) tem `auth.uid()` nulo e ignora RLS,
> então o seed e os RPCs admin (security definer) conseguem alterar `is_admin`/`bloqueado_em`.
> Usuário autenticado comum não passa do guard.

### `assinatura_historico` (log)

```sql
create table if not exists public.assinatura_historico (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  evento text not null,           -- criada|paga|atrasada|cancelada|plano_alterado|bloqueada|desbloqueada
  plano_antes text,
  plano_depois text,
  status_antes text,
  status_depois text,
  detalhe text,                    -- motivo livre (preenchido pelo admin ou evento Asaas)
  criado_por uuid references public.profiles(id),  -- null = Asaas/webhook
  created_at timestamptz not null default now()
);
```

- Gravado pelo webhook do Asaas (cada evento) e pelos RPCs admin.
- RLS: `select` para o próprio credor e para admin; `insert` só via service role (webhook) e RPCs (security definer).

### `is_admin()`

```sql
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_admin);
$$;
```

## RPCs admin (todos `security definer`, validam `is_admin()`)

### Leitura

- **`admin_listar_contas()`** → tabela com: `id`, `nome`, `whatsapp`, `email`, `created_at`, `is_admin`, `bloqueado_em`, `plano_atual`, `status_assinatura`, `asaas_subscription_id`, `emprestimos_ativos`, `valor_em_aberto`.
- **`admin_detalhe_credor(p_credor uuid)`** → JSONB/record com: perfil, assinatura, `emprestimos` (todos), `clientes`, `pagamentos` (recentes, ex.: últimos 50), `assinatura_historico` (ordenado desc), métricas: total emprestado, total recebido, em aberto, inadimplentes (empréstimos com `saldo_atual > 0` e vencidos), ticket médio, score médio.

### Escrita

- **`admin_alterar_plano(p_credor uuid, p_plano text, p_motivo text default null)`** → valida admin e `plano` existente. Comportamento:
  - Sem assinatura: cria linha em `assinaturas` com `plano_codigo = p_plano`, `status = 'ativa'` (concessão manual do admin).
  - Assinatura `cancelada`: reativa com `status = 'ativa'`, `data_cancelamento = null`, troca `plano_codigo`.
  - Assinatura `ativa`/`pendente`/`atrasada`: apenas troca `plano_codigo`, mantém o status.
  - Grava `assinatura_historico` (`plano_alterado`, com `plano_antes`/`plano_depois`).
- **`admin_cancelar_assinatura(p_credor uuid, p_motivo text default null)`** → valida admin; marca `assinaturas.status = 'cancelada'`, `data_cancelamento`; grava histórico (`cancelada`).
- **`admin_bloquear_conta(p_credor uuid, p_bloquear boolean, p_motivo text default null)`** → valida admin; seta/limpa `profiles.bloqueado_em`; grava histórico (`bloqueada`/`desbloqueada`).

### Enforcement

`criar_emprestimo` (0004/0005) passa a checar, antes da criação:

```sql
if exists (select 1 from public.profiles where id = auth.uid() and bloqueado_em is not null) then
  raise exception 'Conta bloqueada pelo administrador.';
end if;
```

## Edge Function `asaas-checkout` (ajuste)

Novo campo opcional no body: `credor_alvo uuid`. Quando presente, a function:
1. Autentica o JWT e verifica `is_admin()` do usuário (via service role → `profiles`).
2. Executa a ação (`assinar`/`cancelar`) **para o credor alvo** (cria/atualiza subscription, ou DELETE).
3. Se não for admin, retorna `403`.

Sem `credor_alvo`, mantém comportamento atual (opera no próprio usuário).

## Frontend

### Rotas (dentro do `AppShell`, guard admin)

- `/admin` — visão geral.
- `/admin/contas/:id` — detalhe do credor.

Guard: componente `AdminRoute` (como `ProtectedRoute`) que redireciona não-admin para `/`.

### Layout

- Item "Admin" no menu do `AppShell` (sidebar/mobile nav), renderizado só se `is_admin`.
- `useAuth` passa a expor `is_admin`.

### Telas

- **`AdminDashboard.tsx`** — cards de métricas (total de contas, contas ativas, empréstimos ativos no sistema, volume em aberto, MRR estimado = soma dos preços dos planos `ativa`) + lista de contas com busca e filtros (plano, status, bloqueada). Cada linha → `/admin/contas/:id`.
- **`AdminDetalheCredor.tsx`** — perfil + assinatura (plano atual, status, próxima cobrança) + métricas + tabs: Empréstimos / Clientes / Pagamentos / Histórico. Ações: Cancelar assinatura, Alterar plano, Bloquear/Desbloquear (dialog com motivo).

### Hooks

- `useAdmin()` — `adminListarContas` + refresh.
- `useAdminConta(id)` — `adminDetalheCredor` + refresh.

### Services

`src/services/api/admin.ts`:
- `adminListarContas()`
- `adminDetalheCredor(id)`
- `adminAlterarPlano(id, plano, motivo?)`
- `adminCancelarAssinatura(id, motivo?)`
- `adminBloquearConta(id, bloquear, motivo?)`
- Fluxo de ação: chama RPC; se envolve Asaas, chama `asaas-checkout` com `credor_alvo`; toast com sucesso/falha.

## Segurança

- RPCs de escrita são `security definer` e validam `is_admin()` no início; sem isso, `raise exception` de permissão.
- RPCs de leitura também validam `is_admin()`; usuário comum recebe erro de permissão.
- `profiles` RLS: a policy `profiles_update_own` permite atualizar o próprio perfil (nome/whatsapp), mas o trigger `trg_profiles_admin_guard` impede que usuário comum altere `is_admin`/`bloqueado_em`. Escrita administrativa só via RPCs admin (security definer) ou service role.

## Testes e validação

- Aplicar `0006_admin.sql` em banco local (kongtest7) com auth stub e na nuvem (pooler).
- Cenários SQL:
  1. `is_admin()` true p/ admin seedado, false p/ comum.
  2. `admin_listar_contas` retorna dados como admin; comum → erro de permissão.
  3. `admin_alterar_plano` atualiza plano + grava histórico; `plano_atual` reflete.
  4. `admin_cancelar_assinatura` marca cancelada + histórico; `plano_atual` → free.
  5. `admin_bloquear_conta` → `criar_emprestimo` lança "Conta bloqueada"; pagamento ainda funciona.
  6. Webhook grava `assinatura_historico` (eventos PAYMENT_RECEIVED/OVERDUE/CANCELLED).
  7. Usuário comum não consegue chamar RPCs admin.
- `npx tsc -b`, `npx oxlint`, `npm run build`, testes TS existentes (21) + novos se houver lógica TS de fronteira.
- Deploy: migration via pooler (já tenho acesso); Edge Function `asaas-checkout` ajustada fica para deploy manual pelo usuário (guia atualizado).

## Fora de escopo (YAGNI)

- Impersonar/login como credor.
- Relatórios financeiros globais avançados (gráficos) além das métricas da visão geral.
- Multi-admin com permissões granulares (só flag `is_admin`).
- Notificações para admin.
