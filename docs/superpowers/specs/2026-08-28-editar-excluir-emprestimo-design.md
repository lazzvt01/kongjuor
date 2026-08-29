# Editar e Excluir Empréstimo — Design

**Data:** 2026-08-28
**Status:** Aprovado pelo usuário (seções 1–4)
**Objetivo:** Permitir que o **credor comum** (no app normal) edite os dados de um empréstimo próprio e o exclua, com confirmação, recalculando pendências e o score do cliente.

## Decisões de escopo

1. **Quem:** apenas o credor dono do empréstimo (app normal). O painel admin **não** recebe essa feature.
2. **Exclusão:** qualquer empréstimo pode ser excluído, sob confirmação do credor antes de finalizar. Exclusão em **cascade completo** (parcelas, ciclos, pagamentos, renovações, score_historico) e **recalcula o score** do cliente.
3. **Edição:** campos editáveis — valores e datas (principal, juros, periodicidade, intervalo, vencimentos), pagamentos registrados, dados do cliente, garantia e observação, vencimentos de parcelas individuais.
4. **Valores com pagamentos:** editar valores (principal/juros) é permitido **mesmo com pagamentos**; o saldo é recalculado como **novo total − já pago**, preservando o histórico de pagamentos.
5. **UI:** botões Editar e Excluir na tela de **Detalhe do Empréstimo**; editar abre o mesmo formulário de criação pré-preenchido (`/emprestimos/:id/editar`).

## Modelo de dados (migration `0007_editar_excluir_emprestimo.sql`)

### `emprestimos` — colunas novas (rastreio de edição)

```sql
alter table public.emprestimos add column if not exists editado_em timestamptz;
alter table public.emprestimos add column if not exists editado_por uuid;
```

### `emprestimo_historico` (log de alterações)

```sql
create table if not exists public.emprestimo_historico (
  id uuid primary key default gen_random_uuid(),
  credor_id uuid not null references public.profiles(id) on delete cascade,
  emprestimo_id uuid references public.emprestimos(id) on delete set null,
  numero bigint,        -- número do empréstimo capturado no momento (sobrevive à exclusão)
  tipo text not null check (tipo in ('criado','editado','excluido')),
  campos text,          -- lista de campos alterados (ex.: 'valor_total,saldo_atual')
  detalhe text,         -- descrição livre (ex.: 'saldo 5000 -> 4500')
  created_at timestamptz not null default now()
);

create index if not exists idx_emprestimo_historico_emprestimo
  on public.emprestimo_historico(emprestimo_id);
create index if not exists idx_emprestimo_historico_credor
  on public.emprestimo_historico(credor_id, created_at);
```

- RLS: `select`/`insert` do próprio credor (`credor_id = auth.uid()`); escrita na prática ocorre via RPCs `security definer`.
- **`emprestimo_id` usa `on delete set null`** (não `cascade`): o log do tipo `excluido` precisa sobreviver à exclusão. O `numero` é gravado no momento do registro para que o log identifique o empréstimo mesmo depois de apagado.

> **Cascade na exclusão:** `parcelas`, `emprestimo_ciclos`, `pagamentos` e `renovacoes` têm FK `on delete cascade` para `emprestimos` (0001/0004) e são apagados automaticamente. `score_historico` **não** tem FK para `emprestimos` (só para `clientes`) — ele é **preservado** na exclusão; o `recalcular_score` adiciona uma nova entrada refletindo a carteira atual (histórico do cliente permanece íntegro).

## RPCs (todos `security definer`)

### `editar_emprestimo`

```sql
editar_emprestimo(
  p_emprestimo uuid,
  p_valor_principal bigint,
  p_juros_tipo text,
  p_juros_valor bigint,
  p_juros_periodicidade text,
  p_intervalo int,
  p_data_inicio date,
  p_data_vencimento date,
  p_forma_juros text,        -- parcelado
  p_quantidade_parcelas int, -- parcelado
  p_parcelas jsonb,          -- parcelas pendentes recalculadas (sem as pagas)
  p_ciclos jsonb,            -- ciclos pendentes recalculados
  p_deixou_garantia boolean,
  p_garantia text,
  p_observacao text
) returns void
```

Regras:
- Valida `credor_id = auth.uid()` e empréstimo existente (`raise exception 'Empréstimo não encontrado'`).
- Atualiza os campos de **configuração** (principal, juros, periodicidade, intervalo, datas, forma, quantidade, garantia, observação) no `emprestimos`.
- **Recalculo de pendências:**
  - **Parcelado:** apaga as parcelas existentes (`pagamentos.parcela_id` tem `on delete set null`, então os pagamentos são preservados) e insere as parcelas recalculadas (`p_parcelas`, numeradas 1..N). `valor_total` = soma das parcelas novas. `saldo_atual` = `greatest(valor_total - total_pago, 0)`, onde `total_pago` = soma dos `pagamentos.valor` do empréstimo. Em seguida distribui `total_pago` pelas parcelas novas em ordem (marcando `pago`/`parcial`), replicando a lógica de abatimento do `registrar_pagamento`.
  - **Saldo aberto:** mantém os ciclos **encerrados** com seu histórico (`juros_pago`/`principal_abatido`). Substitui o ciclo **aberto** pelo recalculado (`p_ciclos`): `saldo_principal_inicial` = novo saldo devedor, `juros_devido` = juros calculado sobre o novo saldo, `data_vencimento` = novo vencimento. `saldo_devedor` = novo principal (informado na edição). `saldo_atual` = `saldo_devedor + soma(juros pendentes de todos os ciclos)`, mantendo a invariante do motor (`saldo_atual = saldo_devedor + juros pendentes`).
