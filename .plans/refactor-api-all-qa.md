# QA da refatoração — api-all

> **Fase:** 4 (QA/reauditoria) · **Data:** 2026-11-11 · **Branch:** `refactor/api-all`
> **Escopo:** `api-all` (slices `auth` e `hello`; `modules/shared` fora do escopo)
> Comparação feita contra `HEAD` (`cb9dbd5`) com as mudanças não commitadas.

## 1. Gates

Executados na raiz, na ordem pedida. A primeira rodada usou o cache do turbo; como prova independente,
rodei uma segunda rodada com `bunx turbo run lint types:check test build --force` (0 tasks em cache).

| Gate    | Comando               | Resultado | Evidência                                                                |
| ------- | --------------------- | --------- | ------------------------------------------------------------------------ |
| Lint    | `bun run lint`        | ok        | 3/3 tasks, `eslint --max-warnings 0`                                     |
| Tipagem | `bun run types:check` | ok        | 3/3 tasks (`tsc --noEmit`, web com `next typegen`)                       |
| Testes  | `bun run test`        | ok        | API: **52 arquivos / 343 testes** passando; web: 9 arquivos / 115 testes |
| Build   | `bun run build`       | ok        | 2/2 tasks (`tsc -p tsconfig.build.json`, `next build`)                   |
| Forçado | `turbo ... --force`   | ok        | 10/10 tasks, 0 em cache, exit 0                                          |

- `bun run code:fix` **não foi necessário** (lint passou sem ajustes); nenhum arquivo foi tocado por mim além deste.
- `test:e2e` não rodado: nenhuma mudança em `apps/web` (`git diff HEAD --stat -- apps/web` vazio).
- Contagem de testes: baseline 313 / 44 arquivos -> 343 / 52 arquivos (+30 testes, +8 arquivos). Os +30 batem exatamente
  com os novos specs: 7 specs de request handler (5+1+4+4+5+3+6 = 28 `it`) + `get-current-user.use-case.spec.ts` (2 `it`).
  Nenhum teste existente foi perdido.

## 2. Reauditoria por slice (audit-checklist)

### Achados originais

