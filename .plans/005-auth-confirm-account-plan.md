# Plano — Auth confirm account

> Spec: `.specs/005-auth-confirm-account.md`
> Status: done
> Criado em: 2026-11-10
> Concluído em: 2026-11-10

## 1. Contexto

As fatias 001–004 entregam schema (`users`, `auth_tokens`, `sessions`), infraestrutura de
sessão (JWT + registro server-side + e-mail via SMTP), as rotas públicas/privadas do web e o
sign-up. O sign-up cria a conta como não confirmada e envia o link
`/auth/confirm?token=...`, mas a rota ainda é um placeholder: não valida o token, não confirma
o e-mail, não cria sessão e não leva a pessoa para `/app`.

Esta fatia fecha a jornada: consome o token de uso único, confirma o e-mail, cria a primeira
sessão JWT (`origin = sign_up_confirmation`), revoga sessões anteriores, dispara o e-mail de
nova sessão e redireciona para `/app`, que passa a mostrar o primeiro nome da pessoa.

## 2. Objetivo e critérios de aceite

Objetivo: entregar `POST /api/v1/auth/confirm` e a página pública `/auth/confirm`, com
validação de token por hash, confirmação idempotente na conta, sessão única, cookie
`HttpOnly`, `/app` personalizado e erros acionáveis para links inválidos/expirados/usados e
contas já confirmadas.

Critérios da spec e onde são verificados:

| Critério (spec §14)                                                              | Evidência planejada                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Token válido → conta confirmada, token consumido, sessão criada, e-mail e `/app` | `confirm-account.use-case.spec.ts`, `confirm.integration.spec.ts`, E2E                         |
| Token inválido/expirado/usado → sem sessão, sem confirmação e erro acionável     | `confirm-account.use-case.spec.ts`, `confirm.integration.spec.ts`, E2E                         |
| Conta já confirmada → `409`, sem sessão nova e orientação para sign-in           | `confirm-account.use-case.spec.ts`, `confirm.integration.spec.ts`, E2E                         |
| Sessão válida → `/app` mostra o primeiro nome e `/me` devolve os dados           | `auth.integration.spec.ts` (já existente), `app/app/page.tsx`, E2E                             |
| Nova sessão revoga a anterior e apenas ela acessa `/app`; e-mail enviado         | `create-session.use-case.spec.ts` (já existente), `confirm.integration.spec.ts`, E2E           |
| Sessão ausente/revogada/expirada → `/app/*` para sign-up e API `401`             | `routing.spec.ts` (já existente), `auth.integration.spec.ts` (já existente)                    |
| JWT só com `sub`, `sid`, `iat` e `exp`; cookie `HttpOnly`/`Lax`/`Secure` em prod | `jose-session-token.adapter.spec.ts` / `session-cookie.spec.ts` (já existentes), E2E de cookie |
| Sem token/PII em logs e respostas                                                | integração (sem token/JWT no corpo e sem header), revisão dos logs do caso de uso              |
| UI en-US, light-only, acessível e responsiva em 360/768/1280 px                  | E2E de confirmação e de acessibilidade                                                         |

## 3. Escopo

### Dentro

- Endpoint público `POST /api/v1/auth/confirm` com validação de token no corpo, contrato de
  resposta `{ accessToken, tokenType, expiresIn, user }` e erros `400/409/429/500`.
- Caso de uso de confirmação: hash do token, busca por hash, uso único, expiração, confirmação
  da conta e criação da sessão com `origin = sign_up_confirmation`.
- Portas/adaptadores: tokens de auth (`findByHash`, `consume`) e usuários (`findAccountById`,
  `confirmEmail`) no Supabase, com fakes em memória para testes.
- Rate limiting em memória configurável por IP no endpoint, com `Retry-After`.
- Página `/auth/confirm?token=...` real (Server Component + Server Action + formulário client)
  com auto-submit único, fallback sem JavaScript, remoção do token da URL e estados de sucesso
  e erro.
- `/app` personalizado com o primeiro nome da pessoa autenticada.
- Testes unitários, de integração e E2E; atualização de docs (ARCHITECTURE, QA, `.env.example`)
  e do planejamento.

### Fora

- Sign-in, sign-out, refresh token, MFA, SSO, login social e “remember me”.
- Recuperação/reset de senha, reenvio dedicado de confirmação e link de recuperação no e-mail.
- Gestão de sessões/dispositivos pelo usuário, edição de perfil, troca de e-mail e exclusão.
- Provedor de e-mail de produção, CI e observabilidade além do padrão atual.
- Nova migração de schema.

## 4. Abordagem técnica

### API

- `domain/`
  - `confirmation.errors.ts`: `InvalidConfirmationTokenError` (token ausente, desconhecido,
    expirado ou já usado) e `AccountAlreadyConfirmedError` (conflito `409`).
