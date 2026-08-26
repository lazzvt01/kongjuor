-- ============================================================
-- KONGjuros — Migração 0004
-- Motor financeiro unificado: Saldo Aberto por ciclos
--   * novos campos: forma_juros, intervalo, observacao
--   * nova tabela: emprestimo_ciclos
--   * unificação de tipos: 'unico'/'renovavel' -> 'saldo_aberto'
--   * RPCs reescritos: criar_emprestimo, registrar_pagamento,
--     renovar_ciclo, renegociar_ciclo, sincronizar_ciclos,
--     recalcular_score (alinhado ao frontend)
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

-- ---------- 1. novos campos em emprestimos ----------
alter table public.emprestimos add column if not exists forma_juros text;
alter table public.emprestimos add column if not exists intervalo int not null default 1;
alter table public.emprestimos add column if not exists observacao text;

-- parcelados criados antes desta migração usam juros total
update public.emprestimos
set forma_juros = 'total'
where tipo = 'parcelado' and forma_juros is null;

-- Remove a constraint ANTES da migração de dados: o tipo antigo
-- ('parcelado','unico','renovavel') rejeita o novo valor 'saldo_aberto'.
-- A constraint nova é recriada abaixo.
alter table public.emprestimos drop constraint if exists emprestimos_tipo_check;

-- ---------- 2. tabela emprestimo_ciclos ----------
create table if not exists public.emprestimo_ciclos (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  emprestimo_id uuid not null references public.emprestimos(id) on delete cascade,
  numero_ciclo int not null check (numero_ciclo >= 1),
  saldo_principal_inicial bigint not null check (saldo_principal_inicial >= 0),
  juros_calculado bigint not null check (juros_calculado >= 0),
  juros_renegociado bigint check (juros_renegociado is null or juros_renegociado >= 0),
  juros_devido bigint not null check (juros_devido >= 0),
  juros_pago bigint not null default 0 check (juros_pago >= 0),
  principal_abatido bigint not null default 0 check (principal_abatido >= 0),
  valor_pago bigint not null default 0 check (valor_pago >= 0),
  data_inicio date not null,
  data_vencimento date not null,
  data_encerramento date,
  status text not null default 'aberto' check (status in ('aberto','encerrado')),
  renegociado_data date,
  renegociado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (emprestimo_id, numero_ciclo)
);

create index if not exists idx_ciclos_emprestimo on public.emprestimo_ciclos(emprestimo_id);
create index if not exists idx_ciclos_credor on public.emprestimo_ciclos(credor_id);

drop trigger if exists trg_ciclos_updated_at on public.emprestimo_ciclos;
create trigger trg_ciclos_updated_at
  before update on public.emprestimo_ciclos
  for each row execute function public.set_updated_at();

-- ---------- 3. migração de dados: unico/renovavel -> saldo_aberto ----------
-- Invariante do novo modelo:
--   saldo_atual = saldo_devedor (principal em aberto) + juros pendentes
-- Para empréstimos 'unico' criados após a 0002, saldo_atual já era
-- saldo_devedor + juros do período (invariante mantido).
-- Para 'renovavel' (legado), saldo_atual guardava APENAS os juros do
-- período; o principal estava em saldo_devedor (quando presente) ou
-- valor_principal. Corrigimos o saldo_atual somando o principal.

-- unico/renovavel: garante saldo_devedor preenchido
update public.emprestimos
set saldo_devedor = valor_principal
where tipo in ('unico','renovavel') and saldo_devedor is null;

-- renovavel legado: saldo_atual = principal + juros (antes: só juros)
update public.emprestimos
set saldo_atual = saldo_devedor + saldo_atual
where tipo = 'renovavel' and saldo_devedor is not null and saldo_atual < saldo_devedor;

-- unifica o tipo
update public.emprestimos set tipo = 'saldo_aberto' where tipo in ('unico','renovavel');

-- cria o ciclo atual (aberto) para cada saldo_aberto
insert into public.emprestimo_ciclos (
  credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
  juros_calculado, juros_devido, data_inicio, data_vencimento, status
)
select
  credor_id,
  id,
  ciclo_atual,
  saldo_devedor,
  greatest(saldo_atual - saldo_devedor, 0),
  greatest(saldo_atual - saldo_devedor, 0),
  data_inicio,
  data_vencimento,
  case when saldo_atual > 0 then 'aberto' else 'encerrado' end
from public.emprestimos
where tipo = 'saldo_aberto'
on conflict (emprestimo_id, numero_ciclo) do nothing;

