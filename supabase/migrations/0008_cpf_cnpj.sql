-- ============================================================
-- KONGjuros — Migração 0008
-- CPF/CNPJ do credor (exigido pelo Asaas para criar cobranças)
--   * nova coluna: profiles.cpf_cnpj
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- ============================================================

alter table public.profiles add column if not exists cpf_cnpj text;

notify pgrst, 'reload schema';
