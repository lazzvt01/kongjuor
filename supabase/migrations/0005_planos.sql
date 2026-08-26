-- ============================================================
-- KONGjuros — Migração 0005
-- Planos de assinatura + cobrança recorrente (Asaas)
--   * nova tabela: planos (catálogo: free/basico/pro/pro_max)
--   * nova tabela: assinaturas (uma por credor, espelha o Asaas)
--   * RPC: plano_atual (cálculo lazy com carência de 3 dias)
--   * RPC: resumo_plano (plano atual + limite + ativos em 1 call)
--   * enforcement: criar_emprestimo bloqueia ao atingir limite
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

-- ---------- 1. tabela planos (catálogo) ----------
create table if not exists public.planos (
  codigo text primary key,
  nome text not null,
  preco_mensal bigint not null check (preco_mensal >= 0), -- centavos
  limite_ativos int check (limite_ativos is null or limite_ativos >= 0), -- null = ilimitado
  descricao text not null,
  destaque boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.planos (codigo, nome, preco_mensal, limite_ativos, descricao, destaque) values
  ('free',     'Free',      0,     5,    'Empréstimos ativos ilimitados e sem custo para testar. Conta com até 5 empréstimos ativos ao mesmo tempo.', false),
  ('basico',   'Básico',    1999,  25,   'Para quem está começando: 25 empréstimos ativos simultâneos, cobrança mensal.', false),
  ('pro',      'Pro',       4999,  50,   'Para quem cresce: 50 empréstimos ativos simultâneos, cobrança mensal.', true),
  ('pro_max',  'Pro Max',   9999,  null, 'Sem limites de empréstimos ativos. Para operações intensas.', false)
on conflict (codigo) do update set
  nome = excluded.nome,
  preco_mensal = excluded.preco_mensal,
  limite_ativos = excluded.limite_ativos,
  descricao = excluded.descricao,
  destaque = excluded.destaque,
  ativo = excluded.ativo;

alter table public.planos enable row level security;

drop policy if exists "planos_select_auth" on public.planos;
create policy "planos_select_auth" on public.planos
  for select using (auth.uid() is not null);

-- ---------- 2. tabela assinaturas ----------
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null unique references public.profiles(id) on delete cascade,
  plano_codigo text not null references public.planos(codigo),
  status text not null default 'pendente' check (status in ('ativa','pendente','atrasada','cancelada')),
  asaas_customer_id text,
  asaas_subscription_id text,
  data_proxima_cobranca date,
  data_inicio date not null default current_date,
  data_cancelamento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assinaturas_credor on public.assinaturas(credor_id);
create index if not exists idx_assinaturas_subscription on public.assinaturas(asaas_subscription_id);

drop trigger if exists trg_assinaturas_updated_at on public.assinaturas;
create trigger trg_assinaturas_updated_at
  before update on public.assinaturas
  for each row execute function public.set_updated_at();

-- RLS: o credor só lê a própria assinatura. Escrita (insert/update/delete)
-- é exclusiva da service role (Edge Function) — o usuário não se auto-promove.
alter table public.assinaturas enable row level security;

drop policy if exists "assinaturas_select_own" on public.assinaturas;
create policy "assinaturas_select_own" on public.assinaturas
  for select using (credor_id = auth.uid());

-- ---------- 3. RPC: plano_atual ----------
-- Cálculo lazy, sem cron:
--   * sem assinatura ou cancelada                  -> 'free'
--   * ativa                                       -> plano_codigo
--   * pendente/atrasada dentro da carência de 3
--     dias após data_proxima_cobranca             -> plano_codigo
--   * pendente/atrasada além da carência          -> 'free'
create or replace function public.plano_atual(p_credor uuid)
returns text
language sql
stable
as $$
  select coalesce((
    select case
      when a.status = 'ativa' then a.plano_codigo
      when a.status in ('pendente','atrasada')
           and (a.data_proxima_cobranca is null or current_date <= (a.data_proxima_cobranca + 3))
        then a.plano_codigo
      else null
    end
    from public.assinaturas a
    where a.credor_id = p_credor
    limit 1
  ), 'free');
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.plano_atual(uuid) to authenticated, anon';
  end if;
end;
$$;

-- ---------- 4. RPC: resumo_plano ----------
-- Retorna o plano vigente + limite + quantos ativos o credor possui.
-- Uso: select * from public.resumo_plano();
create or replace function public.resumo_plano(p_credor uuid default auth.uid())
returns table (
  codigo text,
  nome text,
  preco_mensal bigint,
  limite_ativos int,
  ativos int,
  restantes int
)
language plpgsql
stable
as $$
declare
  v_plano text;
begin
  select public.plano_atual(p_credor) into v_plano;

  return query
  select
    p.codigo,
    p.nome,
    p.preco_mensal,
    p.limite_ativos,
    (select count(*)::int from public.emprestimos e
      where e.credor_id = p_credor and e.saldo_atual > 0) as ativos,
    case when p.limite_ativos is null then null else
      greatest(p.limite_ativos - (select count(*)::int from public.emprestimos e
        where e.credor_id = p_credor and e.saldo_atual > 0), 0)
    end as restantes
  from public.planos p
  where p.codigo = v_plano and p.ativo;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.resumo_plano(uuid) to authenticated';
  end if;
end;
$$;

-- ---------- 5. enforcement no criar_emprestimo ----------
-- Mesma assinatura da 0004; adiciona o bloqueio por limite de ativos.
-- pro_max tem limite_ativos = null -> nunca bloqueia.
create or replace function public.criar_emprestimo(
  p_cliente uuid,
  p_tipo text,
  p_valor_principal bigint,
  p_juros_tipo text,
  p_juros_valor bigint,
  p_juros_periodicidade text,
  p_data_inicio date,
  p_data_vencimento date,
  p_valor_total bigint,
  p_saldo_atual bigint,
  p_forma_juros text default null,
  p_intervalo int default 1,
  p_quantidade_parcelas int default null,
  p_parcelas jsonb default null,
  p_ciclos jsonb default null,
  p_saldo_devedor bigint default null,
  p_deixou_garantia boolean default false,
  p_garantia text default null,
  p_observacao text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_plano text;
  v_limite int;
  v_ativos int;
begin
  select public.plano_atual(auth.uid()) into v_plano;
  select p.limite_ativos into v_limite
  from public.planos p where p.codigo = v_plano;

  if v_limite is not null then
    select count(*) into v_ativos
    from public.emprestimos e
    where e.credor_id = auth.uid() and e.saldo_atual > 0;

    if v_ativos >= v_limite then
      raise exception 'Limite de empréstimos ativos do plano % atingido (%/%). Quite empréstimos ou faça upgrade para liberar espaço.',
        v_plano, v_ativos, v_limite;
    end if;
  end if;

  insert into public.emprestimos (
    credor_id, cliente_id, tipo, forma_juros, valor_principal, juros_tipo, juros_valor,
    juros_periodicidade, intervalo, data_inicio, data_vencimento, valor_total, saldo_atual,
    saldo_devedor, status, quantidade_parcelas, ciclo_atual, deixou_garantia, garantia, observacao
  ) values (
    auth.uid(), p_cliente, p_tipo, p_forma_juros, p_valor_principal, p_juros_tipo, p_juros_valor,
    p_juros_periodicidade, coalesce(p_intervalo, 1), p_data_inicio, p_data_vencimento, p_valor_total, p_saldo_atual,
    p_saldo_devedor, 'ativo', p_quantidade_parcelas, 1, p_deixou_garantia, p_garantia, p_observacao
  ) returning id into v_id;

  if p_parcelas is not null and p_parcelas <> 'null'::jsonb then
    insert into public.parcelas (
      credor_id, emprestimo_id, numero, data_vencimento,
      valor_principal, valor_juros, valor_total, valor_pago, saldo, status
    )
    select
      auth.uid(), v_id, (rec->>'numero')::int, (rec->>'data_vencimento')::date,
      (rec->>'valor_principal')::bigint, (rec->>'valor_juros')::bigint,
      (rec->>'valor_total')::bigint, 0, (rec->>'valor_total')::bigint, 'pendente'
    from jsonb_array_elements(p_parcelas) as rec;
  end if;

  if p_ciclos is not null and p_ciclos <> 'null'::jsonb then
    insert into public.emprestimo_ciclos (
      credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
      juros_calculado, juros_devido, data_inicio, data_vencimento, status
    )
    select
      auth.uid(), v_id, (rec->>'numero_ciclo')::int, (rec->>'saldo_principal_inicial')::bigint,
      (rec->>'juros_calculado')::bigint, (rec->>'juros_devido')::bigint,
      (rec->>'data_inicio')::date, (rec->>'data_vencimento')::date, 'aberto'
    from jsonb_array_elements(p_ciclos) as rec;
  end if;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