-- cria ciclos encerrados a partir do histórico de renovacoes
insert into public.emprestimo_ciclos (
  credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
  juros_calculado, juros_devido, juros_pago, valor_pago,
  data_inicio, data_vencimento, data_encerramento, status
)
select
  r.credor_id,
  r.emprestimo_id,
  r.ciclo_anterior,
  r.capital_renovado,
  r.juros_pago,
  r.juros_pago,
  r.juros_pago,
  r.juros_pago,
  r.data_renovacao,
  r.data_renovacao,
  r.data_renovacao,
  'encerrado'
from public.renovacoes r
where r.ciclo_anterior < (
  select e.ciclo_atual from public.emprestimos e where e.id = r.emprestimo_id
)
on conflict (emprestimo_id, numero_ciclo) do nothing;

-- ---------- 4. constraints de tipo (recriadas de forma idempotente) ----------
alter table public.emprestimos drop constraint if exists emprestimos_tipo_check;
alter table public.emprestimos
  add constraint emprestimos_tipo_check check (tipo in ('parcelado','saldo_aberto'));
alter table public.emprestimos drop constraint if exists emprestimos_forma_juros_check;
alter table public.emprestimos
  add constraint emprestimos_forma_juros_check
    check (forma_juros is null or forma_juros in ('total','periodico'));
alter table public.emprestimos drop constraint if exists emprestimos_intervalo_check;
alter table public.emprestimos
  add constraint emprestimos_intervalo_check check (intervalo >= 1);

-- ---------- 5. RLS para emprestimo_ciclos ----------
alter table public.emprestimo_ciclos enable row level security;

drop policy if exists "ciclos_select_own" on public.emprestimo_ciclos;
create policy "ciclos_select_own" on public.emprestimo_ciclos
  for select using (credor_id = auth.uid());
drop policy if exists "ciclos_insert_own" on public.emprestimo_ciclos;
create policy "ciclos_insert_own" on public.emprestimo_ciclos
  for insert with check (credor_id = auth.uid());
drop policy if exists "ciclos_update_own" on public.emprestimo_ciclos;
create policy "ciclos_update_own" on public.emprestimo_ciclos
  for update using (credor_id = auth.uid()) with check (credor_id = auth.uid());
