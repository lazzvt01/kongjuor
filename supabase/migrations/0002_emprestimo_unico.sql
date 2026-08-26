-- ============================================================
-- KONGjuros — Migração 0002
-- Unifica "pagamento único" e "juros + renovação" em um só tipo
-- e adiciona campos de garantia.
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

-- ---------- novas colunas em emprestimos ----------
alter table public.emprestimos add column if not exists saldo_devedor bigint;
alter table public.emprestimos add column if not exists deixou_garantia boolean not null default false;
alter table public.emprestimos add column if not exists garantia text;

-- ---------- RPC: criar empréstimo ----------
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
  p_parcelas jsonb default null,
  p_saldo_devedor bigint default null,
  p_deixou_garantia boolean default false,
  p_garantia text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.emprestimos (
    credor_id, cliente_id, tipo, valor_principal, juros_tipo, juros_valor,
    juros_periodicidade, data_inicio, data_vencimento, valor_total, saldo_atual,
    saldo_devedor, status, quantidade_parcelas, ciclo_atual, deixou_garantia, garantia
  ) values (
    auth.uid(), p_cliente, p_tipo, p_valor_principal, p_juros_tipo, p_juros_valor,
    p_juros_periodicidade, p_data_inicio, p_data_vencimento, p_valor_total, p_saldo_atual,
    p_saldo_devedor, 'ativo', p_quantidade_parcelas, 1, p_deixou_garantia, p_garantia
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

-- ---------- RPC: registrar pagamento ----------
-- Para empréstimos do tipo único (pagamento único / juros + renovação):
--   p_operacao = 'juros'       -> paga apenas os juros do período (renova o contrato)
--   p_operacao = 'juros_abate' -> paga juros + abate do saldo devedor
--                                 (novo juros é cobrado sobre o saldo devedor atual)
--   p_operacao = 'quitar'      -> quita 100% do contrato
-- Para empréstimos parcelados o comportamento original é mantido.
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
  v_saldo_devedor bigint;
  v_juros_periodo bigint;
  v_abate bigint;
  v_juros_novo bigint;
  v_novo_vencimento date;
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

  -- ---------- fluxo do tipo único ----------
  if v_emp.tipo in ('unico', 'renovavel') then
    v_saldo_devedor := coalesce(v_emp.saldo_devedor, v_emp.valor_principal);
    if v_emp.tipo = 'renovavel' and v_emp.saldo_devedor is null then
      -- legado: saldo_atual guardava apenas os juros do período
      v_juros_periodo := v_emp.saldo_atual;
    else
      v_juros_periodo := greatest(v_emp.saldo_atual - v_saldo_devedor, 0);
    end if;

    if p_operacao in ('juros', 'juros_abate') then
      if p_valor < v_juros_periodo then
        raise exception 'Valor insuficiente para cobrir os juros do período';
      end if;
      v_abate := p_valor - v_juros_periodo;
      if v_abate > v_saldo_devedor then
        raise exception 'Abate não pode superar o saldo devedor';
      end if;
      v_saldo_devedor := v_saldo_devedor - v_abate;

      if v_saldo_devedor <= 0 then
        v_emp.saldo_atual := 0;
        v_emp.saldo_devedor := 0;
        v_emp.status := 'quitado';
      else
        v_juros_novo := case
          when v_emp.juros_tipo = 'percentual' then round(v_saldo_devedor * (v_emp.juros_valor::numeric / 10000))
          else v_emp.juros_valor
        end;
        v_novo_vencimento := case v_emp.juros_periodicidade
          when 'diario' then v_emp.data_vencimento + 1
          when 'semanal' then v_emp.data_vencimento + 7
          else v_emp.data_vencimento + interval '1 month'
        end;

        insert into public.renovacoes (
          credor_id, emprestimo_id, data_renovacao, ciclo_anterior, juros_pago,
          capital_renovado, novo_vencimento, observacao
        ) values (
          auth.uid(), p_emprestimo, p_data, v_emp.ciclo_atual, v_juros_periodo,
          v_saldo_devedor, v_novo_vencimento, 'Renovação automática após pagamento'
        );

        v_emp.saldo_devedor := v_saldo_devedor;
        v_emp.saldo_atual := v_saldo_devedor + v_juros_novo;
        v_emp.data_vencimento := v_novo_vencimento;
        v_emp.ciclo_atual := v_emp.ciclo_atual + 1;
        v_emp.status := case
          when v_novo_vencimento < p_data then 'atrasado'
          when v_novo_vencimento = p_data then 'vence_hoje'
          else 'em_dia'
        end;
      end if;
    elsif p_operacao = 'quitar' then
      if p_valor < v_emp.saldo_atual then
        raise exception 'Para quitar, o valor deve cobrir o total devido';
      end if;
      v_emp.saldo_atual := 0;
      v_emp.saldo_devedor := 0;
      v_emp.status := 'quitado';
    else
      v_emp.saldo_atual := greatest(v_emp.saldo_atual - p_valor, 0);
      v_emp.saldo_devedor := greatest(v_emp.saldo_devedor - p_valor, 0);
      v_emp.status := case when v_emp.saldo_atual <= 0 then 'quitado' else v_emp.status end;
    end if;

    insert into public.pagamentos (
      credor_id, cliente_id, emprestimo_id, parcela_id, valor,
      forma_pagamento, data_pagamento, observacao
    ) values (
      auth.uid(), p_cliente, p_emprestimo, null, p_valor,
      p_forma, p_data, p_observacao
    );

    update public.emprestimos
    set saldo_atual = v_emp.saldo_atual,
        saldo_devedor = v_emp.saldo_devedor,
        data_vencimento = v_emp.data_vencimento,
        ciclo_atual = v_emp.ciclo_atual,
        status = v_emp.status
    where id = p_emprestimo;

    return;
  end if;

  -- ---------- fluxo parcelado (original) ----------
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

notify pgrst, 'reload schema';
