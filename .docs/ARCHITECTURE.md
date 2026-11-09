# ARCHITECTURE.md — Arquitetura

> **Status:** fundação implementada — produto não implementado · **Atualizado em:** 2026-11-09
> **Legenda:** ✅ implementado · 🧭 planejado · 🔍 decisão em aberto

Este documento descreve a estrutura do monorepo, a stack e a arquitetura alvo. Para regras de
engenharia, consulte [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 1. Visão geral

Monorepo **Turborepo** com **Bun**, contendo aplicações Next.js, uma API NestJS e pacotes
compartilhados. A fundação já entrega web, API e Supabase local; o produto será uma plataforma
de Experts (ver [BUSINESS.md](./BUSINESS.md)), com:

- **Web app** para interação com Experts e gestão de conectores.
- **API** dedicada para regras de negócio, ingestão e orquestração de agents.
- **Supabase/Postgres** como banco PostgreSQL e storage; a **autenticação é própria da API**
  (JWT emitido pela API; sem Supabase Auth).
- **Conectores externos** para trazer dados de Notion, Google Drive, Jira, PDF etc.

---

## 2. Estrutura atual

```text
.
├── apps/
│   ├── web/                     # Next.js — porta 3000
│   ├── docs/                    # Next.js — porta 3001 (starter, ainda não customizado)
│   └── api/                     # NestJS — porta 3333
├── packages/
│   ├── ui/                      # Tailwind/shadcn, tokens e componentes compartilhados
│   ├── eslint-config/           # Configurações ESLint compartilhadas
│   └── typescript-config/       # tsconfig base/nextjs/react-library
├── scripts/
│   └── infra.mjs                # Orquestra Compose (LGTM) + Supabase CLI
├── supabase/
│   ├── config.toml
│   └── migrations/
├── docker-compose.yml           # LGTM: Grafana + OTel Collector + Loki/Tempo/Prometheus
├── .plans/                      # Planos de tarefas (<numero>-<slug>-plan.md)
├── .specs/                      # Specs de feature (<numero>-<slug>.md)
├── .docs/                       # Documentação do projeto
├── .adrs/                       # Architecture Decision Records (ADRs)
├── turbo.json
├── package.json
└── bun.lock
```

| App/Pacote                   | Responsabilidade                        | Estado                                                                                                   |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/web`                   | Interface principal do produto          | ✅ hello world com Tailwind/shadcn na porta 3000                                                         |
| `apps/docs`                  | Site de documentação                    | ✅ starter rodando na porta 3001; ainda não customizado                                                  |
| `apps/api`                   | API NestJS                              | ✅ hello world, env validado, CORS, logs e OTel na porta 3333                                            |
| `packages/ui`                | Componentes compartilhados              | ✅ Tailwind, shadcn, tokens, `cn` e `Button`; legados `button`, `card`, `code` mantidos para `apps/docs` |
| `packages/eslint-config`     | Lint compartilhado                      | ✅ `base`, `next-js`, `react-internal`; preset Babel resolvido                                           |
| `packages/typescript-config` | Tipagem compartilhada                   | ✅ `base`, `nextjs`, `react-library`                                                                     |
| `packages/shared`            | Contratos, tipos e utilidades cross-app | 🧭 não existe; aguarda contrato real                                                                     |

---

## 3. Stack

### 3.1 Implementada hoje

| Camada                      | Tecnologia                               | Versão           |
| --------------------------- | ---------------------------------------- | ---------------- |
| Monorepo                    | Turborepo                                | 2.11.10          |
| Package manager             | Bun                                      | 1.4.4            |
| Runtime                     | Node.js                                  | >= 24            |
| Linguagem                   | TypeScript (compilador nativo em Go)     | 7.0.2            |
| UI                          | Next.js (App Router) + React             | 16.3.8 / 19.2.8  |
| Estilo                      | Tailwind CSS                             | 4.3.4            |
| Design system               | shadcn/ui (configurado em `packages/ui`) | —                |
| API                         | NestJS                                   | 12.3.3           |
| Banco local                 | Supabase CLI (PostgreSQL 15)             | 3.0.0            |
| Testes unitários/integração | Vitest + Supertest                       | 5.1.0 / 7.3.1    |
| Testes E2E                  | Playwright                               | 1.65.0           |
| Observabilidade             | OpenTelemetry SDK + Grafana LGTM         | 0.301.0 / 0.39.0 |
| Lint                        | ESLint                                   | 10.9.1           |
| Formatação                  | Prettier                                 | 3.9.6            |
| Hooks Git                   | Lefthook + lint-staged                   | 2.2.2 / 17.6.0   |
| Mensagens de commit         | Commitlint + Conventional Commits        | 21.2.4           |

### 3.2 Stack alvo (planejada ou em avaliação)

| Camada                   | Tecnologia        | Estado          |
| ------------------------ | ----------------- | --------------- |
| Datas                    | date-fns          | 🧭              |
| Tabelas                  | TanStack Table    | 🧭              |
| Gráficos                 | TanStack Charts   | 🧭              |
| Hash de senha            | bcrypt            | 🔍              |
| Infra de produção        | Vercel + Supabase | 🧭              |
| Lint/format alternativos | OXLint + OXFmt    | 🔍 em avaliação |
| Contratos compartilhados | `packages/shared` | 🧭              |

> **Atenção:** a stack alvo **não está instalada**. Não importe date-fns, TanStack, bcrypt ou
> `packages/shared` sem antes adicioná-los ao `package.json` e atualizar esta tabela.

---

## 4. Arquitetura da API e do monorepo

### 4.1 Camadas

A API usa arquitetura em camadas, com dependências apontando para dentro:

```text
interface → application → domain
                 ↑
          infrastructure (implementa portas)
```

| Camada           | Responsabilidade                                       | Pode importar           |
| ---------------- | ------------------------------------------------------ | ----------------------- |
| `domain`         | Entidades, value objects, serviços e regras de domínio | Nada externo            |
| `application`    | Casos de uso, orquestração, portas/interfaces          | `domain`                |
| `infrastructure` | Repositórios, Supabase, filas, eventos, clientes HTTP  | `application`, `domain` |
| `interface`      | Controllers, DTOs, presenters, validação de entrada    | `application`           |

Regras:

- `domain` não conhece framework, banco, HTTP nem SDK.
- `application` não conhece implementações concretas; depende de portas.
- `infrastructure` implementa as portas definidas em `application`/`domain`.
- `interface` apenas valida, traduz e delega para casos de uso.

### 4.2 Vertical slices

A aplicação é fatiada por domínio, não por tipo técnico. Estrutura atual da API:

```text
apps/api/src/
├── modules/
│   ├── hello/
│   │   ├── domain/
│   │   ├── application/
│   │   └── interface/
│   └── shared/                  # config, logging, observability
├── app.module.ts
├── app-setup.ts
└── main.ts
```

Novos domínios (`experts`, `connectors`, `documents`, `conversations`) seguem o mesmo formato,
criando `infrastructure/` quando houver implementação concreta.

Regras:

- Cada módulo é dono do seu domínio e pode evoluir de forma independente.
- `modules/shared` contém apenas código transversal (erros, logging, config, tipos comuns).
- Não crie dependência circular entre módulos; comunicação via casos de uso ou eventos.

### 4.3 Estrutura do monorepo

```text
apps/
├── web/                         # Next.js — interface
├── docs/                        # Next.js — documentação (starter)
└── api/                         # NestJS — API
packages/
├── ui/                          # Design system compartilhado
├── shared/                      # 🧭 contratos, tipos e validações cross-app
├── eslint-config/
└── typescript-config/
```

Regras de dependência entre pacotes:

- `apps/web` pode importar `packages/ui` e `packages/shared`.
- `apps/api` pode importar `packages/shared`; **não** importa `packages/ui`.
- `packages/ui` não importa apps nem acessa API diretamente.
- `packages/shared` não depende de React, Next.js ou NestJS.

### 4.4 Modelo de dados de autenticação

O schema de auth é criado em `supabase/migrations/` e é de uso **exclusivo da API**; o navegador
não acessa essas tabelas (RLS habilitado, nenhuma policy para `anon`/`authenticated`). A API
opera com a credencial de servidor (`service_role`).

| Tabela        | Papel                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `users`       | Conta da pessoa: nome, e-mail normalizado e único, hash de senha e confirmação de e-mail         |
| `auth_tokens` | Tokens opacos de uso único para confirmação de e-mail e reset de senha, persistidos só como hash |
| `sessions`    | Registro server-side das sessões emitidas pela API, com expiração e revogação                    |

Regras centrais:

- `users.email` é armazenado em minúsculas; o índice único em `lower(email)` garante unicidade
  case-insensitive.
- `users.password_hash` armazena apenas o hash; a senha em claro nunca é persistida.
- `auth_tokens` usa `purpose` (`email_confirmation` ou `password_reset`), `expires_at` e
  `used_at`; apenas `token_hash` é persistido.
- `sessions` usa `origin` (`sign_up_confirmation` ou `sign_in`), `expires_at` e `revoked_at`;
  sessão ativa é a que tem `revoked_at` nulo e `expires_at` no futuro.
- `users`, `auth_tokens` e `sessions` usam UUID e `ON DELETE CASCADE` a partir do usuário.

O detalhamento de campos e constraints está em `.specs/001-auth-schema.md`; o JWT, o cookie
`HttpOnly` e os endpoints de auth entram nas specs 002 a 008.

---

## 5. Fluxo de dados alvo

```text
Usuário
  │
  ▼
apps/web (Next.js)
  │  HTTP
  ▼
apps/api (NestJS)
  ├── AuthN/AuthZ ──────────────► Postgres (auth própria: users, auth_tokens, sessions)
  ├── Casos de uso
  │     ├── Conectores ─────────► Notion / Google / Jira / ...
  │     ├── Ingestão ───────────► Postgres + Storage (documentos e chunks)
  │     └── Experts ────────────► Recuperação de contexto + LLM
  └── Observabilidade ──────────► Grafana (LGTM)
```

Fluxo resumido:

1. O usuário conecta uma fonte externa via OAuth/token.
2. A ingestão sincroniza documentos, normaliza e armazena conteúdo + metadados.
3. O usuário faz um pedido a um Expert.
4. O Expert recupera contexto das fontes conectadas, gera a resposta e cita as origens.
5. Logs, métricas e traces são emitidos desde o dia 0.

> O fluxo acima é o alvo do produto. Na fundação, apenas o caminho web → API (`GET /`) e a
> telemetria estão implementados. A fatia 001 adiciona o **schema de auth** (`users`,
> `auth_tokens`, `sessions`), mas ainda **sem endpoints, JWT ou cookie** — eles entram nas
> fatias 002 a 008.

---

## 6. Decisões arquiteturais

Cada decisão abaixo possui um registro correspondente em [`.adrs/`](../.adrs/README.md), com
contexto, alternativas e consequências. Decisões ainda em aberto permanecem na §7 até serem
tomadas.

| Decisão                                    | Motivo                                                                         | Estado       |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------ |
| Monorepo com Turborepo + Bun               | Compartilhar código, cache e execução paralela                                 | ✅           |
| Next.js App Router no front-end            | Server Components, streaming e SEO                                             | ✅           |
| API separada em NestJS                     | Isolar domínio, ingestão e orquestração do front                               | ✅           |
| Supabase local via CLI                     | Ambiente reproduzível sem instalação global                                    | ✅           |
| Auth própria na API (sem Supabase Auth)    | Controlar sessão única, tokens opacos e e-mails no domínio da aplicação        | ✅ (schema)  |
| Arquitetura em camadas + vertical slices   | Baixo acoplamento e evolução por domínio                                       | ✅ (`hello`) |
| Light theme único                          | Direção visual definida em `DESIGN.md`                                         | ✅           |
| Tailwind CSS + shadcn/ui em `packages/ui`  | Base visual compartilhada e tokens únicos                                      | ✅           |
| TypeScript `strict`                        | Segurança de tipos no monorepo                                                 | ✅           |
| OpenTelemetry + Grafana LGTM desde o dia 0 | Diagnosticar ingestão e respostas de IA                                        | ✅           |
| Vitest + Playwright + Supertest            | Unitário, E2E e API                                                            | ✅           |
| LGTM all-in-one via Compose                | Menos configuração e versões fixadas                                           | ✅           |
| Supabase Analytics desabilitado            | `vector` exige Docker API em `2375`, indisponível por padrão no Docker Desktop | ✅           |
| PostgreSQL local em `15`                   | Workaround de ambiente; a versão alvo será decidida antes de produção          | ✅           |

---

## 7. Decisões em aberto

| Tema                 | Pergunta                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Deploy da API        | NestJS na Vercel atende limites de execução e filas? Avaliar alternativa (Railway/Fly/Render). |
| Hash de senha        | Qual algoritmo usar no hash próprio (bcrypt/argon2) e qual custo; decidir na fatia 002.        |
| `apps/docs`          | Será o site público de documentação ou deve ser removido?                                      |
| OXLint/OXFmt         | Migrar do ESLint/Prettier atual ou manter?                                                     |
| Multi-tenancy        | Workspace/organização é obrigatório no MVP? Impacta RLS e modelo de dados.                     |
| `packages/shared`    | Quais contratos realmente serão compartilhados entre web e api?                                |
| Versão do PostgreSQL | O ambiente local usa `15`; qual versão será adotada em produção?                               |
| Supabase Analytics   | Reabilitar expondo a Docker API em `2375` ou manter a telemetria apenas no LGTM?               |

---

## 8. Como manter este documento

Atualize `ARCHITECTURE.md` na mesma mudança que:

- adicionar/remover app ou pacote;
- instalar/remover tecnologia da stack;
- alterar a direção de dependência entre camadas;
- mudar o fluxo de dados ou o modelo de deploy;
- tomar ou revisar uma decisão arquitetural (crie/atualize um ADR em [`.adrs/`](../.adrs/README.md)).

Mantenha a legenda de status e as versões sincronizadas com os `package.json`.