drop policy if exists "ciclos_delete_own" on public.emprestimo_ciclos;
create policy "ciclos_delete_own" on public.emprestimo_ciclos
  for delete using (credor_id = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================
-- 6. RPC: criar_emprestimo (unificado)
-- ============================================================
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
begin
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

-- ============================================================
-- 7. RPC: sincronizar_ciclos
-- Garante que exista um ciclo aberto para empréstimos
-- saldo_aberto (cobre dados legados sem ciclos).
-- ============================================================
create or replace function public.sincronizar_ciclos(p_emprestimo uuid)
returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_num int;
  v_juros bigint;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  if v_emp.tipo <> 'saldo_aberto' then
    return;
  end if;

  perform 1 from public.emprestimo_ciclos
  where emprestimo_id = p_emprestimo and status = 'aberto';

  if not found then
    select coalesce(max(numero_ciclo), 0) + 1 into v_num
    from public.emprestimo_ciclos where emprestimo_id = p_emprestimo;

    v_juros := case
      when v_emp.juros_tipo = 'percentual'
        then round(coalesce(v_emp.saldo_devedor, v_emp.valor_principal) * (v_emp.juros_valor::numeric / 10000))
      else v_emp.juros_valor
    end;

    insert into public.emprestimo_ciclos (
      credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
      juros_calculado, juros_devido, data_inicio, data_vencimento, status
    ) values (
      auth.uid(), p_emprestimo, v_num, coalesce(v_emp.saldo_devedor, v_emp.valor_principal),
      v_juros, v_juros, v_emp.data_inicio, v_emp.data_vencimento, 'aberto'
    );

    update public.emprestimos
    set saldo_atual = coalesce(v_emp.saldo_devedor, v_emp.valor_principal) + v_juros,
        status = case
          when v_emp.data_vencimento < current_date then 'atrasado'
          when v_emp.data_vencimento = current_date then 'vence_hoje'
          else 'em_dia'
        end
    where id = p_emprestimo;
  end if;
end;
$$;

-- ============================================================
-- 8. RPC: registrar_pagamento (unificado)
-- Parcelado: mantém distribuição por parcelas.
-- Saldo aberto: distribuição 1) juros de ciclos anteriores
-- encerrados, 2) juros do ciclo aberto, 3) principal.
-- Pagamento menor que o juros pendente NÃO abate principal.
-- ============================================================
create or replace function public.registrar_pagamento(
  p_emprestimo uuid,
  p_cliente uuid,
  p_parcela uuid,
  p_valor bigint,
  p_forma text,
  p_data date,
  p_observacao text,
  p_operacao text default 'padrao'
) returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_saldo bigint;
  v_restante bigint;
  v_p public.parcelas%rowtype;
  v_c public.emprestimo_ciclos%rowtype;
  v_juros_pendentes bigint;
  v_total_devido bigint;
  v_abate bigint;
  v_principal bigint;
  v_novo_num int;
  v_juros bigint;
  v_venc date;
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

  -- ---------- fluxo parcelado (mantido da 0002) ----------
  if v_emp.tipo = 'parcelado' then
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
          when v_saldo <= 0 then 'quitado'
          when p_data > data_vencimento then 'atrasado'
          when p_data = data_vencimento then 'vence_hoje'
          else 'em_dia'
        end
    where id = p_emprestimo;

    return;
  end if;

  -- ---------- fluxo saldo aberto ----------
  -- garante ciclo aberto (cobre dados legados)
  select * into v_c
  from public.emprestimo_ciclos
  where emprestimo_id = p_emprestimo and status = 'aberto'
  order by numero_ciclo desc
  limit 1
  for update;

  if not found then
    raise exception 'Nenhum ciclo aberto encontrado para este empréstimo';
  end if;

  select coalesce(sum(greatest(juros_devido - juros_pago, 0)), 0) into v_juros_pendentes
  from public.emprestimo_ciclos
  where emprestimo_id = p_emprestimo;

  v_total_devido := coalesce(v_emp.saldo_devedor, 0) + v_juros_pendentes;

  if p_operacao = 'quitar' then
    if p_valor < v_total_devido then
      raise exception 'Para quitar, o valor deve cobrir o total devido';
    end if;

    update public.emprestimo_ciclos
    set juros_pago = juros_devido,
        valor_pago = valor_pago + greatest(juros_devido - juros_pago, 0)
    where emprestimo_id = p_emprestimo and juros_devido > juros_pago;

    update public.emprestimo_ciclos
    set status = 'encerrado', data_encerramento = p_data
    where emprestimo_id = p_emprestimo and status = 'aberto';

    v_emp.saldo_devedor := 0;
    v_emp.saldo_atual := 0;
    v_emp.status := 'quitado';
  elsif p_operacao = 'juros' then
    -- Pagamento APENAS dos juros pendentes: encerra o ciclo aberto
    -- e gera imediatamente o próximo ciclo (renovação por pagamento de juros).
    if coalesce(v_emp.saldo_devedor, 0) <= 0 then
      raise exception 'Saldo devedor zerado; não é possível renovar o ciclo';
    end if;

    if p_valor < v_juros_pendentes then
      raise exception 'Para pagar apenas os juros, o valor deve cobrir todos os juros pendentes';
    end if;

    v_restante := p_valor;

    -- 1) juros pendentes de ciclos encerrados (acumulam, nunca somem)
    for v_c in
      select * from public.emprestimo_ciclos
      where emprestimo_id = p_emprestimo and status = 'encerrado'
        and juros_devido > juros_pago
      order by numero_ciclo asc
      for update
    loop
      if v_restante <= 0 then
        exit;
      end if;
      v_abate := least(v_restante, v_c.juros_devido - v_c.juros_pago);
      update public.emprestimo_ciclos
      set juros_pago = juros_pago + v_abate,
          valor_pago = valor_pago + v_abate
      where id = v_c.id;
      v_restante := v_restante - v_abate;
    end loop;

    -- 2) juros do ciclo aberto
    select * into v_c
    from public.emprestimo_ciclos
    where emprestimo_id = p_emprestimo and status = 'aberto'
    order by numero_ciclo desc
    limit 1
    for update;

    if found and v_restante > 0 then
      v_abate := least(v_restante, v_c.juros_devido - v_c.juros_pago);
      update public.emprestimo_ciclos
      set juros_pago = juros_pago + v_abate,
          valor_pago = valor_pago + v_abate
      where id = v_c.id;
      v_restante := v_restante - v_abate;
    end if;

    -- 3) excesso abate o principal
    if v_restante > 0 and coalesce(v_emp.saldo_devedor, 0) > 0 then
      v_abate := least(v_restante, coalesce(v_emp.saldo_devedor, 0));
      v_emp.saldo_devedor := coalesce(v_emp.saldo_devedor, 0) - v_abate;
      v_restante := v_restante - v_abate;
      if found then
        update public.emprestimo_ciclos
        set principal_abatido = principal_abatido + v_abate,
            valor_pago = valor_pago + v_abate
        where id = v_c.id;
      end if;
    end if;

    -- 4) encerra o ciclo aberto
    if found then
      update public.emprestimo_ciclos
      set status = 'encerrado', data_encerramento = p_data
      where id = v_c.id;
    end if;

    -- 5) novo ciclo imediatamente
    v_principal := coalesce(v_emp.saldo_devedor, v_emp.valor_principal);

    if v_principal <= 0 then
      v_emp.saldo_devedor := 0;
      v_emp.saldo_atual := 0;
      v_emp.status := 'quitado';
    else
      v_novo_num := v_c.numero_ciclo + 1;
      v_juros := case
        when v_emp.juros_tipo = 'percentual'
          then round(v_principal * (v_emp.juros_valor::numeric / 10000))
        else v_emp.juros_valor
      end;
      v_venc := case
        when v_emp.juros_periodicidade = 'diario' then (p_data + v_emp.intervalo * interval '1 day')::date
        when v_emp.juros_periodicidade = 'semanal' then (p_data + v_emp.intervalo * interval '7 days')::date
        else (p_data + v_emp.intervalo * interval '1 month')::date
      end;

      insert into public.emprestimo_ciclos (
        credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
        juros_calculado, juros_devido, data_inicio, data_vencimento, status
      ) values (
        auth.uid(), p_emprestimo, v_novo_num, v_principal,
        v_juros, v_juros, p_data, v_venc, 'aberto'
      );

      v_emp.ciclo_atual := v_novo_num;
      v_emp.data_vencimento := v_venc;
      v_emp.saldo_atual := coalesce(v_emp.saldo_devedor, 0) + v_juros;
      v_emp.status := case
        when v_venc < current_date then 'atrasado'
        when v_venc = current_date then 'vence_hoje'
        else 'em_dia'
      end;
    end if;
  else
    v_restante := p_valor;

    -- 1) juros pendentes de ciclos encerrados (acumulam, nunca somem)
    for v_c in
      select * from public.emprestimo_ciclos
      where emprestimo_id = p_emprestimo and status = 'encerrado'
        and juros_devido > juros_pago
      order by numero_ciclo asc
      for update
    loop
      if v_restante <= 0 then
        exit;
      end if;
      v_abate := least(v_restante, v_c.juros_devido - v_c.juros_pago);
      update public.emprestimo_ciclos
      set juros_pago = juros_pago + v_abate,
          valor_pago = valor_pago + v_abate
      where id = v_c.id;
      v_restante := v_restante - v_abate;
    end loop;

    -- 2) juros do ciclo aberto
    select * into v_c
    from public.emprestimo_ciclos
    where emprestimo_id = p_emprestimo and status = 'aberto'
    order by numero_ciclo desc
    limit 1
    for update;

    if v_restante > 0 and found then
      v_abate := least(v_restante, v_c.juros_devido - v_c.juros_pago);
      update public.emprestimo_ciclos
      set juros_pago = juros_pago + v_abate,
          valor_pago = valor_pago + v_abate
      where id = v_c.id;
      v_restante := v_restante - v_abate;
    end if;

    -- 3) principal (sempre após os juros)
    if v_restante > 0 and coalesce(v_emp.saldo_devedor, 0) > 0 then
      v_abate := least(v_restante, coalesce(v_emp.saldo_devedor, 0));
      v_emp.saldo_devedor := coalesce(v_emp.saldo_devedor, 0) - v_abate;
      v_restante := v_restante - v_abate;

      if found then
        update public.emprestimo_ciclos
        set principal_abatido = principal_abatido + v_abate,
            valor_pago = valor_pago + v_abate
        where id = v_c.id;
      end if;
    end if;

    select coalesce(sum(greatest(juros_devido - juros_pago, 0)), 0) into v_juros_pendentes
    from public.emprestimo_ciclos
    where emprestimo_id = p_emprestimo;

    v_emp.saldo_atual := coalesce(v_emp.saldo_devedor, 0) + v_juros_pendentes;

    if coalesce(v_emp.saldo_devedor, 0) <= 0 and v_juros_pendentes <= 0 then
      v_emp.status := 'quitado';
      update public.emprestimo_ciclos
      set status = 'encerrado', data_encerramento = p_data
      where emprestimo_id = p_emprestimo and status = 'aberto';
    else
      v_emp.status := case
        when p_data > v_emp.data_vencimento then 'atrasado'
        when p_data = v_emp.data_vencimento then 'vence_hoje'
        else 'em_dia'
      end;
    end if;
  end if;

  update public.emprestimos
  set saldo_atual = v_emp.saldo_atual,
      saldo_devedor = v_emp.saldo_devedor,
      status = v_emp.status,
      ciclo_atual = v_emp.ciclo_atual,
      data_vencimento = v_emp.data_vencimento
  where id = p_emprestimo;

  insert into public.pagamentos (
    credor_id, cliente_id, emprestimo_id, parcela_id, valor,
    forma_pagamento, data_pagamento, observacao
  ) values (
    auth.uid(), p_cliente, p_emprestimo, null, p_valor,
    p_forma, p_data, p_observacao
  );
