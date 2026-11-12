# Plano — PostgreSQL nativo sem Supabase

> **Spec:** [`.specs/009-postgres-nativo.md`](../.specs/009-postgres-nativo.md)
> **Status:** done
> **Atualizado em:** 2026-11-12

## 1. Contexto

A API consome apenas PostgreSQL, mas a fundação entrega o banco via CLI do Supabase, com
PostgREST, papéis `anon`/`authenticated`/`service_role`, três variáveis `SUPABASE_*`, migrações
geridas pela CLI e testes em pgTAP. A spec 009 substitui toda essa stack por um PostgreSQL 18 no
Compose, acesso direto com `pg` e SQL parametrizado, migrações versionadas com executor próprio e
testes SQL executados no banco real. Nenhum contrato de auth muda.

## 2. Objetivo e critérios de aceite

Objetivo: remover o Supabase do runtime, da configuração, dos scripts, dos testes e da
documentação vigente, mantendo os fluxos de auth e a observabilidade.

Critérios de aceite da spec mapeados para passos:

| Critério                                                          | Passos     |
| ----------------------------------------------------------------- | ---------- |
| `infra:up` sobe PostgreSQL 18 + LGTM sem Supabase                 | 1, 2, 3    |
| `infra:down` idempotente                                          | 1, 3       |
| `db:migrate` aplica do zero e é idempotente                       | 4, 5, 6    |
| `db:test` passa sem CLI do Supabase                               | 4, 7       |
| API inicia só com `DATABASE_URL`; falha clara se ausente/inválida | 8, 9       |
| Contrato de erro preservado com banco indisponível                | 9, 10, 11  |
| Sign-up duplicado → `409` sem linha duplicada                     | 10, 12     |
| Confirmação e reset de token consumidos uma única vez             | 10, 12, 14 |
| Token usado/sessão revogada mantêm comportamento                  | 10, 12, 14 |
| Seed de carga via `DATABASE_URL` e recusa banco não local         | 13         |
| Observabilidade sem referência ao Supabase                        | 15, 16     |
| Zero ocorrências vigentes de Supabase                             | 3, 17, 18  |
| `lint`, `types:check`, `test` e `build` passam                    | 19         |

## 3. Escopo

### Dentro

- PostgreSQL 18 no Compose com healthcheck, volume e porta em loopback.
- `DATABASE_URL` como única variável de banco da API, validada no boot.
- `pg` + SQL parametrizado nos três repositórios de auth.
- Migrações em `db/migrations/` com executor próprio (`scripts/db.mjs`).
- Testes SQL de schema em `db/tests/` executados pelo mesmo script.
- Seed de carga via `pg`.
- Coleta de métricas do Postgres do Compose e textos da dashboard.
- Remoção da pasta `supabase/`, do SDK, das variáveis e dos scripts.
- Atualização de README, `.docs/*`, load-tests e ADR.

### Fora

- Provedor de produção, SSL, pooler, backups e alta disponibilidade.
- Migração de dados do Supabase local.
- Mudanças de contrato de auth, schema lógico, UI ou e-mail.
- ORM/query builder, CI e deploy.

## 4. Abordagem técnica

- **Conexão:** um `Pool` do `pg` criado a partir de `loadEnv().databaseUrl`, limitado a 10
  conexões, encerrado no shutdown do Nest (`OnApplicationShutdown`).
- **Repositórios:** SQL parametrizado com `pool.query`, tipos de linha explícitos e mapeamento
  para o domínio. Datas `timestamptz` chegam como `Date`. Atualizações condicionais usam
  `rowCount` para preservar as garantias de uso único e revogação.
- **Erros:** helper `databaseFailure(operation, error)` registra apenas operação e código SQL;
  violação de unicidade (`23505`) em `users` continua virando `DuplicateEmailError`.
- **Spans:** `withDbSpan` mantém os atributos atuais (`db.system=postgresql`, tabela, operação) e
  marca erro a partir do código lançado pelo `pg`.
- **Migrações:** `db/migrations/NNNN_slug.sql` aplicadas em ordem, cada uma em transação, com
  `pg_advisory_lock` para concorrência e registro em `public.schema_migrations`.
- **Testes SQL:** `db/tests/NNNN_slug.test.sql` com helpers em `pg_temp` (`assert_true`,
  `expect_error`), executados em transação com `rollback` pelo `scripts/db.mjs test`.
