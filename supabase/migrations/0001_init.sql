-- ============================================================
-- KONGjuros — Migração inicial (schema + RLS + triggers)
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- Moedas são armazenadas em CENTAVOS (BIGINT).
-- Juros percentuais são armazenados em centésimos de ponto
-- percentual (ex.: 12,5% => 1250).
-- ============================================================

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null unique,
  whatsapp text,
  whatsapp_normalizado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- clientes ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  whatsapp text,
  whatsapp_normalizado text,
  cpf text,
  endereco text,
  cidade text,
  data_nascimento date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- emprestimos ----------
create table if not exists public.emprestimos (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('parcelado','unico','renovavel')),
  valor_principal bigint not null check (valor_principal >= 0),
  juros_tipo text not null check (juros_tipo in ('percentual','fixo')),
  juros_valor bigint not null check (juros_valor >= 0),
  juros_periodicidade text not null check (juros_periodicidade in ('diario','semanal','mensal')),
  data_inicio date not null default current_date,
  data_vencimento date not null,
  valor_total bigint not null check (valor_total >= 0),
  saldo_atual bigint not null check (saldo_atual >= 0),
  status text not null default 'ativo'
    check (status in ('ativo','em_dia','vence_hoje','atrasado','quitado','renovado')),
  quantidade_parcelas int check (quantidade_parcelas is null or quantidade_parcelas > 0),
  ciclo_atual int not null default 1 check (ciclo_atual >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- parcelas ----------
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  emprestimo_id uuid not null references public.emprestimos(id) on delete cascade,
  numero int not null check (numero > 0),
  data_vencimento date not null,
  valor_principal bigint not null check (valor_principal >= 0),
  valor_juros bigint not null check (valor_juros >= 0),
  valor_total bigint not null check (valor_total >= 0),
  valor_pago bigint not null default 0 check (valor_pago >= 0),
  saldo bigint not null check (saldo >= 0),
  status text not null default 'pendente'
    check (status in ('pendente','vence_hoje','atrasado','parcial','pago','quitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (emprestimo_id, numero)
);

-- ---------- pagamentos ----------
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  emprestimo_id uuid not null references public.emprestimos(id) on delete cascade,
  parcela_id uuid references public.parcelas(id) on delete set null,
  valor bigint not null check (valor > 0),
  forma_pagamento text not null check (forma_pagamento in ('pix','dinheiro','transferencia','outro')),
  data_pagamento date not null default current_date,
  observacao text,
  created_at timestamptz not null default now()
);

-- ---------- renovacoes ----------
create table if not exists public.renovacoes (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  emprestimo_id uuid not null references public.emprestimos(id) on delete cascade,
  data_renovacao date not null default current_date,
  ciclo_anterior int not null check (ciclo_anterior >= 1),
  juros_pago bigint not null check (juros_pago >= 0),
  capital_renovado bigint not null check (capital_renovado >= 0),
  novo_vencimento date not null,
  observacao text,
  created_at timestamptz not null default now()
);

-- ---------- score_historico ----------
create table if not exists public.score_historico (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  score int not null check (score between 0 and 1000),
  motivo text,
  created_at timestamptz not null default now()
);

-- ---------- índices ----------
create index if not exists idx_clientes_credor on public.clientes(credor_id);
create index if not exists idx_clientes_nome on public.clientes(credor_id, nome);
create index if not exists idx_clientes_whatsapp on public.clientes(credor_id, whatsapp_normalizado);

create index if not exists idx_emprestimos_credor on public.emprestimos(credor_id);
create index if not exists idx_emprestimos_cliente on public.emprestimos(cliente_id);
create index if not exists idx_emprestimos_status on public.emprestimos(credor_id, status);
create index if not exists idx_emprestimos_vencimento on public.emprestimos(credor_id, data_vencimento);

create index if not exists idx_parcelas_emprestimo on public.parcelas(emprestimo_id);
create index if not exists idx_parcelas_status on public.parcelas(credor_id, status);
create index if not exists idx_parcelas_vencimento on public.parcelas(credor_id, data_vencimento);

create index if not exists idx_pagamentos_credor on public.pagamentos(credor_id);
create index if not exists idx_pagamentos_emprestimo on public.pagamentos(emprestimo_id);
create index if not exists idx_pagamentos_data on public.pagamentos(credor_id, data_pagamento);

create index if not exists idx_renovacoes_emprestimo on public.renovacoes(emprestimo_id);
create index if not exists idx_renovacoes_credor on public.renovacoes(credor_id);

create index if not exists idx_score_cliente on public.score_historico(cliente_id);
create index if not exists idx_score_credor on public.score_historico(credor_id, created_at);

-- ---------- triggers updated_at ----------
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

create trigger trg_emprestimos_updated_at
  before update on public.emprestimos
  for each row execute function public.set_updated_at();

create trigger trg_parcelas_updated_at
  before update on public.parcelas
  for each row execute function public.set_updated_at();

-- ---------- trigger de criação automática de perfil ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, whatsapp, whatsapp_normalizado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    new.email,
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'whatsapp_normalizado'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.emprestimos enable row level security;
alter table public.parcelas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.renovacoes enable row level security;
alter table public.score_historico enable row level security;

-- ---------- profiles ----------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- clientes ----------
create policy "clientes_select_own" on public.clientes
  for select using (credor_id = auth.uid());
create policy "clientes_insert_own" on public.clientes
  for insert with check (credor_id = auth.uid());
create policy "clientes_update_own" on public.clientes
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "clientes_delete_own" on public.clientes
  for delete using (credor_id = auth.uid());

-- ---------- emprestimos ----------
create policy "emprestimos_select_own" on public.emprestimos
  for select using (credor_id = auth.uid());
create policy "emprestimos_insert_own" on public.emprestimos
  for insert with check (credor_id = auth.uid());
create policy "emprestimos_update_own" on public.emprestimos
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "emprestimos_delete_own" on public.emprestimos
  for delete using (credor_id = auth.uid());

-- ---------- parcelas ----------
create policy "parcelas_select_own" on public.parcelas
  for select using (credor_id = auth.uid());
create policy "parcelas_insert_own" on public.parcelas
  for insert with check (credor_id = auth.uid());
create policy "parcelas_update_own" on public.parcelas
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "parcelas_delete_own" on public.parcelas
  for delete using (credor_id = auth.uid());

-- ---------- pagamentos ----------
create policy "pagamentos_select_own" on public.pagamentos
  for select using (credor_id = auth.uid());
create policy "pagamentos_insert_own" on public.pagamentos
  for insert with check (credor_id = auth.uid());
create policy "pagamentos_update_own" on public.pagamentos
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "pagamentos_delete_own" on public.pagamentos
  for delete using (credor_id = auth.uid());

-- ---------- renovacoes ----------
create policy "renovacoes_select_own" on public.renovacoes
  for select using (credor_id = auth.uid());
create policy "renovacoes_insert_own" on public.renovacoes
  for insert with check (credor_id = auth.uid());
create policy "renovacoes_update_own" on public.renovacoes
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "renovacoes_delete_own" on public.renovacoes
  for delete using (credor_id = auth.uid());

-- ---------- score_historico ----------
create policy "score_historico_select_own" on public.score_historico
  for select using (credor_id = auth.uid());
create policy "score_historico_insert_own" on public.score_historico
  for insert with check (credor_id = auth.uid());
create policy "score_historico_update_own" on public.score_historico
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
create policy "score_historico_delete_own" on public.score_historico
  for delete using (credor_id = auth.uid());

-- Recarrega o schema cache do PostgREST
notify pgrst, 'reload schema';

-- ============================================================
-- RPC — operações atômicas
-- ============================================================

-- Cria empréstimo + parcelas em uma única transação
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
  p_quantidade_parcelas int,
  p_parcelas jsonb default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.emprestimos (
    credor_id, cliente_id, tipo, valor_principal, juros_tipo, juros_valor,
    juros_periodicidade, data_inicio, data_vencimento, valor_total, saldo_atual,
    status, quantidade_parcelas, ciclo_atual
  ) values (
    auth.uid(), p_cliente, p_tipo, p_valor_principal, p_juros_tipo, p_juros_valor,
    p_juros_periodicidade, p_data_inicio, p_data_vencimento, p_valor_total, p_saldo_atual,
    'ativo', p_quantidade_parcelas, 1
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

  return v_id;
end;
$$;

-- Registra pagamento, atualiza parcela e saldo do empréstimo
create or replace function public.registrar_pagamento(
  p_emprestimo uuid,
  p_cliente uuid,
  p_parcela uuid,
  p_valor bigint,
  p_forma text,
  p_data date,
  p_observacao text
) returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_saldo bigint;
  v_restante bigint;
  v_p public.parcelas%rowtype;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  if p_valor <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;

  insert into public.pagamentos (
    credor_id, cliente_id, emprestimo_id, parcela_id, valor,
    forma_pagamento, data_pagamento, observacao
  ) values (
    auth.uid(), p_cliente, p_emprestimo, p_parcela, p_valor,
    p_forma, p_data, p_observacao
  );

  if p_parcela is not null then
    update public.parcelas
    set valor_pago = least(valor_total, valor_pago + p_valor),
        saldo = greatest(valor_total - least(valor_total, valor_pago + p_valor), 0),
        status = case
          when least(valor_total, valor_pago + p_valor) >= valor_total then 'pago'
          when least(valor_total, valor_pago + p_valor) > 0 then 'parcial'
          else status
        end
    where id = p_parcela and emprestimo_id = p_emprestimo;
  else
    -- distribui o pagamento entre as parcelas em aberto, da primeira à última
    v_restante := p_valor;
    for v_p in
      select * from public.parcelas
      where emprestimo_id = p_emprestimo and saldo > 0
      order by numero asc
      for update
    loop
      if v_restante <= 0 then
        exit;
      end if;
      update public.parcelas
      set valor_pago = least(valor_total, valor_pago + least(v_p.saldo, v_restante)),
          saldo = greatest(valor_total - least(valor_total, valor_pago + least(v_p.saldo, v_restante)), 0),
          status = case
            when least(valor_total, valor_pago + least(v_p.saldo, v_restante)) >= valor_total then 'pago'
            when least(valor_total, valor_pago + least(v_p.saldo, v_restante)) > 0 then 'parcial'
            else status
          end
      where id = v_p.id;
      v_restante := v_restante - least(v_p.saldo, v_restante);
    end loop;
  end if;

  v_saldo := greatest(v_emp.saldo_atual - p_valor, 0);

  update public.emprestimos
  set saldo_atual = v_saldo,
      status = case
        when v_saldo <= 0 and tipo = 'renovavel' then 'renovado'
        when v_saldo <= 0 then 'quitado'
        when tipo = 'renovavel' and ciclo_atual > 1 then 'renovado'
        when p_data > data_vencimento then 'atrasado'
        when p_data = data_vencimento then 'vence_hoje'
        else 'em_dia'
      end
  where id = p_emprestimo;
end;
$$;

-- Registra renovação e atualiza o ciclo do empréstimo
create or replace function public.renovar_emprestimo(
  p_emprestimo uuid,
  p_juros_pago bigint,
  p_capital_renovado bigint,
  p_novo_vencimento date,
  p_juros_tipo text,
  p_juros_valor bigint,
  p_juros_periodicidade text,
  p_observacao text
) returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_novo_total bigint;
  v_juros bigint;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  if v_emp.tipo <> 'renovavel' then
    raise exception 'Este empréstimo não é renovável';
  end if;

  if p_juros_tipo = 'percentual' then
    v_juros := round(p_capital_renovado * (p_juros_valor::numeric / 10000));
  else
    v_juros := p_juros_valor;
  end if;
  v_novo_total := p_capital_renovado + v_juros;

  insert into public.renovacoes (
    credor_id, emprestimo_id, data_renovacao, ciclo_anterior, juros_pago,
    capital_renovado, novo_vencimento, observacao
  ) values (
    auth.uid(), p_emprestimo, current_date, v_emp.ciclo_atual, p_juros_pago,
    p_capital_renovado, p_novo_vencimento, p_observacao
  );

  update public.emprestimos
  set ciclo_atual = v_emp.ciclo_atual + 1,
      data_vencimento = p_novo_vencimento,
      saldo_atual = v_juros,
      valor_total = v_novo_total,
      status = case
        when p_novo_vencimento < current_date then 'atrasado'
        when p_novo_vencimento = current_date then 'vence_hoje'
        else 'em_dia'
      end,
      juros_tipo = p_juros_tipo,
      juros_valor = p_juros_valor,
      juros_periodicidade = p_juros_periodicidade
  where id = p_emprestimo;
end;
$$;

-- Recalcula o score de um cliente e grava o histórico
create or replace function public.recalcular_score(p_cliente uuid) returns int
language plpgsql
as $$
declare
  v_credor uuid;
  v_total int;
  v_quitados int;
  v_ativos int;
  v_atrasos int;
  v_dias_max int;
  v_pagamentos int;
  v_antecipados int;
  v_renovacoes int;
  v_score int := 600;
  v_class text;
begin
  select credor_id into v_credor from public.clientes where id = p_cliente;
  if v_credor is null or v_credor <> auth.uid() then
    raise exception 'Cliente não encontrado';
  end if;

  select count(*) into v_total from public.emprestimos where cliente_id = p_cliente;
  select count(*) into v_quitados from public.emprestimos where cliente_id = p_cliente and saldo_atual <= 0;
  select count(*) into v_ativos from public.emprestimos where cliente_id = p_cliente and saldo_atual > 0;
  select count(*) into v_atrasos from public.emprestimos
    where cliente_id = p_cliente and saldo_atual > 0 and data_vencimento < current_date;
  select coalesce(max(current_date - data_vencimento), 0) into v_dias_max from public.emprestimos
    where cliente_id = p_cliente and saldo_atual > 0 and data_vencimento < current_date;
  select count(*) into v_pagamentos from public.pagamentos where cliente_id = p_cliente;
  select count(*) into v_antecipados from public.pagamentos p
    join public.emprestimos e on e.id = p.emprestimo_id
    where p.cliente_id = p_cliente and p.data_pagamento < e.data_vencimento;
  select count(*) into v_renovacoes from public.renovacoes r
    join public.emprestimos e on e.id = r.emprestimo_id where e.cliente_id = p_cliente;

  v_score := v_score
    + least(v_total * 15, 90)
    - least(v_ativos * 20, 120)
    + least(v_quitados * 50, 250)
    + least(v_pagamentos * 10, 100)
    + least(v_antecipados * 15, 120)
    - least(v_atrasos * 40, 160)
    - least(floor(v_dias_max / 7)::int * 20, 120)
    - least(v_renovacoes * 10, 80);

  v_score := greatest(0, least(1000, v_score));

  insert into public.score_historico (credor_id, cliente_id, score, motivo)
  values (v_credor, p_cliente, v_score, 'Recalculo automático');

  return v_score;
end;
$$;

notify pgrst, 'reload schema';