- `application/`
  - `confirm-account.use-case.ts`: normaliza/valida o token, calcula o hash via
    `OpaqueTokenPort`, busca por hash, verifica purpose/expiração/uso, carrega a conta, rejeita
    conta confirmada com `409`, consome o token atomicamente, confirma o e-mail sem sobrescrever
    `email_confirmed_at`, cria a sessão reutilizando `CreateSessionUseCase` com
    `origin = sign_up_confirmation` e devolve `{ token, user, expiresIn }`.
  - Portas: `AuthTokensRepositoryPort` ganha `findByHash(tokenHash)` e
    `consume(tokenId)` (retorna `false` quando outra requisição consumiu primeiro);
    `UsersRepositoryPort` ganha `findAccountById(id)` e `confirmEmail(id)` (retorna `false`
    quando a conta já estava confirmada).
- `infrastructure/`
  - `supabase-auth-tokens.repository.ts`: `findByHash` com `maybeSingle` e `consume` com
    `update({ used_at }).eq(id).is(used_at, null).select(id)` para não marcar duas vezes.
  - `supabase-users.repository.ts`: `findAccountById` e `confirmEmail` com
    `update({ email_confirmed_at }).eq(id).is(email_confirmed_at, null)`.
- `interface/`
  - `auth.controller.ts`: `POST confirm` público (`@HttpCode(200)`), rate limit por IP antes da
    validação, mapeamento de erros para o contrato existente.
  - `sliding-window-rate-limiter.ts`: base compartilhada; `SignUpRateLimiter` e o novo
    `ConfirmationRateLimiter` apenas injetam seus limites.
- `test/fakes/`: tokens e usuários em memória ganham os novos métodos; a sessão reutiliza
  `InMemorySessionsRepository`.

### Configuração

- `CONFIRMATION_RATE_LIMIT_MAX` (padrão 10) e `CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS`
  (padrão 60), validados em `loadEnv`; novos tokens de DI em `auth.tokens.ts`.
- `SESSION_TTL_SECONDS` continua sendo a fonte de `expiresIn`, para não divergir do JWT.

### Web

- `lib/auth/confirm.ts`: contrato do endpoint, leitura do token do formulário e parsing tipado
  da resposta, com mensagens en-US por status; testado em Vitest.
- `app/auth/confirm/actions.ts`: Server Action (`"use server"`) que envia o token no corpo,
  valida a resposta, grava o JWT em cookie `HttpOnly` com `setSessionCookie` e devolve o estado.
- `app/auth/confirm/confirm-form.tsx`: client component com `useActionState`, input oculto com
  o token, auto-submit único (guardado por ref) e botão fallback para navegadores sem JS;
  estado de sucesso dispara `router.replace("/app")` para remover o token da URL.
- `app/auth/confirm/page.tsx`: Server Component que lê `searchParams` (Promise no Next 16),
  processa o token mesmo com sessão ativa (a nova sessão revoga a anterior) e, sem token,
  redireciona pessoa autenticada para `/app` ou mostra o erro acionável com link para sign-up.
- `lib/auth/session.ts`: `getSessionUser` envolvido em `cache()` para deduplicar a chamada a
  `/me` entre o layout e a página privada na mesma requisição.
- `app/app/page.tsx`: usa `requireSessionUser` e renderiza `Welcome, <firstName>`.
- E2E: a API fake ganha `POST /api/v1/auth/confirm` determinístico (token válido, usado e
  inválido, além de `429`) e o cookie de sessão continua sendo validado por `/me`.

## 5. Arquivos e áreas afetadas

Criados (API): `domain/confirmation.errors.ts`,
`application/confirm-account.use-case.ts` (+ spec), `interface/sliding-window-rate-limiter.ts`,
`interface/confirmation-rate-limiter.ts` (+ spec), `interface/confirm.integration.spec.ts`.

Criados (web): `lib/auth/confirm.ts`, `lib/auth/confirm.spec.ts`,
`app/auth/confirm/actions.ts`, `app/auth/confirm/confirm-form.tsx`, `e2e/confirm-account.spec.ts`.

Alterados (API): `auth.controller.ts`, `auth.module.ts`, `auth.tokens.ts`,
`application/ports/auth-tokens-repository.port.ts`, `application/ports/users-repository.port.ts`,
`infrastructure/supabase-auth-tokens.repository.ts` (+ spec),
`infrastructure/supabase-users.repository.ts` (+ spec),
`test/fakes/in-memory-auth-tokens.repository.ts`, `test/fakes/in-memory-users.repository.ts`,
`test/setup-env.ts`, `modules/shared/config/env.ts` (+ spec), `interface/sign-up-rate-limiter.ts`.

Alterados (web): `app/auth/confirm/page.tsx`, `app/app/page.tsx`, `lib/auth/session.ts`,
`e2e/support/fake-api-server.ts`, `e2e/routing.spec.ts` (títulos/expectativas afetadas).

Alterados (docs/config): `.env.example`, `.docs/ARCHITECTURE.md`, `.docs/QA.md`, a spec 005
(status) e este plano.

## 6. Passos de implementação

- [x] 1. Configuração: envs de confirmação, tokens de DI, `.env.example` e `test/setup-env.ts`.
- [x] 2. Portas + adaptadores Supabase (`findByHash`/`consume`, `findAccountById`/`confirmEmail`)
      com testes e fakes em memória.