- **Infra:** o Compose passa a subir `postgres:18-alpine` e o coletor aponta para
  `postgres:5432` na rede interna.

## 5. Arquivos e áreas afetadas

- `docker-compose.yml`, `observability/postgres-collector.yaml`, `observability/gen-dashboard.mjs`,
  `observability/dashboards/api-overview.json`.
- `scripts/infra.mjs`, `scripts/db.mjs` (novo), `package.json`.
- `db/migrations/0001_auth_schema.sql` (novo), `db/tests/001_auth_schema.test.sql` (novo).
- `apps/api/package.json`, `apps/api/src/modules/shared/database/*` (novos),
  `apps/api/src/modules/shared/config/env.ts` e `env.spec.ts`,
  `apps/api/src/modules/shared/observability/db-span.ts` e spec,
  `apps/api/src/modules/auth/auth.module.ts`, `auth.tokens.ts`,
  `apps/api/src/modules/auth/infrastructure/postgres-*.repository.ts` (novos),
  `database-error.ts` (novo), specs correspondentes.
- `apps/api/src/test/setup-env.ts`, `apps/api/src/test/fakes/pg-pool.mock.ts` (novo).
- `load-tests/seed.mjs`, `load-tests/README.md`.
- `README.md`, `.docs/AGENTS.md`, `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`,
  `.docs/QA.md`, `.env.example`.
- `.adrs/0006-supabase-local-via-cli.md` (substituído), `.adrs/0012-auth-propria-na-api.md`,
  `.adrs/0013-auth-session-jwt-cookie.md`, `.adrs/0016-postgres-nativo.md` (novo),
  `.adrs/README.md`.
- Remoção: `supabase/`, `apps/api/src/modules/auth/infrastructure/supabase-*`,
  `apps/api/src/test/fakes/supabase-client.mock.ts`, dependências `@supabase/supabase-js` e
  `supabase`.

## 6. Passos de implementação

- [x] 1. Adicionar PostgreSQL 18 ao Compose (healthcheck, volume, loopback) e remover a
      dependência de variáveis/perfil do Supabase.
- [x] 2. Ajustar o coletor de métricas para o Postgres do Compose.
- [x] 3. Reescrever `scripts/infra.mjs` sem CLI do Supabase e atualizar mensagens/portas.
- [x] 4. Criar `scripts/db.mjs` com `migrate` e `test` (lock, transação, rollback).
- [x] 5. Criar `db/migrations/0001_auth_schema.sql` sem grants/papéis do Supabase, mantendo RLS.
- [x] 6. Atualizar scripts do `package.json` para `node --env-file=.env scripts/db.mjs`.
- [x] 7. Criar `db/tests/001_auth_schema.test.sql` cobrindo constraints, cascata, consultas
      ativas, `updated_at`, RLS, ausência de policies e de papéis do Supabase.
- [x] 8. Adicionar `pg` (API e scripts) e `@types/pg`; remover SDK/CLI do Supabase.
- [x] 9. Trocar `SUPABASE_*` por `DATABASE_URL` em `env.ts`, `env.spec.ts` e `setup-env.ts`.
- [x] 10. Criar módulo/pool `pg`, helper de erro e adaptar `withDbSpan`.
- [x] 11. Registrar o `DatabaseModule` e o shutdown do pool no `AuthModule`/`AppModule`.
- [x] 12. Reescrever usuários, sessões e tokens como repositórios `pg` com SQL parametrizado.
- [x] 13. Reescrever specs dos repositórios e o fake de `pg`, removendo o mock do Supabase.
- [x] 14. Reescrever `load-tests/seed.mjs` para `DATABASE_URL`, mantendo só host local.
- [x] 15. Atualizar coletor/dashboard e remover referências `supabase-postgres`.
- [x] 16. Atualizar README, `.docs/AGENTS/ARCHITECTURE/DEVELOPMENT/QA` e `.env.example`.
- [x] 17. Marcar ADR 0006 como substituído, ajustar 0012/0013 e criar ADR 0016.
- [x] 18. Remover `supabase/` e artefatos restantes; varrer referências vigentes.
- [x] 19. Rodar QA completo e QA manual (infra, migrações, schema, seed, auth).
- [x] 20. Atualizar spec/plano para `done` e executar `commit-and-push`.

## 7. Riscos e mitigação

