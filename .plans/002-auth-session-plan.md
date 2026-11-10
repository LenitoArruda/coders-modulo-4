# Plano — Auth session

> Spec: `.specs/002-auth-session.md`
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto

A fatia 001 criou `users`, `auth_tokens` e `sessions` no banco local, mas nada emite, valida ou
revoga sessão. A API responde apenas em `GET /` (hello world) e o web não tem noção de pessoa
autenticada. As fatias 005 e 006 (confirmação e sign-in) precisam de uma fundação de sessão
pronta: JWT assinado pela API, registro server-side, política de sessão única, cookie `HttpOnly`
no web, `GET /api/v1/auth/me`, contrato de erro estável e porta de e-mail com o template de nova
sessão.

Esta fatia entrega essa infraestrutura compartilhada e introduz o namespace `/api/v1`.

## 2. Objetivo e critérios de aceite

Entregar a infraestrutura de sessão de ponta a ponta: criar sessão (caso de uso interno),
assinar/validar JWT (`sub`, `sid`, `iat`, `exp`), revogar sessões anteriores, expor
`GET /api/v1/auth/me`, cookie `HttpOnly` no web com ponte `Authorization: Bearer`, contrato de
erro padrão, porta de e-mail + template en-US de nova sessão e hello em `/api/v1/hello` com
`GET /` removido.

Mapeamento dos critérios de aceite da spec:

| Critério de aceite                                                                                | Verificação                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão criada gera JWT `sub`/`sid`/`iat`/`exp` e persiste com `origin` e expiração                | Unit `create-session.use-case.spec.ts` + `jose-session-token.adapter.spec.ts`                                                          |
| JWT válido + sessão ativa em `GET /api/v1/auth/me` → `200` com dados básicos                      | Integração `auth.integration.spec.ts`                                                                                                  |
| JWT ausente/inválido/expirado/revogado em `/me` → `401` sem detalhes internos                     | Integração `auth.integration.spec.ts` (contrato exato da spec)                                                                         |
| Nova sessão revoga as anteriores; apenas a nova é aceita                                          | Unit `create-session.use-case.spec.ts` + integração com repositórios fake + QA manual no banco real                                    |
| E-mail de nova sessão en-US disparado com data/hora, sem link de recuperação                      | Unit `new-session-email.spec.ts` + `create-session.use-case.spec.ts` + QA manual no Mailpit local                                      |
| Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/`, inacessível ao JavaScript      | Unit `session-cookie.spec.ts` (opções) + QA manual; inspeção no navegador entra na 005/006 (sem fluxo público que grave o cookie aqui) |
| Hello em `/api/v1/hello`, `GET /` não existe, contrato de erro estável, sem token/JWT/PII em logs | Integração `hello.integration.spec.ts` + `error-contract.spec.ts` + QA manual                                                          |

## 3. Escopo

### Dentro

- Módulo `apps/api/src/modules/auth` com as quatro camadas (domain, application, infrastructure,
  interface).
- Casos de uso internos `CreateSessionUseCase` e `ValidateSessionUseCase`.
- Portas (application): `SessionsRepositoryPort`, `UsersRepositoryPort`, `SessionTokenPort`,
  `EmailSenderPort`.
- Adaptadores (infrastructure): assinatura/validação JWT com `jose` (HS256), repositórios
  Supabase via `@supabase/supabase-js` com credencial de servidor, e-mail SMTP com `nodemailer`.
- Template en-US de nova sessão (assunto, data/hora UTC, alerta de senha, sem link de
  recuperação).
- Guard de sessão + `GET /api/v1/auth/me` com contrato de resposta da spec.
- Contrato de erro padrão (`code`, `message`, `fieldErrors` quando aplicável) via filtro global,
  sem stack/SQL/detalhes internos.
- Prefixo global `/api/v1`; hello em `GET /api/v1/hello`; `GET /` deixa de existir (404).
- Ponte de sessão no web (`apps/web/lib/auth`): leitura do cookie no servidor, montagem de
  `Authorization: Bearer`, opções do cookie `HttpOnly`/`SameSite=Lax`/`Secure` em
  produção/`Path=/`/`Max-Age` da sessão, e helper de gravação para as fatias 005/006.
- Vitest no web (testes unitários da ponte; a UI não muda além do link da home).
- Exposição da porta SMTP local do Supabase (`smtp_port = 54325` no `config.toml`) para o Mailpit.
- Variáveis de ambiente: `JWT_SECRET` (obrigatória, mínimo 32 chars), `SESSION_TTL_SECONDS`
  (default 604800), `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` (defaults locais) e `API_BASE_URL` no web
  (default `http://localhost:3333`).