- [x] 3. Domínio + caso de uso de confirmação (uso único, expiração, `409`, sessão) com testes.
- [x] 4. Rate limiter genérico + `ConfirmationRateLimiter`, com testes.
- [x] 5. Controller `POST auth/confirm`, wiring do módulo e testes de integração
      (200/400/409/429, sessão única, `/me`, concorrência, sem token na resposta).
- [x] 6. Web: contrato/parsing, Server Action, formulário com auto-submit e página, com testes
      de lib; personalização de `/app` e `cache()` em `getSessionUser`.
- [x] 7. E2E: API fake de confirmação, cenários de sucesso/erros/cookie/URL e ajustes de rotas.
- [x] 8. Docs: ARCHITECTURE §4.6/§5, QA §5.9–5.11 e lacunas conhecidas.
- [x] 9. QA completo (`db:migrate`, lint, types:check, test, build, test:e2e) e QA manual.
- [x] 10. Plano/spec como `done` e commit local na branch `spec/005`.

## 7. Riscos e mitigação

| Risco                                              | Mitigação                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Duas confirmações simultâneas criarem duas sessões | `consume` condicional (`used_at is null`) define um único vencedor; revogação mantém uma ativa     |
| Token expirado/usado confirmar a conta             | Verificação de `used_at`/`expires_at` antes de confirmar; conta confirmada responde `409`          |
| `email_confirmed_at` sobrescrito                   | Update condicional `is(email_confirmed_at, null)`; retorno `false` vira `409`                      |
| Sessão criada mas e-mail falha                     | `CreateSessionUseCase` já registra a falha sem bloquear; sessão permanece válida                   |
| Token vazar pela URL após o uso                    | `router.replace("/app")` no sucesso; token nunca é logado e só trafega no corpo da API             |
| Auto-submit duplicado no StrictMode                | Guard por `ref` + `requestSubmit()`; botão fallback permanece acessível                            |
| Duplicação de `/me` entre layout e página          | `cache()` no `getSessionUser`, sem mudar o comportamento fora de um render                         |
| Rate limit em memória não ser distribuído          | “Básico” e local nesta fatia; limites configuráveis e follow-up para store compartilhado já aberto |
| E2E sem banco não inspecionar Mailpit              | Sessão/e-mail cobertos por integração com fakes + QA manual no Mailpit local                       |

## 8. Plano de testes

- **Unitário API:** caso de uso (token válido, ausente, desconhecido, expirado, usado, purpose
  divergente, conta confirmada, conta inexistente, consumo perdido, falha ao confirmar), rate
  limiter (limite, janela, chave, reset), env (novos limites), repositórios Supabase (cadeia
  PostgREST e erros).
- **Integração API:** `POST /api/v1/auth/confirm` 200/400/409/429; token de uso único e
  expiração; conta confirmada sem nova sessão; revogação da sessão anterior; `/me` com o novo
  JWT; ausência de `set-cookie` e de token no corpo; concorrência com exatamente uma sessão
  ativa.
- **Web (Vitest):** parsing do contrato de sucesso/erro por status, leitura do token e
  mensagens en-US.
- **E2E:** link válido → `/app` com primeiro nome, cookie `HttpOnly`/`Lax` e token fora da URL;
  link inválido, usado (`409`), rate limit (`429`) e ausência de token; sessão ativa sem token
  → `/app`; responsividade 360/768/1280 e foco visível.
- **Manual:** fluxo real contra API + Supabase local, inspeção do Mailpit (confirmação e nova
  sessão), cookie no navegador, conta já confirmada e revogação da sessão anterior.

## 9. QA manual

1. `bun run db:migrate` (sem reset) e `bun run dev`.
2. Criar conta em `/auth/sign-up` e abrir o Mailpit local → link `/auth/confirm?token=...`.
3. Abrir o link → `/app` com “Welcome, Ada”, cookie `session_token` `HttpOnly`/`Lax` e URL sem
   token; abrir o DevTools → Application → Cookies.
4. Mailpit → e-mail “New session on your account” com data/hora e alerta de senha.
5. Reabrir o mesmo link → erro acionável (conta já confirmada, `409`) e caminho para sign-in.
6. Abrir `/auth/confirm` com token inválido → erro “This confirmation link is invalid or has
   expired.”, link para sign-up e nenhum cookie novo.
7. Abrir `/auth/confirm` sem token com sessão → `/app`; sem sessão → erro com link para sign-up.
8. Disparar mais de `CONFIRMATION_RATE_LIMIT_MAX` confirmações em 60 s → `429` com mensagem
   genérica.
9. Verificar teclado, foco visível, 360/768/1280 px, light-only e textos en-US.

## 10. Rollout e rollback

- Sem migração e sem feature flag; substitui o placeholder de `/auth/confirm` e personaliza
  `/app`.
- Rollback: reverter o commit da spec. Tokens e sessões do ambiente local são descartáveis.
- Comunicação: documentação e testes na mesma mudança; follow-ups para rate limit distribuído,
  sign-in (fatia 006) e atomicidade transacional da sessão única (ADR 0013).
