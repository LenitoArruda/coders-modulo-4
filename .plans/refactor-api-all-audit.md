# Auditoria de vertical slices — api-all

> **Status:** em andamento · **Fase:** 1 (auditoria) · **Autor:** Agente 1 (Auditor)
> **Data:** 2026-11-11

## Cabeçalho

| Campo            | Valor                                             |
| ---------------- | ------------------------------------------------- |
| Escopo           | `api-all`                                         |
| Slices auditadas | `auth`, `hello` (`modules/shared` fora do escopo) |
| Branch           | `refactor/api-all`                                |
| Base             | `feat/observability-dashboard` (HEAD `ca944a1`)   |
| Data             | 2026-11-11                                        |
| Skill            | `refactor-vertical-slices`                        |

### Baseline (antes da refatoração)

| Gate    | Comando               | Resultado | Evidência                                                       |
| ------- | --------------------- | --------- | --------------------------------------------------------------- |
| Lint    | `bun run lint`        | ✅ ok     | 3 tasks successful (api, web, ui); turbo 2.11.10                |
| Tipagem | `bun run types:check` | ✅ ok     | 3 tasks successful (api `tsc --noEmit`, web typegen + tsc)      |
| Testes  | `bun run test`        | ✅ ok     | API: 44 arquivos / 313 testes; 2 tasks successful               |
| Build   | `bun run build`       | ✅ ok     | 2 tasks successful (`tsc -p tsconfig.build.json`, `next build`) |

> `bun run test:e2e` não foi executado: a refatoração é exclusiva da API e não altera o web.

---

## 1. Slices e camadas

Prefixo global confirmado em `apps/api/src/app-setup.ts:12-16` (`API_PREFIX = "api/v1"` +
`app.setGlobalPrefix`). Contagem por decorators de rota: **7 endpoints em `auth` + 1 em `hello`**.

