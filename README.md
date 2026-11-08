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

1. Banco: projeto Supabase **tbw-health-db** (`acncpweqfqfeyezmjscg`, São Paulo). Conecte-o ao projeto da Vercel
   (Storage → Connect Project) ou cadastre na Vercel as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
   A URL e a chave anon também estão em `src/supa.js` como padrão; a chave de serviço só fica na Vercel.
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

# conferir o motor contra uma planilha (instala o leitor de Excel só nesta máquina, sem alterar o projeto)
npm install --no-save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm test -- "caminho/da/planilha.xlsx"
```

A tela de Administração e o primeiro acesso usam as funções em `api/`; localmente elas rodam com `vercel dev`.

## Publicar alterações (Windows)

```powershell
cd "C:\Users\DELL\Documents\TBW Health\tbw-health"
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "descrição da alteração"
```

## Conexões da clínica (ERP, banco e maquininha)

Tela **Conexões**: cada clínica registra o ERP, o banco e a maquininha e importa os arquivos.

- **ERP** (ex.: Support Clinic): relatório de contas pagas e recebidas → DRE e fluxo de caixa realizados, com de-para.
- **Banco** (ex.: Sicoob): extrato em **OFX** (ou Excel/CSV) → `banco/AAAA-MM`. Reimportar um período só troca os dias do arquivo.
- **Maquininha** (ex.: InfinitePay): relatório de vendas em CSV/Excel → `cartao/AAAA-MM` (bruto, taxas, líquido, por forma e bandeira).

Tela **Conciliação**: variação do extrato × variação de caixa do ERP por mês, taxa efetiva de cartão × premissa da precificação e a lista de lançamentos do extrato.

### Open Finance (opcional, automático)

`api/openfinance.js` sincroniza extratos via Pluggy (Sicoob e conta InfinitePay são suportados por Open Finance). Fica inativo até cadastrar na Vercel:

| Variável | Para quê |
|---|---|
| `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` | credenciais do painel da Pluggy (plano com Open Finance habilitado) |
| `CRON_SECRET` | protege a rotina diária (`vercel.json` → crons, 06h15 de Brasília) |

Testes: `npm test` roda o motor, os leitores de extrato/vendas e uma sincronização simulada do Open Finance.