end;
$$;

-- ============================================================
-- 9. RPC: renovar_ciclo
-- Encerra o ciclo aberto atual e cria imediatamente o próximo.
-- Juros pendentes do ciclo encerrado acumulam para o futuro.
-- ============================================================
create or replace function public.renovar_ciclo(
  p_emprestimo uuid,
  p_novo_vencimento date
) returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_ciclo public.emprestimo_ciclos%rowtype;
  v_novo_num int;
  v_juros bigint;
  v_principal bigint;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  if v_emp.tipo <> 'saldo_aberto' then
    raise exception 'Renovação por ciclos é exclusiva de saldo aberto';
  end if;

  if p_novo_vencimento <= v_emp.data_vencimento then
    raise exception 'Novo vencimento deve ser posterior ao atual';
  end if;

  select * into v_ciclo
  from public.emprestimo_ciclos
  where emprestimo_id = p_emprestimo and status = 'aberto'
  order by numero_ciclo desc
  limit 1
  for update;

  if not found then
    raise exception 'Nenhum ciclo aberto encontrado';
  end if;

  v_principal := coalesce(v_emp.saldo_devedor, v_emp.valor_principal);

  update public.emprestimo_ciclos
  set status = 'encerrado',
      data_encerramento = current_date
  where id = v_ciclo.id;

  v_novo_num := v_ciclo.numero_ciclo + 1;

  v_juros := case
    when v_emp.juros_tipo = 'percentual'
      then round(v_principal * (v_emp.juros_valor::numeric / 10000))
    else v_emp.juros_valor
  end;

  insert into public.emprestimo_ciclos (
    credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
    juros_calculado, juros_devido, data_inicio, data_vencimento, status
  ) values (
    auth.uid(), p_emprestimo, v_novo_num, v_principal,
    v_juros, v_juros, current_date, p_novo_vencimento, 'aberto'
  );

  update public.emprestimos
  set ciclo_atual = v_novo_num,
      data_vencimento = p_novo_vencimento,
      saldo_atual = v_principal + v_juros + greatest(v_ciclo.juros_devido - v_ciclo.juros_pago, 0),
      status = case
        when p_novo_vencimento < current_date then 'atrasado'
        when p_novo_vencimento = current_date then 'vence_hoje'
        else 'em_dia'
      end
  where id = p_emprestimo;