| Slice   | `domain`                                                                                                                                                                                     | `application`                                                                                                                                                                                                                                                    | `infrastructure`                                                                                                                                                                                                                                             | `interface`                                                                                                                                                                                                   | Endpoints                                                                                                                                                                                                                       | Status                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `auth`  | `auth-user.ts`, `session.ts`, `sign-up-input.ts`, `sign-in-input.ts`, `forgot-password-input.ts`, `reset-password-input.ts`, `password-policy.ts`, `*.errors.ts`, `invalid-session.error.ts` | 6 use cases de fluxo (`sign-up`, `sign-in`, `sign-out`, `confirm-account`, `request-password-reset`, `reset-password`) + **ausente** `get-current-user` + 2 serviços internos (`create-session`, `validate-session`) + 7 portas em `ports/` + builders de e-mail | 7 adaptadores (`supabase-users.repository`, `supabase-sessions.repository`, `supabase-auth-tokens.repository`, `scrypt-password-hasher.adapter`, `jose-session-token.adapter`, `crypto-opaque-token.adapter`, `mailtrap-email.sender`) + `supabase-error.ts` | `auth.controller.ts` (7 rotas), `session.guard.ts`, `current-user.decorator.ts`, 5 rate limiters (+ base `SlidingWindowRateLimiter`), 7 `*.integration.spec.ts`; **não existe** `interface/request-handlers/` | `POST /api/v1/auth/sign-out`<br>`POST /api/v1/auth/sign-in`<br>`POST /api/v1/auth/sign-up`<br>`POST /api/v1/auth/forgot-password`<br>`POST /api/v1/auth/reset-password`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/confirm` | ❌ não conforme — 2 blockers e 3 minors (`AUTH-01`…`AUTH-05`) |
| `hello` | `hello-message.ts`                                                                                                                                                                           | `get-hello.use-case.ts` + unit spec                                                                                                                                                                                                                              | Ausente por não haver I/O — permitido                                                                                                                                                                                                                        | `hello.controller.ts` (1 rota) + `hello.integration.spec.ts`; **não existe** `interface/request-handlers/`                                                                                                    | `GET /api/v1/hello`                                                                                                                                                                                                             | ❌ não conforme — 1 minor (`HELLO-01`)                        |

Verificações estruturais que **passaram**:

- `application` não importa `infrastructure/` nem `interface/` (grep em `apps/api/src/modules/auth/application`: apenas `@nestjs/common` para DI e imports de `domain`/`ports`).
- `domain` não importa `@nestjs/*`, HTTP, SDK, banco ou `application` (grep em `apps/api/src/modules/auth/domain`: nenhuma ocorrência).
- `infrastructure` não importa `interface/`; os adaptadores implementam as portas de `application/ports/` e o `AuthModule` liga porta → adaptador (`auth.module.ts:142-154`).
- Não há `any` nem `@ts-ignore` nas slices auditadas.
- `hello` não tem `infrastructure/` porque `GetHelloUseCase` não faz I/O — ausência legítima.

---

## 2. Inventário de comportamento (golden master)

Contrato global: todo erro segue `{ code, message, fieldErrors? }` (`apps/api/src/modules/shared/interface/error-contract.ts:5-9`); erros 5xx não previstos viram `500 INTERNAL_ERROR` opaco (`error-contract.ts:34-35,77-82`); 401 de sessão é sempre `{ code: "UNAUTHORIZED", message: "Your session is invalid or has expired. Sign in again." }` (`error-contract.ts:11-12,113-118`). Nenhum endpoint da API define `Set-Cookie`: o cookie `session_token` é responsabilidade do web. `Retry-After` só aparece em respostas `429`. Rate limiters são em memória e por processo.

### `POST /api/v1/auth/sign-up`

- **Decorators/guards:** `@Post("sign-up")`; sem `@HttpCode`; `@Res({ passthrough: true })` para status dinâmico; sem guard (`auth.controller.ts:246-251`).
- **Rate limit:** `SignUpRateLimiter` — 5 tentativas / 60 s por IP (`clientIp`), consumido **antes** da validação; `Retry-After` em `429` (`auth.controller.ts:252-264`; defaults em `env.ts:12-16`).
- **Validação:** `validateSignUpInput`; `400 VALIDATION_ERROR` com `fieldErrors` por campo (`firstName`, `lastName`, `email`, `password`, `passwordConfirmation`) (`auth.controller.ts:266-274`; `sign-up-input.ts:164-195`).
- **Sucesso:** `201` quando a conta é criada, corpo `{ message, user }`; `200` quando um e-mail ainda não confirmado é reenviado, corpo `{ message }` sem `user` (`auth.controller.ts:276-283`). `message` = `"Check your email to confirm your account."` (`auth.controller.ts:65-66`).
- **Erros:** `400 VALIDATION_ERROR` + `fieldErrors`; `409 EMAIL_ALREADY_CONFIRMED` (`"An account with this email already exists. Sign in instead."`); `429 TOO_MANY_REQUESTS` + `Retry-After`; `503 CONFIRMATION_EMAIL_FAILED` (`auth.controller.ts:284-306`).
- **Headers/cookies:** nenhum `Set-Cookie`; `Retry-After` apenas no `429`; JSON no sucesso.
- **Efeitos colaterais:** cria usuário não confirmado + token de confirmação, ou reemite o token de um e-mail existente não confirmado; envia o e-mail `"Confirm your account"`; logs sem PII (`sign-up.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/sign-up.integration.spec.ts`.

### `POST /api/v1/auth/sign-in`

- **Decorators/guards:** `@Post("sign-in")`, `@HttpCode(HttpStatus.OK)`, `@Res({ passthrough: true })`; sem guard (`auth.controller.ts:183-189`).
- **Rate limit:** `SignInRateLimiter` — 5 tentativas / 60 s por `IP|e-mail normalizado`, consumido **após** a validação; `Retry-After` em `429` (`auth.controller.ts:199-213`; defaults em `env.ts:33-37`).
- **Validação:** `parseSignInInput`; corpo malformado/campos vazios → `400 VALIDATION_ERROR` sem `fieldErrors` (`auth.controller.ts:190-197`; `sign-in-input.ts:18-42`).
- **Sucesso:** `200` com `{ accessToken, tokenType: "Bearer", expiresIn, user }` (`auth.controller.ts:215-216`; `sign-in.use-case.ts:17-22`). `expiresIn` = `SESSION_TTL_SECONDS` (default `604800`).
- **Erros:** `400 VALIDATION_ERROR`; `401 INVALID_CREDENTIALS` (`"Invalid email or password."`); `403 EMAIL_NOT_CONFIRMED` (`"Please confirm your email before signing in."`); `429 TOO_MANY_REQUESTS` + `Retry-After` (`auth.controller.ts:217-233,236-244`).
- **Headers/cookies:** nenhum `Set-Cookie`; `Retry-After` apenas no `429`.
- **Efeitos colaterais:** verifica senha antes do estado de confirmação; revoga sessões anteriores (sessão única), cria sessão `sign_in` e envia o e-mail `"New session on your account"`; logs sem PII (`sign-in.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/sign-in.integration.spec.ts`.

### `POST /api/v1/auth/sign-out`

- **Decorators/guards:** `@Post("sign-out")`, `@UseGuards(SessionGuard)`, `@HttpCode(HttpStatus.NO_CONTENT)`; sem `@Res` (`auth.controller.ts:170-174`).
- **Rate limit:** nenhum.
- **Validação:** `SessionGuard` valida `Authorization: Bearer <jwt>` e a sessão server-side; token ausente/malformado/expirado/revogado → `401 UNAUTHORIZED` (`session.guard.ts:45-63`). O controller reextrai o token apenas para revogar (`auth.controller.ts:175-180`).
- **Sucesso:** `204 No Content`, sem corpo.
- **Erros:** `401 UNAUTHORIZED` (contrato padrão do guard).
- **Headers/cookies:** sem corpo e sem `Set-Cookie`.
- **Efeitos colaterais:** revoga a sessão atual; o JWT deixa de funcionar imediatamente (`sign-out.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/sign-out.integration.spec.ts`.

### `POST /api/v1/auth/confirm`

- **Decorators/guards:** `@Post("confirm")`, `@HttpCode(HttpStatus.OK)`, `@Res({ passthrough: true })`; sem guard (`auth.controller.ts:421-427`).
- **Rate limit:** `ConfirmationRateLimiter` — 10 tentativas / 60 s por IP, consumido **antes** da leitura do token; `Retry-After` em `429` (`auth.controller.ts:428-440`; defaults em `env.ts:18-22`).
- **Validação:** `readConfirmationToken` (manual); corpo sem `token` string não vazia → `400 INVALID_CONFIRMATION_TOKEN` (`auth.controller.ts:130-144,442-449`).
- **Sucesso:** `200` com `{ accessToken, tokenType: "Bearer", expiresIn, user }` (`auth.controller.ts:451-452`; `confirm-account.use-case.ts:19-24`).
- **Erros:** `400 INVALID_CONFIRMATION_TOKEN` (`"This confirmation link is invalid or has expired."`); `409 ACCOUNT_ALREADY_CONFIRMED` (`"This account is already confirmed. Sign in instead."`); `429 TOO_MANY_REQUESTS` + `Retry-After` (`auth.controller.ts:453-472`).
- **Headers/cookies:** nenhum `Set-Cookie`; `Retry-After` apenas no `429`.
- **Efeitos colaterais:** consome o token de confirmação, confirma a conta, revoga sessão anterior e cria a primeira sessão (`sign_up_confirmation`), envia e-mail de nova sessão; logs sem PII (`confirm-account.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/confirm.integration.spec.ts`.

### `POST /api/v1/auth/forgot-password`

- **Decorators/guards:** `@Post("forgot-password")`, `@HttpCode(HttpStatus.OK)`, `@Res({ passthrough: true })`; sem guard (`auth.controller.ts:309-315`).
- **Rate limit:** `ForgotPasswordRateLimiter` — 5 tentativas / 60 s por `ip:<ip>` **antes** da validação e por `email:<e-mail normalizado>` **depois** da validação; `Retry-After` em `429` (`auth.controller.ts:316-359`; defaults em `env.ts:27-31`).
- **Validação:** `validateForgotPasswordInput`; e-mail ausente/inválido → `400 VALIDATION_ERROR` com `fieldErrors.email` (`auth.controller.ts:332-340`; `forgot-password-input.ts:27-62`).
- **Sucesso:** `200` com `{ message }` genérico `"If an account exists for this email, we sent a password reset link."`, independentemente de a conta existir (`auth.controller.ts:361-363,105-106`).
- **Erros:** `400 VALIDATION_ERROR` + `fieldErrors.email`; `429 TOO_MANY_REQUESTS` + `Retry-After`.
- **Headers/cookies:** nenhum `Set-Cookie`; `Retry-After` apenas no `429`.
- **Efeitos colaterais:** para conta existente (confirmada ou não), invalida token pendente anterior, persiste apenas o hash do novo token e envia `"Reset your password"`; para e-mail inexistente, mesma resposta sem envio; logs sem PII (`request-password-reset.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/forgot-password.integration.spec.ts`.

### `POST /api/v1/auth/reset-password`

- **Decorators/guards:** `@Post("reset-password")`, `@HttpCode(HttpStatus.OK)`, `@Res({ passthrough: true })`; sem guard (`auth.controller.ts:366-372`).
- **Rate limit:** `ResetPasswordRateLimiter` — 5 tentativas / 60 s por IP, consumido **antes** da validação; `Retry-After` em `429` (`auth.controller.ts:373-385`; defaults em `env.ts:39-43`).
- **Validação:** `validateResetPasswordInput` valida senha e confirmação **antes** de olhar o token; `400 VALIDATION_ERROR` com `fieldErrors` (`password`, `passwordConfirmation`) tem precedência sobre token inválido (`auth.controller.ts:387-397`; `reset-password-input.ts:33-67`).
- **Sucesso:** `200` com `{ message }` = `"Your password has been updated. Sign in with your new password."` (`auth.controller.ts:412,115-116`).
- **Erros:** `400 VALIDATION_ERROR` + `fieldErrors`; `400 INVALID_RESET_TOKEN` (`"This password reset link is invalid or has expired."`); `429 TOO_MANY_REQUESTS` + `Retry-After` (`auth.controller.ts:399-410`).
- **Headers/cookies:** nenhum `Set-Cookie`; `Retry-After` apenas no `429`.
- **Efeitos colaterais:** troca a senha, consome o token, revoga todas as sessões e envia `"Your password has been changed"`; falha do e-mail não desfaz a troca de senha; logs sem PII (`reset-password.use-case.ts`).
- **Teste de integração:** `apps/api/src/modules/auth/interface/reset-password.integration.spec.ts`.

### `GET /api/v1/auth/me`

- **Decorators/guards:** `@Get("me")`, `@UseGuards(SessionGuard)`; `@CurrentUser()` injeta o usuário resolvido pelo guard (`auth.controller.ts:415-419`).
- **Rate limit:** nenhum.
- **Validação:** `SessionGuard` valida JWT + sessão server-side; qualquer falha → `401 UNAUTHORIZED` (`session.guard.ts:45-63`).
- **Sucesso:** `200` com `{ user }` (`AuthUser`: `id`, `firstName`, `lastName`, `email`) (`auth.controller.ts:56,417-419`).
- **Erros:** `401 UNAUTHORIZED` (contrato padrão, sem detalhes internos).
- **Headers/cookies:** nenhum `Set-Cookie`.
- **Efeitos colaterais:** nenhum (leitura).
- **Teste de integração:** `apps/api/src/modules/auth/interface/auth.integration.spec.ts:34` (descreve `GET /api/v1/auth/me`).

### `GET /api/v1/hello`

- **Decorators/guards:** `@Controller("hello")` + `@Get()`; sem guard (`hello.controller.ts:8-18`).
- **Rate limit:** nenhum.
- **Validação:** nenhuma (sem entrada).
- **Sucesso:** `200` com `{ message: "Hello World" }` (`hello.controller.ts:15-18`; `get-hello.use-case.ts`).
- **Erros:** nenhum erro de endpoint; fora do prefixo `api/v1`, o middleware global responde `404 { code: "NOT_FOUND", message: "Resource not found." }` (`app-setup.ts:17`; testado em `hello.integration.spec.ts:42-49`).
- **Headers/cookies:** JSON; CORS tratado globalmente (`app-setup.ts:18-27`); sem `Set-Cookie`.
- **Efeitos colaterais:** nenhum.
- **Teste de integração:** `apps/api/src/modules/hello/interface/hello.integration.spec.ts:16`.

### Cobertura de integração

| Endpoint                            | Arquivo de teste de integração                       | Coberto |
| ----------------------------------- | ---------------------------------------------------- | ------- |
| `POST /api/v1/auth/sign-up`         | `auth/interface/sign-up.integration.spec.ts`         | ✅      |
| `POST /api/v1/auth/sign-in`         | `auth/interface/sign-in.integration.spec.ts`         | ✅      |
| `POST /api/v1/auth/sign-out`        | `auth/interface/sign-out.integration.spec.ts`        | ✅      |
| `POST /api/v1/auth/confirm`         | `auth/interface/confirm.integration.spec.ts`         | ✅      |
| `POST /api/v1/auth/forgot-password` | `auth/interface/forgot-password.integration.spec.ts` | ✅      |
| `POST /api/v1/auth/reset-password`  | `auth/interface/reset-password.integration.spec.ts`  | ✅      |
| `GET /api/v1/auth/me`               | `auth/interface/auth.integration.spec.ts:34`         | ✅      |
| `GET /api/v1/hello`                 | `hello/interface/hello.integration.spec.ts:16`       | ✅      |

**Nenhum endpoint está sem teste de integração** — não há blocker por falta de cobertura.

---

## 3. Achados

| ID         | slice | camada                | severidade | regra violada                                                                    | arquivo:linha                                                                                                             | evidência                                                                                                                                                                                                                                                                                                                                               | mudança exigida                                                                                                                                                                                                                             | risco                                                                                                          |
| ---------- | ----- | --------------------- | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `AUTH-01`  | auth  | interface             | blocker    | 1:1 request handler ↔ use case — `audit-checklist` §5; `target-pattern` §3 e §10 | `apps/api/src/modules/auth/interface/auth.controller.ts:146-474`                                                          | A classe `AuthController` concentra **7 rotas** em uma única classe (`sign-out` 171, `sign-in` 183, `sign-up` 246, `forgot-password` 309, `reset-password` 366, `me` 415, `confirm` 421) e injeta 6 use cases + 5 rate limiters no mesmo construtor (148-168). Não existe `interface/request-handlers/`.                                                | Extrair um `*RequestHandler` por endpoint em `interface/request-handlers/`, cada um com exatamente um método de rota e um `*UseCase`, e registrar os 7 em `AuthModule.controllers`; remover `AuthController` só depois da integração verde. | médio: mover os corpos sem alterar status, corpos, headers, ordem de rate limit/validação e tradução de erros. |
| `AUTH-02`  | auth  | application/interface | blocker    | 1:1 e exceção explícita — `target-pattern` §9; `audit-checklist` §5 e §6         | `apps/api/src/modules/auth/interface/auth.controller.ts:415-419`                                                          | `GET /auth/me` devolve `{ user }` direto do `@CurrentUser()` sem use case; não existe `get-current-user.use-case.ts` em `application/` e o handler não injeta nenhum `*UseCase`.                                                                                                                                                                        | Criar um `GetCurrentUserUseCase` fino e injetá-lo no handler 1:1 **ou** registrar formalmente a exceção no ADR e na auditoria (previsto em `target-pattern` §9), sem deixar a decisão implícita.                                            | baixo: sem efeito colateral; o risco é arquitetural se a exceção ficar indefinida.                             |
| `AUTH-03`  | auth  | module                | minor      | `target-pattern` §7; `audit-checklist` §4 (provider órfão/código morto)          | `apps/api/src/modules/auth/auth.module.ts:170-181`                                                                        | `exports` lista 10 providers (`CreateSessionUseCase`, `SignUpUseCase`, `SignUpRateLimiter`, `ConfirmAccountUseCase`, `ConfirmationRateLimiter`, `SignInUseCase`, `SignInRateLimiter`, `ValidateSessionUseCase`, `SessionTokenPort`, `JoseSessionTokenAdapter`), mas o único importador de `AuthModule` é `app.module.ts:9` e não consome nenhum export. | Remover os exports não consumidos ou documentar o contrato público do módulo.                                                                                                                                                               | baixo: nenhum efeito em runtime; reduz superfície e acoplamento.                                               |
| `AUTH-04`  | auth  | interface             | minor      | DRY — `DEVELOPMENT.md` §1; `audit-checklist` §4                                  | `apps/api/src/modules/auth/interface/forgot-password-rate-limiter.ts:19-72` vs `.../sliding-window-rate-limiter.ts:14-66` | `ForgotPasswordRateLimiter` reimplementa `attempts`, `consume`, `reset` e `prune` de forma idêntica ao `SlidingWindowRateLimiter`; os demais limiters estendem a base (`sign-up-rate-limiter.ts:12`, `sign-in-rate-limiter.ts:16`, `confirmation-rate-limiter.ts:15`, `reset-password-rate-limiter.ts:16`).                                             | Fazer `ForgotPasswordRateLimiter extends SlidingWindowRateLimiter`, preservando tokens, limites e comportamento; validar com `forgot-password-rate-limiter.spec.ts` e a integração.                                                         | baixo: a duplicação hoje é idêntica; o risco é drift futuro entre as cópias.                                   |
| `HELLO-01` | hello | interface             | minor      | nomenclatura/localização — `audit-checklist` §5 e §10; `target-pattern` §2 e §3  | `apps/api/src/modules/hello/interface/hello.controller.ts:8-19`                                                           | Controller de **um** endpoint (`GET /hello`) ainda nomeado `hello.controller.ts`/`HelloController` e fora de `interface/request-handlers/`.                                                                                                                                                                                                             | Renomear para `interface/request-handlers/get-hello.request-handler.ts` (`GetHelloRequestHandler`) e registrar no `HelloModule`; ou registrar isenção explícita.                                                                            | baixo: só nomenclatura; o contrato `{ message: "Hello World" }` não muda.                                      |
| `AUTH-05`  | auth  | interface (testes)    | minor      | organização de teste — `audit-checklist` §4 e §9                                 | `apps/api/src/modules/auth/interface/auth.integration.spec.ts:34`; `.../confirm.integration.spec.ts:56`                   | O teste de `/me` mora em `auth.integration.spec.ts`, nome genérico que não descreve o fluxo, e o teste de confirmação usa `confirm.integration.spec.ts` enquanto o fluxo/use case se chama `confirm-account`.                                                                                                                                           | Alinhar os nomes ao fluxo (`get-current-user.integration.spec.ts`, `confirm-account.integration.spec.ts`) ou documentar a convenção adotada.                                                                                                | baixo: apenas descoberta/manutenção; nenhum contrato observável muda.                                          |

---

## 4. Isenções e ambiguidades

### Isenções registradas

| Caso                                               | Justificativa                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `modules/shared`                                   | Transversal (config, logging, observabilidade, contrato de erro, CORS); fora do escopo por padrão (`audit-checklist` §10).          |
| `apps/api/src/test/fakes/*`                        | Infraestrutura de teste; isenta de camadas (`audit-checklist` §10).                                                                 |
| `CreateSessionUseCase`                             | Serviço interno da aplicação usado por `SignInUseCase` e `ConfirmAccountUseCase`; não é use case de endpoint (`target-pattern` §4). |
| `ValidateSessionUseCase`                           | Serviço interno consumido pelo `SessionGuard`; não é use case de endpoint.                                                          |
| Prefixo `@Controller("auth")` compartilhado        | Permitido; por si só não configura controller multi-endpoint (`audit-checklist` §10; `target-pattern` §3).                          |
| `readConfirmationToken` e `clientIp` no controller | Validação de entrada e obtenção de IP são responsabilidades da interface; devem migrar junto com o corpo para os request handlers.  |
| `supabase-error.ts`                                | Helper de tradução de erro da infraestrutura; permanece em `infrastructure/`.                                                       |
| `HelloModule` sem `infrastructure/`                | `GetHelloUseCase` não faz I/O; a camada só é exigida quando há I/O (`target-pattern` §10).                                          |
| Rate limiters em memória por processo              | Comportamento atual documentado como follow-up (store compartilhado); não é desvio arquitetural desta refatoração.                  |
| Ausência de `Set-Cookie` na API                    | O cookie `session_token` é gravado pelo web; a API expõe o token no corpo. O contrato atual deve ser preservado.                    |

### Ambiguidades e divergências documentais

1. **Sign-out documentado como inexistente, mas implementado.** `ARCHITECTURE.md:211` e `ARCHITECTURE.md:545` afirmam que "o endpoint de sign-out ainda não existe", porém `POST /api/v1/auth/sign-out` existe (`auth.controller.ts:171-181`) e tem teste de integração (`sign-out.integration.spec.ts:27`). Pela hierarquia de `AGENTS.md` §2, o código mostra o estado atual; a documentação deve ser corrigida na mesma refatoração.
2. **Exceção do `GET /auth/me`.** O `target-pattern` §9 aceita tanto um `GetCurrentUserUseCase` fino quanto uma exceção documentada no ADR e na auditoria. Esta auditoria registra o desvio como `AUTH-02` (blocker) porque a decisão ainda não está formalizada; o próximo agente deve escolher uma das duas saídas antes de fechar o blocker.
3. **Nomes dos testes de integração.** `AUTH-05` é convenção de organização. Se o time decidir que `auth.integration.spec.ts` e `confirm.integration.spec.ts` são nomes aceitáveis, o achado pode ser encerrado como convenção documentada, sem mudança de código.
4. **Status dinâmico do sign-up.** O handler divide `201` (conta criada, com `user`) e `200` (reenvio, sem `user`) via `response.status` (`auth.controller.ts:279-283`). A refatoração não pode fixar `@HttpCode(201)` nem remover o `@Res({ passthrough: true })`.
5. **Ordem rate limit → validação.** A ordem varia por endpoint: sign-up e reset-password limitam antes de validar; sign-in valida antes de limitar; forgot-password limita por IP, valida e depois limita por e-mail; confirm limita antes de ler o token. Essa ordem é parte do contrato observável e deve ser preservada.
6. **`Retry-After` via `@Res({ passthrough: true })`.** O header é escrito no `Response` antes de lançar o `429`; a migração para handlers deve manter o mesmo mecanismo.

---

## 5. Resultado

| Severidade | Quantidade | IDs                                         |
| ---------- | ---------- | ------------------------------------------- |
| blocker    | 2          | `AUTH-01`, `AUTH-02`                        |
| major      | 0          | —                                           |
| minor      | 4          | `AUTH-03`, `AUTH-04`, `AUTH-05`, `HELLO-01` |
| **Total**  | **6**      |                                             |

Conclusão: a direção das dependências está correta e **todos os 8 endpoints têm teste de integração**, mas a slice `auth` ainda viola o contrato 1:1 (controller multi-endpoint e `/me` sem use case). A refatoração não pode ser considerada concluída antes de resolver os 2 blockers.

AUDIT_RESULT: blocked
blockers: 2 | majors: 0 | minors: 4
artefato: .plans/refactor-api-all-audit.md