| Risco                                        | Mitigação                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Diferença de semântica entre PostgREST e SQL | Specs de repositório por operação e testes SQL no banco real            |
| Volume do PostgreSQL 18 em caminho diferente | Montar `/var/lib/postgresql` (padrão da imagem 18) e validar `infra:up` |
| Migração concorrente aplicada duas vezes     | `pg_advisory_lock` + `schema_migrations` + transação por migração       |
| Testes SQL sem pgTAP                         | Helpers `pg_temp.assert_true`/`expect_error` e rollback por arquivo     |
| Pool vazando conexões                        | `max`, `idleTimeoutMillis` e `pool.end()` no shutdown                   |
| Perda dos dados locais do Supabase           | Aceita pela spec; banco recriado do zero                                |
| Seed apontando para banco remoto             | Parse da URL e recusa de host diferente de loopback                     |
| Divergência de documentação e código         | Atualizar docs na mesma mudança e varrer referências no final           |

## 8. Plano de testes

- **Unitário:** `env` (URL válida/ausente/inválida sem vazar credencial), repositórios (mapeamento,
  parâmetros, `rowCount`, erro/unicidade), `databaseFailure`, `withDbSpan`.
- **Integração:** suítes de auth existentes com fakes em memória continuam passando.
- **Banco:** `db:migrate` em banco vazio, segunda execução idempotente, teste de concorrência
  manual/observado e `db:test` no PostgreSQL 18.
- **Carga/manual:** `load:seed`/`load:clean`, recusa de host remoto, jornada completa de auth com
  banco real e inspeção do Mailtrap.

## 9. QA manual

1. `bun run infra:up` → Postgres 18 e LGTM saudáveis, sem containers do Supabase.
2. `bun run db:migrate` duas vezes → primeira aplica, segunda não reaplica.
3. `bun run db:test` → todos os testes SQL passam.
4. `bun run dev` → API inicia com `DATABASE_URL` e sem `SUPABASE_*`.
5. Sign-up → confirmação → sign-in → `me` → sign-out → forgot-password → reset-password.
6. `bun run load:seed`/`load:clean` → usuários criados/removidos; URL remota recusada.
7. Grafana → spans de banco e métricas do PostgreSQL com o novo serviço.
8. `bun run infra:down` duas vezes → idempotente.

## 10. Rollout e rollback

- Rollout interno, sem feature flag. Ordem: infra → banco/migrações → camada de acesso →
  testes/seed → observabilidade → documentação → validação.
- Sem migração de dados: o banco local do Supabase é descartado.
- Rollback: reverter o commit, restaurar a configuração anterior e recriar o Supabase local; não há
  dados reais a restaurar.

## 11. Resultados do QA (2026-11-12)

- **Infra:** `bun run infra:up` subiu `postgres:18-alpine` + LGTM saudáveis, sem containers
  `supabase_*`; `bun run infra:down` rodou duas vezes com exit 0; novo `infra:up` manteve o volume
  e as migrações aplicadas.
- **Banco:** `db:migrate` aplicou `0001_auth_schema.sql` do zero; segunda execução respondeu
  "nenhuma migração pendente"; `db:test` passou em `001_auth_schema.test.sql`.
- **Carga:** `load:seed` criou 300 usuários `loadtest-*` (confirmados no banco), `load:clean`
  removeu os 300; `DATABASE_URL` apontando para host remoto foi recusada com exit 1.
- **Auth real (API + PostgreSQL):** sign-up `201` → confirmação `200` → sign-in `200` → `/me`
  `200` → sign-out `204` → `/me` `401` → forgot-password `200` → reset-password `200` →
  sign-in com a nova senha `200`; senha antiga `401`.
- **Bordas reais:** sign-up repetido não confirmado → `200` (reenvio, uma única linha); token de
  confirmação reutilizado → `409 ACCOUNT_ALREADY_CONFIRMED` (consumido, sem nova sessão); sign-up
  com e-mail confirmado → `409 EMAIL_ALREADY_CONFIRMED`; token de reset reutilizado →
  `400 INVALID_RESET_TOKEN`; banco parado → `500 INTERNAL_ERROR` genérico, sem SQL/credencial.
- **Observabilidade:** Prometheus com `service_name="coders-modulo-4-postgres"` e
  `service_instance_id="postgres:5432"`; trace real da API com span `db.system=postgresql`.
- **Qualidade:** `lint`, `types:check`, `test` (52 arquivos/348 testes na API + 115 no web),
  `build` e `test:e2e` (106 testes) passaram.