end;
$$;

-- ============================================================
-- 10. RPC: renegociar_ciclo
-- Registra juros original (juros_calculado), renegociado,
-- data e usuário. O juros original nunca é apagado.
-- ============================================================
create or replace function public.renegociar_ciclo(
  p_emprestimo uuid,
  p_juros_renegociado bigint,
  p_observacao text default null
) returns void
language plpgsql
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_ciclo public.emprestimo_ciclos%rowtype;
  v_diff bigint;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  select * into v_ciclo
  from public.emprestimo_ciclos
  where emprestimo_id = p_emprestimo and status = 'aberto'
  order by numero_ciclo desc
  limit 1
  for update;

  if not found then
    raise exception 'Nenhum ciclo aberto encontrado';
  end if;

  if p_juros_renegociado < 0 then
    raise exception 'Juros renegociado não pode ser negativo';
  end if;

  if p_juros_renegociado > v_ciclo.juros_calculado then
    raise exception 'Juros renegociado não pode exceder o juros original';
  end if;

  v_diff := v_ciclo.juros_calculado - p_juros_renegociado;

  update public.emprestimo_ciclos
  set juros_renegociado = p_juros_renegociado,
      juros_devido = p_juros_renegociado,
      renegociado_data = current_date,
      renegociado_por = auth.uid()
  where id = v_ciclo.id;

  update public.emprestimos
  set saldo_atual = greatest(saldo_atual - v_diff, 0)
  where id = p_emprestimo;
