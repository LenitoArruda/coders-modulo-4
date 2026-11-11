# Architecture Decision Records (ADRs)

> **Status:** ativo · **Atualizado em:** 2026-11-11

Este diretório registra as decisões arquiteturais do projeto: o contexto, a decisão tomada, as
consequências e as alternativas consideradas. A visão consolidada continua em
[`.docs/ARCHITECTURE.md`](../.docs/ARCHITECTURE.md); os ADRs preservam o **porquê** de cada
escolha ao longo do tempo.

---

## Como criar um ADR

1. Copie [`_template.md`](./_template.md) para `NNNN-titulo-em-kebab-case.md`.
2. Use o próximo número sequencial (4 dígitos).
3. Preencha contexto, decisão, consequências e alternativas.
4. Adicione o registro ao índice abaixo.
5. Atualize `.docs/ARCHITECTURE.md` quando a decisão alterar estrutura, stack ou fluxo de dados.

## Status possíveis

| Status        | Significado                                                     |
| ------------- | --------------------------------------------------------------- |
| `proposto`    | Em discussão; ainda não vale como regra do projeto              |
| `aceito`      | Decisão vigente                                                 |
| `rejeitado`   | Alternativa descartada, mantida para histórico                  |
| `substituído` | Não vale mais; o campo `Substituído por` aponta para o novo ADR |

## Índice

| ADR                                                  | Decisão                                            | Status   | Data       |
| ---------------------------------------------------- | -------------------------------------------------- | -------- | ---------- |
| [0001](./0001-monorepo-turborepo-bun.md)             | Monorepo com Turborepo e Bun                       | `aceito` | 2026-11-05 |
| [0002](./0002-nextjs-app-router.md)                  | Next.js App Router no front-end                    | `aceito` | 2026-11-05 |
| [0003](./0003-api-nestjs-separada.md)                | API NestJS separada do front-end                   | `aceito` | 2026-11-05 |
| [0004](./0004-camadas-e-vertical-slices.md)          | Arquitetura em camadas com vertical slices         | `aceito` | 2026-11-05 |
| [0005](./0005-tailwind-shadcn-light-only.md)         | Tailwind + shadcn/ui, light-only, em `packages/ui` | `aceito` | 2026-11-05 |
| [0006](./0006-supabase-local-via-cli.md)             | Supabase local via CLI com PostgreSQL 15           | `aceito` | 2026-11-05 |
| [0007](./0007-observabilidade-otel-lgtm.md)          | Observabilidade com OpenTelemetry e LGTM           | `aceito` | 2026-11-05 |
| [0008](./0008-testes-vitest-supertest-playwright.md) | Testes com Vitest, Supertest e Playwright          | `aceito` | 2026-11-05 |
| [0009](./0009-conventional-commits-commitlint.md)    | Conventional Commits com commitlint e hooks        | `aceito` | 2026-11-09 |
| [0010](./0010-typescript-strict.md)                  | TypeScript `strict` no monorepo                    | `aceito` | 2026-11-05 |
| [0011](./0011-eslint-prettier-e-config-raiz.md)      | ESLint + Prettier com config raiz para lint-staged | `aceito` | 2026-11-09 |
| [0012](./0012-auth-propria-na-api.md)                | Autenticação própria na API, sem Supabase Auth     | `aceito` | 2026-11-09 |
| [0013](./0013-auth-session-jwt-cookie.md)            | Sessão com JWT, registro server-side e cookie      | `aceito` | 2026-11-09 |
| [0014](./0014-hash-de-senha-com-scrypt.md)           | Hash de senha com scrypt nativo                    | `aceito` | 2026-11-09 |
| [0015](./0015-request-handler-1-1.md)                | Request handler 1:1 e um use case por fluxo        | `aceito` | 2026-11-11 |

## Decisões em aberto

Temas ainda não decididos permanecem em
[`.docs/ARCHITECTURE.md` §7](../.docs/ARCHITECTURE.md#7-decisões-em-aberto): deploy da API,
multi-tenancy/RLS, OXLint/OXFmt, contratos de `packages/shared`, versão de
PostgreSQL em produção e reativação do Supabase Analytics.

Quando uma delas for fechada, crie o ADR correspondente e mova a linha para o índice acima.