- ADR `0013` documentando JWT + sessão no servidor + cookie `HttpOnly` + namespace `/api/v1`.
- Atualização de `.env.example`, `.env` local (não versionado) e documentação afetada.
- Testes unitários e de integração conforme a estratégia da spec.

### Fora

- Página de confirmação, sign-in, sign-out, forgot/reset password (fatias 004–008).
- Rotas web `/auth/*` e `/app/*`, layouts e guard de navegação (fatia 003).
- Endpoint público de criação de sessão; `CreateSessionUseCase` é interno.
- Refresh token, "remember me", MFA, SSO e login social.
- Gestão de sessões/dispositivos pelo usuário.
- Migração de schema: sem novas tabelas/funções (restrição explícita da spec §12).
- Hash de senha (entra nas fatias de sign-up/sign-in).
- Provedor de e-mail de produção (SMTP local/Mailpit em dev; produção a definir).

## 4. Abordagem técnica

### Camadas do módulo auth

```text
modules/auth/
├── auth.module.ts
├── domain/                      # Session, SessionOrigin, AuthUser, InvalidSessionError
├── application/                 # casos de uso, template de e-mail, portas
│   └── ports/
├── infrastructure/              # jose, Supabase, SMTP
└── interface/                   # guard, controller, decorator, testes de integração
```

- Portas como classes abstratas (DI por token de classe, padrão Nest e sobrescrevível em teste).
- Fakes de teste em `apps/api/src/test/fakes/` (repositórios em memória, e-mail, token fake) para
  unitário e integração — decisão da spec §15 "banco de testes" resolvida como repositório fake
  nesta fatia; o banco local real é coberto pelo QA manual e pelos pgTAP da 001.
- Dependências: `jose@6.2.17` (JWT HS256; ESM-only, suportado via `require(esm)` em Node ≥ 22/Bun),
  `nodemailer@10.4.0` (SMTP do Mailpit local; tipos e CJS próprios), `@supabase/supabase-js@2.119.0`
  (PostgREST com `service_role`), `vitest@5.1.0` no web (mesma versão da API).

### Ordem create-then-revoke e sessão única

A spec descreve o fluxo como "revoga anteriores → cria nova", mas exige o invariante
normativo "após o sucesso, apenas a nova sessão é válida" e o RNF de concorrência ("duas criações
simultâneas não podem deixar duas sessões válidas"). Sem função/migração no banco (vedada pela
spec §12), cada chamada PostgREST é autocomitada; a ordem que garante o invariante sob
interleavings de concorrência é:

1. `create` da nova sessão (id conhecido);
2. `revokeAllActiveExcept(userId, novoId)` — revoga todas as ativas exceto a nova.

Análise de concorrência: a última revogação sempre remove tudo exceto a própria sessão; o pior
caso deixa as duas revogadas (novo login necessário), nunca duas ativas. A ordem literal
(revoke-then-create) permite duas sessões ativas quando duas revogações rodam antes dos dois
creates. Desvio registrado no ADR 0013, com follow-up de função transacional no banco para
atomicidade estrita em fatia futura.

### JWT

- HS256 com `JWT_SECRET` (validado no boot: obrigatório, ≥ 32 chars).
- Claims apenas `sub` (user id), `sid` (session id), `iat`, `exp` = `iat + SESSION_TTL_SECONDS`.
- Verificação checa assinatura e expiração; sessão ativa é consultada a cada requisição
  autenticada (`revoked_at IS NULL AND expires_at > now`), e o `sub` deve casar com o
  `user_id` da sessão.

### Contrato de erro

- Filtro global `ErrorContractFilter` registado via `APP_FILTER` no `AppModule`.
- Payload de `HttpException` com `{ code, message }` é preservado (com `fieldErrors` quando
  houver); `HttpException` padrão ganha `code` derivado do status e mensagem genérica; erro
  desconhecido → `500 INTERNAL_ERROR` sem detalhes internos (stack apenas em log do servidor).
- 401 de sessão usa exatamente o contrato da spec §8.

### Web

- Cookie `session_token` (nome definido aqui, conforme autorizado pela spec §8).
- `apps/web/lib/auth/session-cookie.ts`: `SESSION_COOKIE_NAME`, `createSessionCookieOptions`
  (puro e testável) e `setSessionCookie` para as fatias 005/006.
