# KONGjuros

Gerenciador simples de empréstimos para credores. Mobile-first, PWA-ready, feito com React + TypeScript + Tailwind CSS + Supabase.

## Como rodar

```bash
npm install
npm run dev
```

## Configuração do Supabase

O app usa Supabase para autenticação, banco de dados e RLS.

1. Crie um projeto no [Supabase](https://supabase.com).
2. Abra **SQL Editor** e execute todo o conteúdo de `supabase/migrations/`, em ordem (0001 → 0005). Isso cria:
   - tabelas `profiles`, `clientes`, `emprestimos`, `parcelas`, `pagamentos`, `renovacoes`, `score_historico`, `emprestimo_ciclos`, `planos`, `assinaturas`;
   - índices, triggers de `updated_at` e criação automática de perfil;
   - RLS completo (cada credor enxerga apenas os próprios dados);
   - funções RPC atômicas (`criar_emprestimo`, `registrar_pagamento`, `renovar_emprestimo`, `recalcular_score`, `plano_atual`, `resumo_plano`).
3. Em **Authentication → Providers → Email**: desative **"Confirm email"** para que o cadastro entre automaticamente (o e-mail usado é interno, gerado a partir do WhatsApp — ex.: `88900000000@juros.com` — e não é exibido ao usuário).
4. Em **Authentication → URL Configuration**: adicione a URL do seu app às **Redirect URLs** (ex.: `http://localhost:5173` e o domínio de preview).

### Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=sua-url-do-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable/anon
```

> Os valores do projeto configurado já estão presentes em `.env`.

## Como o acesso funciona

- O credor faz login com **WhatsApp + senha**.
- Internamente o WhatsApp é normalizado (somente dígitos) e vira um e-mail fictício `NUMERO@juros.com` usado pelo Supabase Auth.
- O e-mail interno nunca aparece na interface.
- A recuperação de senha dispara um e-mail de reset para o endereço interno; para e-mails reais, configure um domínio verificado no Supabase (Auth → SMTP / Custom SMTP).

## Estrutura do projeto

```
src/
  pages/          telas (auth + app)
  components/     ui (shadcn) + shared + layout
  hooks/          estado de autenticação, dados, tema
  services/
    financial/    regras financeiras (juros, parcelas, saldo, status, score)
    api/          integração Supabase (RPC e queries)
  lib/            utils, formatação, telefone, validações, cliente Supabase
  types/          tipos do domínio
supabase/
  migrations/     SQL de schema + RLS + RPCs
  functions/      Edge Functions (asaas-checkout, asaas-webhook)
```

## Planos de assinatura

O app tem planos com limite de empréstimos ativos (Free 5 / Básico 25 / Pro 50 /
Pro Max ilimitado) e cobrança recorrente via Asaas (PIX). O deploy das Edge
Functions e a configuração do webhook exigem o Supabase CLI — veja o passo a
passo completo em `docs/DEPLOY_PLANOS.md`.

## Regras financeiras

- Valores monetários são armazenados em **centavos** (inteiros) no banco e nos serviços.
- Juros percentuais são armazenados em **centésimos de ponto percentual** (ex.: `12,5%` → `1250`).
- Todos os cálculos (juros, total, parcelas, saldo, status, score) ficam centralizados em `src/services/financial/` — nenhuma tela calcula valores diretamente.

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção + PWA
npm run preview    # pré-visualiza o build
npm run lint       # oxlint
```