| ID         | Sev.    | Situação  | Evidência da resolução                                                                                                                                                                      |
| ---------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH-01`  | blocker | resolvido | `auth.controller.ts` removido; 7 `*RequestHandler` em `auth/interface/request-handlers/`, registrados em `AuthModule.controllers`. Cada um com 1 decorator de rota e 1 `*UseCase` injetado. |
| `AUTH-02`  | blocker | resolvido | Criado `application/get-current-user.use-case.ts` (+ spec); `GetCurrentUserRequestHandler` o injeta (opção "use case fino" de `target-pattern` §9). ADR `0015` registrado.                  |
| `AUTH-03`  | minor   | resolvido | `exports` do `AuthModule` reduzido de 10 para `[SessionTokenPort]`, com comentário (usado pelos specs de integração via `moduleRef.get`).                                                   |
| `AUTH-04`  | minor   | resolvido | `ForgotPasswordRateLimiter extends SlidingWindowRateLimiter` (`super(max, windowSeconds)`); duplicação removida; spec existente do limiter passa.                                           |
| `AUTH-05`  | minor   | resolvido | Specs renomeados: `confirm-account.integration.spec.ts` e `get-current-user.integration.spec.ts` (R100, conteúdo idêntico).                                                                 |
| `HELLO-01` | minor   | resolvido | `hello.controller.ts` -> `interface/request-handlers/get-hello.request-handler.ts` (`GetHelloRequestHandler`), registrado em `HelloModule`.                                                 |

### Checks estruturais (reexecutados)

| Check                                                                   | Resultado | Evidência                                                                                                      |
| ----------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Sobrou `*.controller.ts` multi-endpoint?                                | não       | nenhum `*.controller.ts` em `modules/`; todos os `@Controller` estão em `*.request-handler.ts` (8 arquivos)    |
| Handler com mais de um use case?                                        | não       | 8 handlers, 8 `@Inject(*UseCase)` (exatamente 1 por handler); demais injeções são rate limiters                |
| Handler com mais de uma rota?                                           | não       | 8 decorators de rota em `interface/` (excluindo specs) para 8 handlers                                         |
| `application`/`domain`/`interface` importam `infrastructure`?           | não       | grep em `modules/*/{interface,application,domain}` sem ocorrências em código de produção                       |
| Alguma dependência aponta para fora (handler -> repositório/SDK)?       | não       | imports dos handlers: `@nestjs/common`, `express` (tipos), `application/`, `domain/` e helpers de `interface/` |
| `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` em auth/hello | não       | só `expect.any(String)` (matcher do vitest) em specs; nenhum `any` de tipo                                     |
| `hello` sem `infrastructure/`                                           | isenção   | `GetHelloUseCase` não faz I/O (permitido)                                                                      |
| Helpers `clientIp` / `readConfirmationToken` extraídos                  | ok        | `interface/client-ip.ts`, `interface/read-confirmation-token.ts`; corpo idêntico ao original                   |

**Resultado: blockers restantes = 0 · majors restantes = 0 · minors restantes = 0.**

## 3. Contrato de comportamento (handlers novos vs `git show HEAD:.../auth.controller.ts`)

Comparei corpo a corpo cada método do `AuthController` de HEAD com o handler novo. Diferenças: somente nome do método
(`handle`), a única chamada nova (`getCurrentUser.execute(user)`, que devolve o mesmo `user`) e o fato de constantes/tipos
exportados migrarem para o arquivo do handler. Sem diferença em decorators, ordem, status, mensagens ou códigos.

| Endpoint                            | Decorators/guards                            | Rate limit (escopo e ordem)                               | Status/corpo                                                 | Erros mapeados                                                                                          | Teste de integração                                | Preservado |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| `POST /api/v1/auth/sign-up`         | `@Post`, sem `@HttpCode`, `@Res passthrough` | IP, antes da validação; `Retry-After` no 429              | 201 `{message,user}` / 200 `{message}` via `response.status` | 400 `VALIDATION_ERROR`+fieldErrors, 409 `EMAIL_ALREADY_CONFIRMED`, 429, 503 `CONFIRMATION_EMAIL_FAILED` | `sign-up.integration.spec.ts`                      | sim        |
| `POST /api/v1/auth/sign-in`         | `@HttpCode(200)`                             | `IP\|email`, depois da validação                          | 200 `SignInResult`                                           | 400 sem fieldErrors, 401 `INVALID_CREDENTIALS`, 403 `EMAIL_NOT_CONFIRMED`, 429                          | `sign-in.integration.spec.ts`                      | sim        |
| `POST /api/v1/auth/sign-out`        | `@UseGuards(SessionGuard)`, `@HttpCode(204)` | nenhum                                                    | 204 sem corpo                                                | 401 do guard                                                                                            | `sign-out.integration.spec.ts`                     | sim        |
| `POST /api/v1/auth/confirm`         | `@HttpCode(200)`                             | IP, antes de ler o token                                  | 200 `ConfirmAccountResult`                                   | 400 `INVALID_CONFIRMATION_TOKEN`, 409 `ACCOUNT_ALREADY_CONFIRMED`, 429                                  | `confirm-account.integration.spec.ts` (renomeado)  | sim        |
| `POST /api/v1/auth/forgot-password` | `@HttpCode(200)`                             | `ip:` antes da validação e `email:` depois; mesmo limiter | 200 `{message}` genérico                                     | 400 `VALIDATION_ERROR`+`fieldErrors.email`, 429                                                         | `forgot-password.integration.spec.ts`              | sim        |
| `POST /api/v1/auth/reset-password`  | `@HttpCode(200)`                             | IP, antes da validação; validação precede token           | 200 `{message}`                                              | 400 `VALIDATION_ERROR`, 400 `INVALID_RESET_TOKEN`, 429                                                  | `reset-password.integration.spec.ts`               | sim        |
| `GET /api/v1/auth/me`               | `@UseGuards(SessionGuard)`, `@CurrentUser()` | nenhum                                                    | 200 `{user}`                                                 | 401 do guard                                                                                            | `get-current-user.integration.spec.ts` (renomeado) | sim        |
| `GET /api/v1/hello`                 | `@Controller("hello")`, `@Get()`             | nenhum                                                    | 200 `{message:"Hello World"}`                                | 404 global fora do prefixo                                                                              | `hello.integration.spec.ts` (inalterado)           | sim        |

- Cookies: nenhum `Set-Cookie` na API, antes e depois. `Retry-After` apenas em 429, via `@Res({ passthrough: true })` (mesmo mecanismo).
- Rate limiters: tokens de configuração, limites e janelas inalterados. Único ajuste é `ForgotPasswordRateLimiter` herdar da base
  (código copiado idêntico ao original; `forgot-password-rate-limiter.spec.ts` e a integração passam).
- Efeitos colaterais (e-mail, sessão, logs): vivem nos use cases, que **não** foram modificados (nenhum arquivo de `application/` existente aparece no diff).
- Os 8 endpoints seguem cobertos por teste de integração.
- `AuthModule`: providers inalterados exceto `+GetCurrentUserUseCase`; `exports` reduzido (o único importador, `app.module.ts`, não consome exports).
  Nenhum spec quebrou.

## 4. Teste enfraquecido

- `git diff HEAD -M --stat -- '*.spec.ts'`: os dois renames aparecem com `0 insertions, 0 deletions` e `rename ... (100%)` no `--summary`: conteúdo **idêntico**.
- Nenhum spec existente foi modificado ou deletado (único arquivo removido com spec associado: `auth.controller.ts`/`hello.controller.ts`, que não tinham spec próprio;
  a cobertura deles continua nas integrações).
- grep por `.skip`, `.todo`, `.only`, `xit`, `xdescribe` em `auth/` e `hello/`: nenhuma ocorrência.
- Sem asserções genéricas novas: `expect.any(String)` aparece só em campos de valor dinâmico (ids, tokens, timestamps, mensagens de fieldErrors), junto a asserções de forma.
- Contagem de testes só cresceu (+30, todos explicados por specs novos).

## 5. Segurança e higiene do diff

| Verificação                                                                 | Resultado                                                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `any` / `@ts-ignore` / `eslint-disable` introduzidos                        | nenhum                                                                                                           |
| Dependência nova (`package.json`, `bun.lock`)                               | nenhuma (`git diff HEAD` vazio nesses arquivos)                                                                  |
| Segredos (grep por `secret`, `api_key`, chaves privadas) nos arquivos novos | nenhum                                                                                                           |
| Artefatos gerados (`dist`, `.next`, `.env`, lock) no `git status`           | nenhum                                                                                                           |
| Arquivos fora do escopo alterados                                           | só documentação (`.adrs/README.md`, `.docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `QA.md`), ADR `0015` e `.plans/*` |

Observação: o git avisa "LF will be replaced by CRLF" em alguns arquivos (config de autocrlf do Windows); não é mudança de conteúdo.

## 6. QA manual reproduzível

Pré-requisito: `.env` da API válido (Supabase, JWT, Mailtrap). Subir a API: `bun run dev` (ou `bun --filter api dev`); base `http://localhost:<PORT>/api/v1`.

```bash
B=http://localhost:3001/api/v1   # ajuste a porta
curl -i $B/hello                                                     # 200 {"message":"Hello World"}
curl -i -X POST $B/auth/sign-up -H 'content-type: application/json' -d '{}'          # 400 VALIDATION_ERROR + fieldErrors
curl -i -X POST $B/auth/sign-in -H 'content-type: application/json' -d '{}'          # 400 VALIDATION_ERROR sem fieldErrors
curl -i -X POST $B/auth/forgot-password -H 'content-type: application/json' -d '{"email":"x@example.com"}'  # 200 mensagem genérica
curl -i -X POST $B/auth/reset-password -H 'content-type: application/json' -d '{"token":"t"}'              # 400 VALIDATION_ERROR (precede token)
curl -i -X POST $B/auth/confirm -H 'content-type: application/json' -d '{}'          # 400 INVALID_CONFIRMATION_TOKEN
curl -i $B/auth/me                                                    # 401 UNAUTHORIZED
curl -i -X POST $B/auth/sign-out                                      # 401 UNAUTHORIZED
# Rate limit: repetir o sign-up 6x seguidas do mesmo IP -> 6a resposta 429 + Retry-After
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/auth/sign-up -H 'content-type: application/json' -d '{}'; done
# Fluxo feliz: sign-up -> e-mail Mailtrap -> confirm (200 + accessToken) -> me (200 {user}) -> sign-out (204) -> me (401)
```

Não executei o fluxo feliz contra serviços reais (sem credenciais neste ambiente); ele é coberto pelos testes de integração com fakes.

## 7. Riscos residuais

1. Rate limiters seguem em memória por processo (já registrado na auditoria; fora do escopo).
2. `exports` do `AuthModule` reduzido: se um módulo futuro precisar de outro provider, deve exportá-lo explicitamente (hoje sem consumidores).
3. Fluxo feliz ponta a ponta contra Supabase/Mailtrap reais não foi exercitado manualmente (apenas fakes nos testes de integração).
4. Os specs de request handler novos são unitários; o contrato HTTP em si é provado pelos 8 specs de integração, que não foram alterados.
5. Primeira rodada de gates usou cache do turbo; mitigado pela rodada `--force` (10/10 tasks, 343 testes na API).

## 8. Evidências

- Logs: saída de `bun run lint|types:check|test|build` e `bunx turbo run lint types:check test build --force` (exit 0).
- `git diff HEAD -M --summary`: renames 100% e remoções de `auth.controller.ts` e `hello.controller.ts`.
- `git show HEAD:apps/api/src/modules/auth/interface/auth.controller.ts` comparado com `auth/interface/request-handlers/*.request-handler.ts`.
- Handlers: `apps/api/src/modules/auth/interface/request-handlers/` (7) e `apps/api/src/modules/hello/interface/request-handlers/get-hello.request-handler.ts`.

QA_RESULT: ok
gates: lint=ok types=ok test=ok build=ok
reauditoria: blockers restantes=0 | majors restantes=0
artefato: .plans/refactor-api-all-qa.md
