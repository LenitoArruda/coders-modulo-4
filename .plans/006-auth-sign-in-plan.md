# Plano — Auth sign-in

> Spec: `.specs/006-auth-sign-in.md`
> Status: done
> Criado em: 2026-11-10
> Concluído em: 2026-11-10

## 1. Contexto

As fatias 001–005 e 007 entregam schema, sessão (JWT + registro server-side + e-mail de nova
sessão via `CreateSessionUseCase`), rotas web, sign-up, confirmação de conta e forgot-password.
Falta entrar com e-mail e senha: `/auth/sign-in` é um placeholder e o guard de `/app/*` ainda
redireciona para `/auth/sign-up`.

## 2. Objetivo e critérios de aceite

Entregar `POST /api/v1/auth/sign-in`, a página `/auth/sign-in` real, o guard com `returnTo`
seguro e a raiz `/` apontando para `/app` ou `/auth/sign-in`.

| Critério (spec §14)                                                    | Evidência planejada                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Credenciais válidas → sessão `sign_in`, redirect `/app`, e-mail        | `sign-in.use-case.spec.ts`, `sign-in.integration.spec.ts`, E2E             |
| E-mail/senha/conta inexistente → `401` genérico, sem sessão nem e-mail | `sign-in.use-case.spec.ts`, `sign-in.integration.spec.ts`, E2E             |
| Conta não confirmada → `403`, sem sessão e orientação                  | `sign-in.use-case.spec.ts`, `sign-in.integration.spec.ts`, E2E             |
| Sessão anterior revogada; só a nova acessa `/app`; novo e-mail         | `sign-in.integration.spec.ts` (`/me` antigo vs novo, concorrência), E2E    |
| `/app/*` sem sessão → `/auth/sign-in?returnTo=`; retorno seguro        | `route-rules.spec.ts` (open redirect), `sign-in.spec.ts` (web), E2E        |
| Raiz e páginas de auth conforme a sessão                               | `route-rules.spec.ts`, `routing.spec.ts`                                   |
| Rate limit, mensagens genéricas, JWT/cookie, sem PII em logs           | `sign-in-rate-limiter.spec.ts`, integração (429, corpo sem PII, logs), E2E |

## 3. Escopo

### Dentro

Endpoint público de sign-in, caso de uso, rate limiter configurável, página e formulário,
Server Action com cookie `HttpOnly`, `proxy.ts` para propagar o caminho solicitado ao guard,
`returnTo` validado, ajustes de rotas/raiz, testes (unitário, integração, E2E) e docs.

### Fora

Sign-out, refresh, remember me, reset de senha (007/008), `reset=success`, MFA/SSO,
lockout permanente, reenvio de confirmação, gestão de sessões, nova migração.

## 4. Abordagem técnica

### API

- `domain/sign-in-input.ts`: normaliza e-mail (trim/lowercase) e exige senha string não vazia
  (máx. 128). Entrada malformada responde `400 VALIDATION_ERROR` sem consumir rate limit; e-mail
  sem formato válido segue para o `401` genérico.
- `domain/sign-in.errors.ts`: `InvalidCredentialsError`, `EmailNotConfirmedError`.
- `application/sign-in.use-case.ts`: localiza a conta por e-mail; verifica a senha SEMPRE
  (contra um hash dummy real, calculado uma vez, quando a conta não existe) para mitigar
  timing; só depois de senha correta checa `emailConfirmedAt` (`403`), assim o `403` nunca
  revela existência de conta a quem não sabe a senha; cria a sessão via `CreateSessionUseCase`
  (`origin = sign_in`), que cria a nova sessão e revoga as demais excluindo a nova, invariante
  consistente sob concorrência (pior caso: ambas revogadas, exigindo novo sign-in; nunca duas
  ativas).
- `interface/sign-in-rate-limiter.ts`: `SlidingWindowRateLimiter` configurável
  (`SIGN_IN_RATE_LIMIT_MAX` padrão 5 e `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS` padrão 60), chave única
  `IP|e-mail normalizado`; a 6ª tentativa recebe `429` com `Retry-After` e mensagem genérica.
- `auth.controller.ts`: `POST auth/sign-in` (`200`), mapeia erros (`400`, `401 INVALID_CREDENTIALS`,
  `403 EMAIL_NOT_CONFIRMED`, `429 TOO_MANY_REQUESTS`).
- Logs: apenas `userId`/`outcome`, nunca e-mail, senha ou token.

### Web

