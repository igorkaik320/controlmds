# ControlMDS — Sistema de Gestão para Construtora

Sistema web para gestão operacional e financeira de construtora, com módulos integrados para financeiro, compras, ativos, cadastros e segurança.

## Stack

- React
- TypeScript
- Vite
- Supabase
- shadcn/ui
- Tailwind CSS

## Como rodar localmente

1. Clone o repositório:

```sh
git clone <URL_DO_REPOSITORIO>
cd controlmds-fresh
```

2. Crie o arquivo de variáveis de ambiente:

```sh
cp .env.example .env
```

3. Preencha o `.env` com as credenciais do Supabase:

```env
VITE_SUPABASE_PROJECT_ID=""
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_SUPABASE_URL=""
```

4. Instale as dependências:

```sh
bun install
```

5. Inicie o servidor de desenvolvimento:

```sh
bun run dev
```

## Módulos do Sistema

- Financeiro
- Compras
- Gestão de Ativos
- Segurança
- Cadastros

## Variáveis de ambiente

O arquivo `.env` não deve ser commitado. Use `.env.example` como modelo e configure as variáveis reais no ambiente de deploy.
