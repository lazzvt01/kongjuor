-- ============================================================
-- KONGjuros — Migração 0007
-- Editar e excluir empréstimo
--   * colunas de rastreio: editado_em, editado_por
--   * nova tabela: emprestimo_historico (log de criado/editado/excluido)
--   * RPC: editar_emprestimo (recalcula pendências preservando pagamentos)
--   * RPC: excluir_emprestimo (cascade + recalc score)
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

-- ---------- 1. colunas de rastreio em emprestimos ----------
alter table public.emprestimos add column if not exists editado_em timestamptz;
alter table public.emprestimos add column if not exists editado_por uuid;

-- ---------- 2. tabela emprestimo_historico ----------
create table if not exists public.emprestimo_historico (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  emprestimo_id uuid references public.emprestimos(id) on delete set null,
  numero bigint,
  tipo text not null check (tipo in ('criado','editado','excluido')),
  campos text,
  detalhe text,
  created_at timestamptz not null default now()
);

create index if not exists idx_emprestimo_historico_emprestimo
  on public.emprestimo_historico(emprestimo_id);
create index if not exists idx_emprestimo_historico_credor
  on public.emprestimo_historico(credor_id, created_at);

alter table public.emprestimo_historico enable row level security;

drop policy if exists "emprestimo_historico_select_own" on public.emprestimo_historico;
create policy "emprestimo_historico_select_own" on public.emprestimo_historico
  for select using (credor_id = auth.uid());

drop policy if exists "emprestimo_historico_insert_own" on public.emprestimo_historico;
create policy "emprestimo_historico_insert_own" on public.emprestimo_historico
  for insert with check (credor_id = auth.uid());