- `lib/auth/route-rules.ts`: `SIGNED_OUT_REDIRECT_PATH = /auth/sign-in`, `sanitizeReturnTo`
  (apenas `/app` ou `/app/...`, sem `//`, `\`, esquema, controle, `..`, nem equivalentes
  codificados) e `buildSignInPath(returnTo)`.
- `proxy.ts` (Next 16) em `/app/:path*`: propaga `pathname + search` no header de requisição
  `x-return-to`, usado pelo guard (layouts não conhecem o caminho). Não decide acesso.
- `lib/auth/guards.ts`: `requireSessionUser` lê o header, sanitiza e redireciona para
  `/auth/sign-in?returnTo=...`.
- `lib/auth/sign-in.ts`: contrato, estado do formulário e parsing da resposta (en-US).
- `app/auth/sign-in/{page,actions,sign-in-form}.tsx`: formulário acessível (labels,
  `aria-describedby`, alerta com foco), Server Action que chama a API, grava o cookie e faz
  `redirect` ao `returnTo` seguro; link “Forgot password?”.
- `/auth/confirm` sem token redireciona (`/app` com sessão, `/auth/sign-in` sem sessão); o erro de
  token inválido passa a ter o CTA principal "Sign in" (`confirm-form.tsx`).
- E2E: API fake ganha `POST /api/v1/auth/sign-in` determinístico; novo `sign-in.spec.ts`;
  `routing.spec.ts` atualizado.

## 5. Arquivos e áreas afetadas

API (novos): `domain/sign-in-input.ts` (+spec), `domain/sign-in.errors.ts`,
`application/sign-in.use-case.ts` (+spec), `interface/sign-in-rate-limiter.ts` (+spec),
`interface/sign-in.integration.spec.ts`. API (alterados): `auth.controller.ts`, `auth.module.ts`,
`auth.tokens.ts`, `shared/config/env.ts` (+spec), `test/setup-env.ts`, `.env.example`.

Web (novos): `proxy.ts`, `lib/auth/sign-in.ts` (+spec), `app/auth/sign-in/actions.ts`,
`app/auth/sign-in/sign-in-form.tsx`, `e2e/sign-in.spec.ts`. Web (alterados): `route-rules.ts`
(+spec), `guards.ts`, `app/auth/sign-in/page.tsx`, `e2e/support/*`, `e2e/routing.spec.ts`.

Também alterados: `app/auth/confirm/{page,confirm-form}.tsx`, `e2e/confirm-account.spec.ts`,
`playwright.config.ts` (timeout de `expect` de 15 s para cold start do `next dev`).

Docs: `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md`, specs 003, 005 e 006 (comportamento
de `/`, `/app/*` e `/auth/confirm`) e este plano.

## 6. Passos de implementação

- [x] 1. Config: envs de rate limit de sign-in, tokens de DI, `.env.example`, `setup-env`.
- [x] 2. Domínio (input + erros) e caso de uso de sign-in com testes.
- [x] 3. Rate limiter + controller + módulo + integração.
- [x] 4. Web: route-rules/`returnTo`, proxy, guard, com testes.
- [x] 5. Web: contrato `sign-in.ts`, action, formulário e página.
- [x] 6. E2E (API fake, `sign-in.spec.ts`, `routing.spec.ts`).
- [x] 7. Docs, QA completo, status `done`.

## 7. Riscos e mitigação

| Risco                                     | Mitigação                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Enumeração de contas (resposta/timing)    | `401` único, verificação com hash dummy, `403` só após senha correta     |
| Duas sessões ativas sob concorrência      | Ordem create → revoke-except existente; teste de sign-ins simultâneos    |
| Open redirect via `returnTo`              | `sanitizeReturnTo` com testes de vetores de ataque; revalidado na action |
| Força bruta                               | Rate limit por IP e por e-mail; sem lockout                              |
| Vazamento em logs                         | Logs só com `userId`; teste espiona o logger                             |
| Header `x-return-to` forjado pelo cliente | Proxy sempre sobrescreve; valor sanitizado e restrito a `/app`           |

## 8. Plano de testes

Unitário (input, caso de uso, limiter, route-rules, parsing web), integração com Supertest
(sucesso, 401 x3, 403, 429, falha de e-mail, `/me` antigo/novo, concorrência, sem PII) e E2E
Playwright (fluxo, 401/403/429, returnTo, raiz, redirects, responsividade).

## 9. QA manual

Teclado/foco, 360/768/1280 px, textos en-US, cookie `HttpOnly`/`Lax`, e-mail de nova sessão no
Mailpit local (opcional; coberto por testes de integração).

## 10. Rollout e rollback

Sem migração nem flag. Rollback: reverter o commit.