- `apps/web/lib/auth/api-client.ts`: `getBearerToken()` + `fetchApiWithSession()` — lê o cookie
  com `cookies()` do `next/headers` (server-only), monta `Authorization: Bearer`, chama a API em
  `API_BASE_URL`. Sem cookie → sem header.
- Home: link "Abrir a API" passa a apontar para `http://localhost:3333/api/v1/hello`.
- Vitest no web apenas para `lib/**` (sem jsdom/Testing Library — sem UI nova nesta fatia).

### Infra local

- `supabase/config.toml`: descomentar `smtp_port = 54325` (Mailpit já roda em 54324, mas a porta
  SMTP não estava exposta). Requer um ciclo `supabase stop` (sem `--no-backup`, volumes
  preservados) + `supabase start` na stack local — onda 1 só tem esta spec, e o ciclo não é
  destrutivo nem toca no LGTM.

## 5. Arquivos e áreas afetadas

Criados:

- `apps/api/src/modules/auth/**` (módulo completo)
- `apps/api/src/modules/shared/interface/error-contract.ts` e `error-contract.filter.ts` (+ spec)
- `apps/api/src/test/fakes/**` (repositórios, e-mail e token fake)
- `apps/web/lib/auth/session-cookie.ts`, `apps/web/lib/auth/api-client.ts` (+ specs)
- `apps/web/vitest.config.mts`
- `.adrs/0013-auth-session-jwt-cookie.md`

Alterados:

- `apps/api/src/app-setup.ts` (prefixo `/api/v1`), `apps/api/src/app.module.ts` (AuthModule,
  APP_FILTER)
- `apps/api/src/modules/hello/interface/hello.controller.ts` (`@Controller("hello")`) e
  `hello.integration.spec.ts` (rotas novas + `GET /` 404)
- `apps/api/src/modules/shared/config/env.ts` + `env.spec.ts`, `apps/api/src/test/setup-env.ts`
- `apps/api/package.json`, `apps/web/package.json` (deps/scripts), `bun.lock`
- `apps/web/app/page.tsx`, `apps/web/e2e/home.spec.ts`
- `supabase/config.toml` (smtp_port)
- `.env.example` (novas variáveis; sem valores reais de segredo), `.env` local (não versionado)
- `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md`, `README.md`, `.adrs/README.md`
- `.specs/002-auth-session.md` (status), este plano

## 6. Passos de implementação

- [x] Passo 1 — Instalar dependências (`jose`, `nodemailer`, `@supabase/supabase-js` na api;
      `vitest` no web) e atualizar `bun.lock`.
- [x] Passo 2 — Config de ambiente: `JWT_SECRET`, `SESSION_TTL_SECONDS`, `SMTP_HOST`, `SMTP_PORT`,
      `SMTP_FROM` em `env.ts` com validação + testes; `setup-env.ts`; `.env` local e
      `.env.example`.
- [x] Passo 3 — Expor SMTP local: descomentar `smtp_port = 54325` no `config.toml`, ciclo
      stop/start da stack, verificar migrações e dados intactos.
- [x] Passo 4 — Contrato de erro compartilhado (`toErrorContract` + filtro global + spec) e prefixo
      `/api/v1` no `app-setup.ts`; registrar `APP_FILTER` no `AppModule`.
- [x] Passo 5 — Migrar hello para `GET /api/v1/hello` e atualizar testes de integração (incluindo
      `GET /` → 404 com contrato).
- [x] Passo 6 — Domínio e aplicação do auth: tipos de domínio, `InvalidSessionError`, portas,
      template de e-mail, `CreateSessionUseCase`, `ValidateSessionUseCase`, fakes e specs.
- [x] Passo 7 — Infraestrutura do auth: adaptador jose (+ spec), repositórios Supabase (+ spec),
      sender SMTP (+ spec) e `auth.module.ts`.
- [x] Passo 8 — Interface do auth: guard, decorator `@CurrentUser()`, `GET /api/v1/auth/me`,
      integração com fakes e JWT real.
- [x] Passo 9 — Web: ponte de sessão + opções de cookie + specs (Vitest), link da home e E2E
      atualizados.
- [x] Passo 10 — Documentação: ADR 0013 + índice, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `QA.md`,
      `README.md`, `.env.example`.
- [x] Passo 11 — QA completo: `lint`, `types:check`, `test`, `build`, `test:e2e`, `db:migrate`,
      `db:test` e QA manual (endpoints, sessão única, e-mail no Mailpit, logs sem PII).
