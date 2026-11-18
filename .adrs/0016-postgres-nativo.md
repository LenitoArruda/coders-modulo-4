# ADR 0016 — PostgreSQL nativo com `pg` e migrações próprias

> **Status:** aceito · **Data:** 2026-11-12
> **Decisores:** Engenharia
> **Substitui:** [ADR 0006](./0006-supabase-local-via-cli.md) · **Substituído por:** —

## Contexto

A fundação entregava o banco via CLI do Supabase: PostgreSQL 15 no Docker, PostgREST como camada
de acesso (`@supabase/supabase-js`), papéis `anon`/`authenticated`/`service_role`, três variáveis
`SUPABASE_*`, migrações geridas pela CLI e testes de schema em pgTAP. A aplicação só precisa de um
PostgreSQL relacional: a autenticação é própria da API (ADR 0012) e não há uso de Auth, Storage,
Realtime ou Edge Functions do Supabase.

Manter a stack custa dependências, variáveis, portas e um modelo de segurança que não reflete o
runtime real (a API era o único cliente, mas acessava com `service_role` contornando RLS). O
objetivo é reduzir a superfície e deixar explícito o SQL executado.

## Decisão

1. **Banco local**: PostgreSQL **18** (`postgres:18-alpine`) via **Docker Compose**, com healthcheck,
   volume nomeado em `/var/lib/postgresql` e porta publicada apenas em loopback (`127.0.0.1:5432`).
2. **Configuração**: uma única variável, `DATABASE_URL` (`postgres://` ou `postgresql://`),
   validada no boot por `loadEnv`. Nenhuma variável `SUPABASE_*`.
3. **Acesso ao banco**: `pg` com **SQL parametrizado** e um pool global (`DatabaseModule`, token
   `DATABASE_POOL`), encerrado no shutdown. Sem ORM ou query builder.
4. **Repositórios**: cada porta de `application/` tem um adaptador `postgres-*.repository.ts` em
   `infrastructure/`, envolvendo a query em `withDbSpan`. Erros são traduzidos por SQLSTATE
   (`database-error.ts`); a mensagem bruta nunca é logada (pode conter PII).
5. **Migrações**: SQL versionado em `db/migrations/NNNN_<slug>.sql`, aplicado por
   `scripts/db.mjs migrate` (`bun run db:migrate`), com `pg_advisory_lock`, transação por arquivo e
   registro em `schema_migrations`. Migração aplicada não é editada.
6. **Testes de schema**: SQL em `db/tests/`, executado por `scripts/db.mjs test` (`bun run db:test`)
   dentro de `BEGIN`/`ROLLBACK`, sem pgTAP.
7. **Segurança**: RLS habilitado nas tabelas de domínio, **sem policies públicas**. Não existem
   papéis `anon`, `authenticated` ou `service_role`; a API é o único cliente do banco.
8. **Observabilidade**: o coletor `postgres-metrics` lê `postgres:5432` e publica com
   `service.name = coders-modulo-4-postgres`.
9. **Dados locais**: descartáveis. O seed de carga (`load-tests/seed.mjs`) usa `pg` + `DATABASE_URL`
   e recusa hosts que não sejam loopback.

## Consequências

### Positivas

- Stack menor: nenhuma CLI proprietária, PostgREST ou papéis herdados.
- SQL explícito e parametrizado, fácil de revisar e instrumentar.
- Migrações transacionais, versionadas e independentes de fornecedor.
- Testes de schema rodam no PostgreSQL real do Compose.
- Ambiente local reproduzível com uma única variável de banco.

### Negativas / trade-offs

- A engenharia mantém o executor de migrações e os testes de schema.
- Não há geração automática de `down`; reverter exige uma nova migração.
- Consultas mais complexas exigem SQL manual (sem query builder).
- A versão e o provedor de PostgreSQL em produção seguem em aberto.

## Alternativas consideradas

| Alternativa                           | Por que foi descartada                                                      |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Manter Supabase local                 | Dependências e papéis sem uso real; Auth/Storage não são usados             |
| ORM (Prisma/Drizzle/TypeORM)          | SQL explícito atende ao domínio atual sem schema gerado nem abstração extra |
| Ferramenta de migração externa        | O executor próprio cobre transação, lock e histórico com poucas linhas      |
| pgTAP para testes de schema           | Extensão adicional; SQL com `RAISE EXCEPTION` cobre as asserções atuais     |
| PostgreSQL 15 para igualar o Supabase | Não há motivo para reter uma versão antiga após remover a stack             |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md)
- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [QA.md](../.docs/QA.md)
- [`db/migrations/0001_auth_schema.sql`](../db/migrations/0001_auth_schema.sql)
- [`scripts/db.mjs`](../scripts/db.mjs)
- [ADR 0006 — Supabase local via CLI](./0006-supabase-local-via-cli.md)
- [ADR 0012 — Auth própria na API](./0012-auth-propria-na-api.md)
