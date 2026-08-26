-- ============================================================
-- KONGjuros — Migração 0003
-- Número sequencial por credor para identificar cada empréstimo
-- (Ex.: Empréstimo #0001, #0002...). Usado no recebimento,
-- renovações e histórico.
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

-- ---------- coluna numero ----------
alter table public.emprestimos add column if not exists numero bigint;

-- ---------- backfill: numera os empréstimos existentes por credor ----------
do $$
declare
  r record;
  v_credor uuid := null;
  v_num bigint := 0;
begin
  for r in
    select id, credor_id
    from public.emprestimos
    order by credor_id, created_at, id
  loop
    if v_credor is distinct from r.credor_id then
      v_credor := r.credor_id;
      v_num := 1;
    else
      v_num := v_num + 1;
    end if;
    update public.emprestimos set numero = v_num where id = r.id;
  end loop;
end;
$$;

create unique index if not exists idx_emprestimos_numero_credor
  on public.emprestimos (credor_id, numero);

-- ---------- trigger: atribui o próximo número ao inserir ----------
create or replace function public.atribuir_numero_emprestimo()
returns trigger
language plpgsql
as $$
declare
  v_num bigint;
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1
    into v_num
    from public.emprestimos
    where credor_id = new.credor_id;
    new.numero := v_num;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_emprestimos_numero on public.emprestimos;
create trigger trg_emprestimos_numero
  before insert on public.emprestimos
  for each row execute function public.atribuir_numero_emprestimo();

notify pgrst, 'reload schema';