- `data_vencimento` do empréstimo recebe o vencimento da última parcela/ciclo novo (ou o vencimento informado).
- Define `status` conforme saldo/vencimento (`quitado`, `atrasado`, `vence_hoje`, `em_dia`).
- Grava `emprestimo_historico` (`editado`, campos alterados, detalhe com `saldo X -> Y`).
- Atualiza `editado_em`/`editado_por` e chama `recalcular_score(cliente)`.

### `excluir_emprestimo`

```sql
excluir_emprestimo(p_emprestimo uuid) returns void
```

Regras:
- Valida `credor_id = auth.uid()` e empréstimo existente.
- Grava `emprestimo_historico` (`excluido`) **antes** de apagar (para preservar o log apesar do cascade).
- `delete from public.emprestimos where id = p_emprestimo` (cascade remove parcelas, ciclos, pagamentos, renovações, score_historico).
- Chama `recalcular_score(cliente)` após a exclusão (usando o `cliente_id` lido antes).

### Grants

Grants de execução para `authenticated` (e `anon` quando necessário) envolvidos em `DO` block com checagem de role (padrão da 0005), para compatibilidade com ambiente local.

## Frontend

### Service (`src/services/api/emprestimos.ts`)

- `editarEmprestimo(id, input)` — monta parcelas/ciclos pendentes via `construirEmprestimo`-like e chama RPC `editar_emprestimo`; depois `recalcular_score` (best-effort).
- `excluirEmprestimo(id)` — chama RPC `excluir_emprestimo`.

### Rota

- `/emprestimos/:id/editar` → componente `NovoEmprestimo` em **modo edição** (preenchido com os dados atuais).

### `NovoEmprestimo.tsx` (modo edição)

- Lê `useParams` para `id` de edição; carrega o empréstimo e preenche os campos.
- Bloqueia troca de **tipo** (parcelado ↔ saldo aberto) na edição.
- Cliente exibido mas **não trocável** (o cliente já foi escolhido na criação; trocar cliente não faz parte do escopo — dados do cliente são editados em EditarCliente).
- Ao salvar: monta parcelas/ciclos pendentes com a mesma lógica de criação e chama `editarEmprestimo`.
- Botão de submit: "Salvar alterações".

### `DetalheEmprestimo.tsx`

- No cabeçalho (ou rodapé de ações): botão **Editar** (outline, ícone `Pencil`) → `/emprestimos/:id/editar`.
- Botão **Excluir** (destructive, ícone `Trash2`) → dialog de confirmação com aviso de que apaga empréstimo, parcelas, ciclos, pagamentos e renovações de forma permanente → confirma → `excluirEmprestimo` → toast + navega para `/emprestimos`.
- Excluir fica disponível para qualquer status (inclusive quitado).

### Hooks

- `useEmprestimoDetalhe` já cobre carregamento; não precisa de hook novo.
- `NovoEmprestimo` ganha carregamento de edição (skeleton enquanto busca).

## Segurança

- RPCs `security definer` validam `credor_id = auth.uid()` sempre; nenhum caminho permite editar/excluir empréstimo de outro credor.
- RLS existente (`emprestimos_delete_own`) já limita delete direto ao dono; a exclusão via RPC passa por cima para gravar histórico e recalcular score, mas com a mesma validação de dono.
- `editar_emprestimo` valida que `p_valor_principal >= 0`, juros `>= 0`, quantidade/intervalo `>= 1` (spread de erros via `raise exception`).
- Nunca altera `credor_id`/`cliente_id` no `emprestimos`.

## Testes e validação

- Aplicar `0007_editar_excluir_emprestimo.sql` em banco local (kongtest8) com auth stub e na nuvem (pooler).
- Cenários SQL:
  1. Editar valores de parcelado **sem** pagamentos → parcelas recalculadas, `valor_total`/`saldo_atual` novos, histórico `editado`.
  2. Editar valores de parcelado **com** pagamentos → parcelas pagas preservadas, pendentes recalculadas, `saldo_atual` = novo total − pago.
  3. Editar saldo aberto com ciclos encerrados → ciclos abertos/pendentes recalculados, pagos preservados.
  4. Excluir empréstimo → cascade apaga parcelas/ciclos/pagamentos/renovações/score_historico; `emprestimo_historico` registra `excluido`; `recalcular_score` roda.
  5. Credor B não consegue editar/excluir empréstimo do credor A (erro de permissão).
  6. Usuário anon não consegue chamar RPCs.
- `npx tsc -b`, `npx oxlint`, `npm run build`, testes TS existentes (21).
- Deploy: migration via pooler.

## Fora de escopo (YAGNI)

- Trocar o cliente de um empréstimo na edição.
- Edição de empréstimos pelo painel admin.
- Exclusão lógica (soft delete) / status `cancelado`.
- Desfazer (undo) após edição/exclusão.
