# Plano — Auth reset password

> Spec: `.specs/008-auth-reset-password.md`
> Status: done
> Concluído em: 2026-11-10
> Criado em: 2026-11-10

## 1. Contexto

As fatias 001–007 entregaram schema, sessão, rotas, sign-up, confirmação, sign-in e a solicitação de
recuperação (token `password_reset` por e-mail). `/auth/reset-password` ainda é um placeholder: não
valida o token, não troca a senha e não revoga sessões. Esta fatia fecha a jornada.

## 2. Objetivo e critérios de aceite

Entregar `POST /api/v1/auth/reset-password` e a página pública `/auth/reset-password`, com troca de
senha, consumo condicional do token, revogação de todas as sessões, e-mail de sucesso e mensagem de
sucesso no sign-in (`reset=success`).

| Critério (spec §14)                                                                      | Evidência planejada                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Token válido → senha atualizada, token consumido, sessões revogadas, e-mail, redirect    | `reset-password.use-case.spec.ts`, `reset-password.integration.spec.ts`, E2E               |
| Token inválido/expirado/usado → sem alteração, sem sessão, caminho para novo link        | caso de uso, integração, E2E (link inválido, segundo uso)                                  |
| Senha fora da política ou confirmação diferente → erros por campo, token não queimado    | `reset-password-input.spec.ts`, `password-policy.spec.ts`, integração, E2E                 |
| Conta não confirmada → e-mail confirmado no reset                                        | caso de uso + integração                                                                   |
| Sessão antiga rejeitada; senha antiga falha; senha nova entra                            | integração (`GET /me` com JWT antigo, sign-in antigo/novo), E2E (sessão antiga)            |
| E-mail de sucesso en-US; falha no envio não reverte                                      | `password-changed-email.spec.ts`, caso de uso, integração                                  |
| Rate limit, token de uso único com hash, token fora da URL, sem PII em logs, sign-in msg | rate limiter spec, integração (429/Retry-After), E2E (URL limpa, sign-in), revisão de logs |

## 3. Escopo

### Dentro

- Endpoint, caso de uso, validação, e-mail de sucesso, rate limiter por IP e variáveis de ambiente.
- Ports `updatePassword` (usuários) e `revokeAllActive` (sessões), adapters Supabase e fakes.
- Extração da política de senha do sign-up para `password-policy.ts` (sem mudar o comportamento).
- Página `/auth/reset-password`, Server Action, lib de contrato, `Referrer-Policy: no-referrer`,
  `history.replaceState`, e mensagem `reset=success` no sign-in.
- Testes unitários, integração e E2E; fake API do E2E; docs, `.env.example` e README.

### Fora

Tudo o que a spec lista em "Fora" (change password em `/app`, MFA, histórico de senhas etc.).
Sem nova migração e sem nova dependência.

## 4. Abordagem técnica

- **Ordem das escritas (sem transação):** hash da nova senha → consome o token (condicional
  `used_at is null`) → `updatePassword` → `confirmEmail` → `invalidateUnused(password_reset)` →
  `revokeAllActive` → e-mail de sucesso (falha apenas registrada). Senha e confirmação são
  validadas antes de qualquer escrita; o hash é calculado antes de consumir o token.
- **Erros:** `INVALID_RESET_TOKEN` (400), `VALIDATION_ERROR` com `fieldErrors` (400, vale mesmo com
  token inválido, sem consumir), `TOO_MANY_REQUESTS` (429 + `Retry-After`).
- **Rate limit:** `ResetPasswordRateLimiter extends SlidingWindowRateLimiter`, chave por IP,
  `RESET_PASSWORD_RATE_LIMIT_MAX` (5) e `RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS` (60).
- **Web:** a página (Server Component) lê `searchParams.token` e renderiza o formulário com o token
  como prop; o client faz `history.replaceState` para `/auth/reset-password` no mount e guarda o
  token em `useState`. A rota responde `Referrer-Policy: no-referrer` (`headers()` no
  `next.config.js`) e não carrega recursos externos. Token ausente → estado de link inválido.
  Sucesso → `redirect("/auth/sign-in?reset=success")` na Server Action. O dev server do Next não
  loga `/auth/reset-password` (mesma regra de `/auth/confirm`).
- **Sign-in:** a página lê `reset=success` e mostra um `role="status"` acima do formulário.

## 5. Arquivos e áreas afetadas

API: `domain/password-policy.ts`, `domain/reset-password-input.ts`, `domain/reset-password.errors.ts`,
`domain/sign-up-input.ts`, `application/reset-password.use-case.ts`,
`application/password-changed-email.ts`, ports de usuários e sessões, adapters Supabase,
`interface/reset-password-rate-limiter.ts`, `auth.controller.ts`, `auth.module.ts`, `auth.tokens.ts`,
`shared/config/env.ts`, fakes em `src/test/fakes`, `setup-env.ts`.
Web: `app/auth/reset-password/{page,actions,reset-password-form}`, `lib/auth/reset-password.ts`,
`app/auth/sign-in/page.tsx`, `next.config.js`, `e2e/reset-password.spec.ts`, fake API e sessão do E2E.
Docs: `.docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `QA.md`, `README.md`, `.env.example`, spec e plano.

## 6. Passos de implementação

- [x] 1. Env, tokens DI e `setup-env` do rate limit de reset
- [x] 2. Política de senha compartilhada (`password-policy.ts`) e validação do reset
- [x] 3. Ports `updatePassword`/`revokeAllActive`, adapters Supabase e fakes (+ testes)
- [x] 4. E-mail de sucesso e `ResetPasswordUseCase` (+ testes)
- [x] 5. Rate limiter, controller, módulo e integração (+ testes)
- [x] 6. Web: lib, action, formulário, página, headers e logging; sign-in com `reset=success`
- [x] 7. E2E e fake API
- [x] 8. Docs, README, `.env.example`, spec e plano finais
- [x] 9. QA completo (lint, types, test, build, e2e) e commits

## 7. Riscos e mitigação

| Risco                                      | Mitigação                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Falha parcial após consumir o token        | Ordem documentada; a pessoa pede novo link; sessões só caem após o update |
| Corrida com o mesmo token                  | Consumo condicional; o perdedor recebe `INVALID_RESET_TOKEN`              |
| Vazamento do token por URL/Referer/logs    | `replaceState`, `Referrer-Policy`, log do Next ignorado, sem logar corpo  |
| Regressão no sign-up ao extrair a política | Testes existentes de sign-up permanecem inalterados                       |

## 8. Plano de testes

Unitário (política, input, e-mail, caso de uso, limiter, adapters, env, lib web), integração
(Supertest com fakes: sucesso, token inválido/expirado/usado, validação, corrida, `/me` com JWT
antigo, sign-in antigo/novo, e-mail, 429, ausência de PII) e E2E (fluxo, link inválido, senha
diferente, segundo uso, sessão antiga, URL limpa, `Referrer-Policy`, responsividade, foco).

## 9. QA manual

Fluxo real com Mailpit local: solicitar reset, abrir o link, trocar a senha, ver o e-mail de
sucesso, confirmar `reset=success` no sign-in e a queda das sessões antigas.

## 10. Rollout e rollback

Sem migração nem feature flag. Rollback: reverter os commits; tokens e sessões são descartáveis.
