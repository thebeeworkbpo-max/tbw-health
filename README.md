# TBW Health · Gestão da Clínica

Plataforma da TBW Health para clínicas: precificação por procedimento com CMV e CSV, planejamento orçamentário,
DRE e fluxo de caixa (DFC) orçado × realizado, e importação do realizado a partir da exportação do ERP.

- **Front-end:** Vite + JavaScript (sem framework). Motor de cálculo em `src/engine.js`, idêntico à planilha de precificação TBW.
- **Banco e login:** Supabase (Postgres + Auth + Realtime), multi-clínica com RLS.
- **Hospedagem:** Vercel, com deploy automático a cada push na branch `main`.

## Estrutura

| Caminho | O que é |
|---|---|
| `src/engine.js` | Cálculo de preço, margem, CMV/CSV, orçamento, DRE e DFC |
| `src/planilha.js` | Leitura da planilha de precificação no layout TBW |
| `src/app.js` | Telas da plataforma |
| `src/supa.js` | Conexão com o Supabase e camada de documentos por clínica |
| `src/main.js` | Login, primeiro acesso, troca de senha e escolha da clínica |
| `api/config.js` | Entrega a URL e a chave pública do Supabase ao navegador |
| `api/usuarios.js` | Criação de usuários e senhas provisórias (usa a chave de serviço) |
| `supabase/migrations/` | Tabelas, funções e políticas de acesso |
| `scripts/testar-motor.mjs` | Confere o motor contra os valores da própria planilha |

## Modelo de dados

- `clinicas`: cada clínica atendida.
- `perfis`: usuário da plataforma (`tbw_admin` vê e edita todas as clínicas).
- `membros`: vínculo usuário × clínica, papel `editor` ou `leitura`.
- `documentos`: dados da clínica em blocos JSON (`config/geral`, `base/insumos`, `base/procedimentos`,
  `orcamento/<ano>`, `realizado/<ano-mês>`, `erp/depara`, `erp/config`).
- `admins_iniciais`: e-mails liberados para criar o primeiro administrador.

## Instalação

1. Vercel → Storage → Create Database → Supabase (região São Paulo) e conecte ao projeto da Vercel.
   A integração cria `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` etc.
2. Aplique `supabase/migrations/*.sql` no banco e cadastre o e-mail do primeiro administrador:
   `insert into public.admins_iniciais (email) values ('seu@email.com');`
3. Importe este repositório na Vercel (framework Vite, já configurado em `vercel.json`).
4. Abra o endereço publicado → **Primeiro acesso da TBW** → crie o administrador.
5. Em **Administração**, crie a clínica, abra a clínica e importe a planilha de precificação.
6. No Supabase → Authentication → Sign In / Providers, desligue **Allow new users to sign up**
   (os usuários são criados pela tela de Administração).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha URL e chave anon
npm run dev
npm test -- "caminho/da/planilha.xlsx"
```

A tela de Administração e o primeiro acesso usam as funções em `api/`; localmente elas rodam com `vercel dev`.

## Publicar alterações (Windows)

```powershell
cd "C:\Users\DELL\Documents\TBW Health\tbw-health"
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "descrição da alteração"
```