- [x] Passo 12 — Status da spec e do plano para `done`, commit local na branch `spec/002`.

## 7. Riscos e mitigação

| Risco                                                        | Mitigação                                                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `jose` ESM-only em build CJS                                 | Runtime alvo é Node ≥ 24/Bun com `require(esm)`; verificado em `types:check`, `test` e `build` + smoke manual              |
| Duas sessões ativas sob concorrência                         | Ordem create-then-revoke-except (analisada no §4) + teste unitário da política                                             |
| Atomicidade estrita sem transação no banco                   | Invariante pós-sucesso garantido no nível da aplicação; follow-up de RPC transacional registrado no ADR                    |
| Ciclo stop/start do Supabase local                           | `stop` sem `--no-backup` preserva volumes; verificação de migrações/dados antes e depois; onda 1 isolada                   |
| Segredo JWT fraco/vazado                                     | Obrigatório e ≥ 32 chars, validado no boot; `.env` não versionado; `.env.example` sem valor real                           |
| Erros do SMTP com PII em logs                                | Falha de e-mail não bloqueia a sessão; log com `userId`/`sessionId` e mensagem com e-mails mascarados                      |
| Cookie/bridge sem fluxo público que os exercite no navegador | Opções e ponte cobertas por testes unitários; inspeção no navegador fica para 005/006 (sem criação de sessão pública aqui) |
| Quebra de consumidores do `GET /`                            | Spec determina a remoção; testes, E2E e docs atualizados na mesma mudança                                                  |

## 8. Plano de testes

- **Unitário (api):** claims/expiração do JWT (`jose` adapter, round-trip, secret errada, token
  expirado); `CreateSessionUseCase` (persiste com origin/expiração, revoga anteriores exceto a
  nova, assina JWT, dispara e-mail, e-mail falho não bloqueia); `ValidateSessionUseCase` (válido,
  token inválido, sessão revogada/expirada/inexistente, user divergente); template de e-mail
  (assunto, data/hora, alerta, sem link); contrato de erro (`toErrorContract`); sender SMTP com
  `nodemailer` mockado; filtros PostgREST dos repositórios com client mockado; `loadEnv` com as
  novas variáveis.
- **Integração (api, Supertest):** `GET /api/v1/auth/me` com JWT válido+sessão ativa (200),
  sem header, token inválido, token expirado, sessão revogada e sid inexistente (401 + contrato);
  `GET /api/v1/hello` 200 + CORS; `GET /` 404 + contrato; corpo de 401 idêntico ao da spec.
- **Unitário (web):** opções do cookie (HttpOnly, SameSite=Lax, Path=/, Max-Age, Secure só em
  produção); ponte monta `Authorization: Bearer` com cookie e não monta sem cookie; URL da API.
- **E2E (web):** regressão da home com o link novo para `/api/v1/hello`.
- **Banco:** `bun run db:migrate` (idempotente, sem migração nova) e `bun run db:test` (pgTAP da
  001 segue verde).

## 9. QA manual

1. `bun run dev` (api + web) com Supabase e Mailpit no ar.
2. `GET http://localhost:3333/` → 404 com contrato `NOT_FOUND`.
3. `GET http://localhost:3333/api/v1/hello` → 200 `{"message":"Hello World"}`.
4. `GET http://localhost:3333/api/v1/auth/me` sem token → 401 com contrato da spec.
5. Script temporário (fora do commit) criando usuário + sessão com os adaptadores reais contra o
   banco local: JWT devolve 200 em `/me`; segunda sessão revoga a primeira (JWT antigo → 401).
6. Mailpit (`http://127.0.0.1:54324`): e-mail "New session on your account" com data/hora e
   alerta de senha, sem link de recuperação.
7. Logs da API sem JWT, e-mail, PII ou segredo.
8. Inspeção do cookie no navegador fica registrada como follow-up das fatias 005/006 (não há
   fluxo público que grave o cookie nesta fatia); opções validadas por teste unitário.

## 10. Rollout e rollback

- Sem migração de schema e sem feature flag; usa as tabelas da fatia 001.
- Rollout: commit na branch `spec/002`; a orquestração integra por onda.
- Rollback: reverter o commit; sessões são descartáveis no ambiente local (a tabela pode ser
  truncada manualmente se necessário, sem impacto para outras fatias).
- Config: novas variáveis documentadas em `.env.example`; `JWT_SECRET` obrigatório faz o boot
  falhar explicitamente se ausente (fail fast).