-- ============================================================
-- 3. RPC: editar_emprestimo
-- Recalcula as pendências a partir dos novos parâmetros e
-- preserva o histórico de pagamentos (novo total - já pago).
-- ============================================================
create or replace function public.editar_emprestimo(
  p_emprestimo uuid,
  p_valor_principal bigint,
  p_juros_tipo text,
  p_juros_valor bigint,
  p_juros_periodicidade text,
  p_intervalo int,
  p_data_inicio date,
  p_data_vencimento date,
  p_forma_juros text,
  p_quantidade_parcelas int,
  p_parcelas jsonb,
  p_ciclos jsonb,
  p_deixou_garantia boolean,
  p_garantia text,
  p_observacao text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.emprestimos%rowtype;
  v_cliente uuid;
  v_saldo_antigo bigint;
  v_total_pago bigint;
  v_total_pendente bigint := 0;
  v_novo_total bigint;
  v_novo_saldo bigint;
  v_restante bigint;
  v_abate bigint;
  v_juros_pendentes bigint;
  v_venc date;
  v_campos text := '';
  r record;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  if p_valor_principal is null or p_valor_principal < 0 then
    raise exception 'Valor do principal inválido';
  end if;
  if p_juros_valor is null or p_juros_valor < 0 then
    raise exception 'Valor de juros inválido';
  end if;
  if p_intervalo is null or p_intervalo < 1 then
    raise exception 'Intervalo inválido';
  end if;

  v_cliente := v_emp.cliente_id;
  v_saldo_antigo := v_emp.saldo_atual;

  if v_emp.tipo = 'parcelado' then
    -- total já pago (pagamentos são preservados; parcela_id fica null)
    select coalesce(sum(valor), 0) into v_total_pago
    from public.pagamentos where emprestimo_id = p_emprestimo;

    -- apaga as parcelas existentes (pagamentos sobrevivem via on delete set null)
    delete from public.parcelas where emprestimo_id = p_emprestimo;

    -- insere as parcelas recalculadas
    if p_parcelas is not null and p_parcelas <> 'null'::jsonb then
      insert into public.parcelas (
        credor_id, emprestimo_id, numero, data_vencimento,
        valor_principal, valor_juros, valor_total, valor_pago, saldo, status
      )
      select
        auth.uid(), p_emprestimo, (rec->>'numero')::int, (rec->>'data_vencimento')::date,
        (rec->>'valor_principal')::bigint, (rec->>'valor_juros')::bigint,
        (rec->>'valor_total')::bigint, 0, (rec->>'valor_total')::bigint, 'pendente'
      from jsonb_array_elements(p_parcelas) as rec;

      select coalesce(sum(valor_total), 0) into v_total_pendente
      from public.parcelas where emprestimo_id = p_emprestimo;

      -- distribui o total já pago pelas parcelas novas (abatimento em ordem)
      v_restante := v_total_pago;
      for r in
        select id, valor_total from public.parcelas
        where emprestimo_id = p_emprestimo
        order by numero asc
        for update
      loop
        if v_restante <= 0 then
          exit;
        end if;
        v_abate := least(v_restante, r.valor_total);
        update public.parcelas
        set valor_pago = v_abate,
            saldo = valor_total - v_abate,
            status = case
              when v_abate >= valor_total then 'pago'
              when v_abate > 0 then 'parcial'
              else 'pendente'
            end
        where id = r.id;
        v_restante := v_restante - v_abate;
      end loop;
    end if;

    v_novo_total := v_total_pendente;
    v_novo_saldo := greatest(v_novo_total - v_total_pago, 0);

    select max(data_vencimento) into v_venc
    from public.parcelas where emprestimo_id = p_emprestimo;
  else
    -- saldo aberto: mantém ciclos encerrados, substitui o aberto
    delete from public.emprestimo_ciclos
    where emprestimo_id = p_emprestimo and status = 'aberto';

    if p_ciclos is not null and p_ciclos <> 'null'::jsonb then
      insert into public.emprestimo_ciclos (
        credor_id, emprestimo_id, numero_ciclo, saldo_principal_inicial,
        juros_calculado, juros_devido, data_inicio, data_vencimento, status
      )
      select
        auth.uid(), p_emprestimo, (rec->>'numero_ciclo')::int,
        (rec->>'saldo_principal_inicial')::bigint,
        (rec->>'juros_calculado')::bigint, (rec->>'juros_devido')::bigint,
        (rec->>'data_inicio')::date, (rec->>'data_vencimento')::date, 'aberto'
      from jsonb_array_elements(p_ciclos) as rec;
    end if;

    -- novo saldo devedor = novo principal informado na edição
    v_emp.saldo_devedor := p_valor_principal;

    -- invariante: saldo_atual = saldo_devedor + juros pendentes (todos os ciclos)
    select coalesce(sum(greatest(juros_devido - juros_pago, 0)), 0) into v_juros_pendentes
    from public.emprestimo_ciclos where emprestimo_id = p_emprestimo;

    v_novo_saldo := coalesce(v_emp.saldo_devedor, 0) + v_juros_pendentes;
    v_novo_total := v_novo_saldo;

    select max(numero_ciclo) into v_emp.ciclo_atual
    from public.emprestimo_ciclos where emprestimo_id = p_emprestimo;

    select max(data_vencimento) into v_venc
    from public.emprestimo_ciclos
    where emprestimo_id = p_emprestimo and status = 'aberto';
  end if;

  if v_emp.valor_principal is distinct from p_valor_principal then
    v_campos := v_campos || 'valor_principal,';
  end if;
  if v_emp.juros_tipo is distinct from p_juros_tipo
     or v_emp.juros_valor is distinct from p_juros_valor
     or v_emp.juros_periodicidade is distinct from p_juros_periodicidade then
    v_campos := v_campos || 'juros,';
  end if;
  if v_emp.data_inicio is distinct from p_data_inicio then
    v_campos := v_campos || 'data_inicio,';
  end if;
  if v_emp.data_vencimento is distinct from v_venc then
    v_campos := v_campos || 'data_vencimento,';
  end if;
  if v_emp.saldo_atual is distinct from v_novo_saldo then
    v_campos := v_campos || 'saldo_atual,';
  end if;
  if v_emp.deixou_garantia is distinct from p_deixou_garantia
     or v_emp.garantia is distinct from p_garantia then
    v_campos := v_campos || 'garantia,';
  end if;
  if v_emp.observacao is distinct from p_observacao then
    v_campos := v_campos || 'observacao,';
  end if;

  update public.emprestimos
  set valor_principal = p_valor_principal,
      juros_tipo = p_juros_tipo,
      juros_valor = p_juros_valor,
      juros_periodicidade = p_juros_periodicidade,
      intervalo = p_intervalo,
      data_inicio = p_data_inicio,
      data_vencimento = coalesce(v_venc, p_data_vencimento),
      valor_total = v_novo_total,
      saldo_atual = v_novo_saldo,
      saldo_devedor = v_emp.saldo_devedor,
      forma_juros = p_forma_juros,
      quantidade_parcelas = case
        when v_emp.tipo = 'parcelado' then p_quantidade_parcelas
        else quantidade_parcelas
      end,
      ciclo_atual = v_emp.ciclo_atual,
      deixou_garantia = p_deixou_garantia,
      garantia = nullif(trim(coalesce(p_garantia, '')), ''),
      observacao = nullif(trim(coalesce(p_observacao, '')), ''),
      status = case
        when v_novo_saldo <= 0 then 'quitado'
        when coalesce(v_venc, p_data_vencimento) < current_date then 'atrasado'
        when coalesce(v_venc, p_data_vencimento) = current_date then 'vence_hoje'
        else 'em_dia'
      end,
      editado_em = now(),
      editado_por = auth.uid()
  where id = p_emprestimo;

  if v_campos = '' then
    v_campos := 'sem alteracoes';
  else
    v_campos := rtrim(v_campos, ',');
  end if;

  insert into public.emprestimo_historico (
    credor_id, emprestimo_id, numero, tipo, campos, detalhe
  ) values (
    auth.uid(), p_emprestimo, v_emp.numero, 'editado', v_campos,
    'saldo ' || v_saldo_antigo || ' -> ' || v_novo_saldo
  );

  perform public.recalcular_score(v_cliente);
end;
$$;

-- ============================================================
-- 4. RPC: excluir_emprestimo
-- Grava log 'excluido' (sobrevive à exclusão via on delete set null)
-- e apaga em cascata (parcelas, ciclos, pagamentos, renovacoes).
-- score_historico é preservado; recalcula o score do cliente.
-- ============================================================
create or replace function public.excluir_emprestimo(p_emprestimo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.emprestimos%rowtype;
begin
  select * into v_emp
  from public.emprestimos
  where id = p_emprestimo and credor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;

  insert into public.emprestimo_historico (
    credor_id, emprestimo_id, numero, tipo, campos, detalhe
  ) values (
    auth.uid(), p_emprestimo, v_emp.numero, 'excluido', 'todos',
    'Empréstimo ' || coalesce('#' || lpad(v_emp.numero::text, 4, '0'), v_emp.id::text) || ' excluído'
  );

  delete from public.emprestimos where id = p_emprestimo;

  perform public.recalcular_score(p_cliente => v_emp.cliente_id);
end;
$$;

-- ---------- 5. grants ----------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.editar_emprestimo(uuid, bigint, text, bigint, text, int, date, date, text, int, jsonb, jsonb, boolean, text, text) to authenticated';
    execute 'grant execute on function public.excluir_emprestimo(uuid) to authenticated';
  end if;
end;
$$;

notify pgrst, 'reload schema';