end;
$$;

-- ============================================================
-- 11. RPC: recalcular_score (alinhado ao frontend)
-- Classificação qualitativa: excelente/bom/regular/ruim, com
-- pontos fixos por classe (900/700/500/250). O vencimento de
-- referência de cada pagamento usa parcela (parcelado) ou o
-- ciclo vigente na data do pagamento (saldo aberto).
-- ============================================================
create or replace function public.recalcular_score(p_cliente uuid) returns int
language plpgsql
as $$
declare
  v_credor uuid;
  v_total int;
  v_quitados int;
  v_atrasos_atuais int;
  v_dias_atual int;
  v_total_pagamentos int := 0;
  v_em_dia int := 0;
  v_antecipados int := 0;
  v_atrasados int := 0;
  v_dias_max int := 0;
  v_taxa numeric;
  v_classificacao text;
  v_score int;
  r record;
begin
  select credor_id into v_credor from public.clientes where id = p_cliente;
  if v_credor is null or v_credor <> auth.uid() then
    raise exception 'Cliente não encontrado';
  end if;

  select count(*) into v_total from public.emprestimos where cliente_id = p_cliente;
  select count(*) into v_quitados from public.emprestimos where cliente_id = p_cliente and saldo_atual <= 0;
  select count(*) into v_atrasos_atuais from public.emprestimos
    where cliente_id = p_cliente and saldo_atual > 0 and data_vencimento < current_date;
  select coalesce(max(current_date - data_vencimento), 0) into v_dias_atual from public.emprestimos
    where cliente_id = p_cliente and saldo_atual > 0 and data_vencimento < current_date;

  -- Para cada pagamento: vencimento de referência (parcela, ciclo vigente ou vencimento do empréstimo)
  for r in
    select p.data_pagamento,
           coalesce(
             case when p.parcela_id is not null then
               (select pa.data_vencimento from public.parcelas pa where pa.id = p.parcela_id)
             end,
             (select c.data_vencimento from public.emprestimo_ciclos c
               where c.emprestimo_id = p.emprestimo_id and c.data_inicio <= p.data_pagamento
               order by c.numero_ciclo desc limit 1),
             e.data_vencimento
           ) as venc,
           e.data_vencimento as venc_emprestimo
    from public.pagamentos p
    join public.emprestimos e on e.id = p.emprestimo_id
    where p.cliente_id = p_cliente
  loop
    v_total_pagamentos := v_total_pagamentos + 1;
    if r.venc is not null then
      if r.data_pagamento <= r.venc then
        v_em_dia := v_em_dia + 1;
        if r.data_pagamento < r.venc - 3 then
          v_antecipados := v_antecipados + 1;
        end if;
      elsif r.data_pagamento > r.venc then
        v_atrasados := v_atrasados + 1;
        v_dias_max := greatest(v_dias_max, r.data_pagamento - r.venc);
      end if;
    end if;
  end loop;

  v_dias_max := greatest(v_dias_max, v_dias_atual);

  -- Classificação qualitativa (espelha src/services/financial/score.ts)
  if v_total = 0 or (v_total_pagamentos = 0 and v_atrasos_atuais = 0) then
    v_classificacao := 'regular';
  elsif v_atrasados = 0 and v_atrasos_atuais = 0 then
    v_classificacao := 'excelente';
  else
    v_taxa := case when v_total_pagamentos > 0 then v_atrasados::numeric / v_total_pagamentos else 1 end;
    if v_taxa >= 0.5 or v_dias_max > 30 then
      v_classificacao := 'ruim';
    else
      v_classificacao := 'bom';
    end if;
  end if;

  v_score := case v_classificacao
    when 'excelente' then 900
    when 'bom' then 700
    when 'ruim' then 250
    else 500
  end;

  insert into public.score_historico (credor_id, cliente_id, score, motivo)
  values (v_credor, p_cliente, v_score, 'Recalculo automatico');

  return v_score;
end;
$$;

-- ============================================================
-- 12. RPC legado renovar_emprestimo
-- Mantido apenas para compatibilidade; delega ao novo fluxo.
-- ============================================================
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
begin
  perform public.renovar_ciclo(p_emprestimo, p_novo_vencimento);
end;
$$;

notify pgrst, 'reload schema';
