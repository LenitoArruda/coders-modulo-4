# Plano de refatoração — api-all

> **Status:** proposto · **Fase:** 2 (plano) · **Autor:** Agente 2 (Planejador)
> **Data:** 2026-11-11
> **Escopo:** `api-all` — slices `auth` e `hello` (`modules/shared` fora do escopo)
> **Branch:** `refactor/api-all` · **Base da auditoria:** `ca944a1` ·
> **HEAD atual:** `cb9dbd5` (merge de `origin/main`; árvore idêntica a `ca944a1`)
> **Fonte dos achados:** [`.plans/refactor-api-all-audit.md`](./refactor-api-all-audit.md)
> **Contrato de referência:** `.agents/skills/refactor-vertical-slices/references/target-pattern.md`

---

## 1. Contexto e problema

A auditoria de `.plans/refactor-api-all-audit.md` concluiu `AUDIT_RESULT: blocked` com **2 blockers**
e **4 minors** nas slices `auth` e `hello`:

- `AuthController` concentra **7 endpoints** em uma única classe e injeta 6 use cases + 5 rate
  limiters no mesmo construtor (`AUTH-01`).
- `GET /api/v1/auth/me` devolve o usuário do `@CurrentUser()` sem use case de entrada (`AUTH-02`).
- `auth.module.ts` exporta 10 providers sem consumidor de produção (`AUTH-03`).
- `ForgotPasswordRateLimiter` reimplementa integralmente `SlidingWindowRateLimiter` (`AUTH-04`).
- Os testes de integração de `/me` e da confirmação usam nomes genéricos que não descrevem o fluxo
  (`AUTH-05`).
- `HelloController` tem um único endpoint, mas ainda é um `*.controller.ts` (`HELLO-01`).

O restante da slice já está conforme: as portas vivem em `application/ports/`, os adaptadores em
`infrastructure/`, `application` não importa `infrastructure`/`interface`, `domain` não importa
framework/HTTP/SDK, e **todos os 8 endpoints têm teste de integração**. O problema é de
**interface e composição**, não de direção de dependência.

## 2. Objetivo

Aplicar o padrão alvo da skill **sem alterar comportamento observável**:

1. Um **request handler por endpoint**, em `interface/request-handlers/`, com exatamente um método
   de rota e exatamente um `*UseCase` de entrada.
2. Um **use case por fluxo/intenção**, incluindo um `GetCurrentUserUseCase` fino para `/me`.
3. Nenhum `*.controller.ts` multi-endpoint nas slices do escopo.
4. Limpeza dos minors (`AUTH-03`, `AUTH-04`, `AUTH-05`, `HELLO-01`) sem tocar em rotas, status,
   corpos, headers, cookies, rate limits, guards, erros, e-mails ou efeitos colaterais.
5. Documentação e ADR sincronizados com o novo padrão.

## 3. Critérios de aceite

- [ ] Existem **7 request handlers de auth** e **1 de hello**, cada um com exatamente um método
      decorado com `@Get`/`@Post`/`@Put`/`@Patch`/`@Delete`.
- [ ] Cada handler injeta exatamente **um** `*UseCase` de endpoint. Rate limiter, guard e
      decorators não contam.
- [ ] `GET /api/v1/auth/me` é atendido por `GetCurrentUserRequestHandler`, que injeta
      `GetCurrentUserUseCase`.
- [ ] Nenhum `*.controller.ts` permanece em `modules/auth` ou `modules/hello`.
- [ ] `AUTH-03`, `AUTH-04`, `AUTH-05` e `HELLO-01` estão resolvidos e registrados no relatório.
- [ ] Os 8 endpoints mantêm método, caminho, status, corpo, headers, cookies, rate limit, guards,
      códigos de erro, mensagens e efeitos colaterais idênticos ao golden master da auditoria.
- [ ] Os testes de integração existentes continuam cobrindo os 8 endpoints, sem asserção removida
      ou enfraquecida.
- [ ] `bun run lint`, `bun run types:check`, `bun run test` e `bun run build` passam.
- [ ] `ARCHITECTURE.md`, `DEVELOPMENT.md`, `QA.md` e o novo ADR estão atualizados.
- [ ] Sem dependência nova, sem `any`, `@ts-ignore` ou `eslint-disable`, sem mudança no web.

## 4. Escopo

### 4.1 Dentro do escopo

| Área                                                           | Conteúdo                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/auth/interface/`                         | `auth.controller.ts`, rate limiters, guard, decorator e testes de integração                  |
| `apps/api/src/modules/auth/application/`                       | novo `get-current-user.use-case.ts` e seu spec; nenhuma mudança de regra nos demais use cases |
| `apps/api/src/modules/auth/auth.module.ts`                     | registro dos handlers, provider do novo use case, limpeza de exports                          |
| `apps/api/src/modules/hello/interface/`                        | `hello.controller.ts` → `request-handlers/get-hello.request-handler.ts`                       |
| `apps/api/src/modules/hello/hello.module.ts`                   | registro do novo handler                                                                      |
| `.plans/refactor-api-all-plan.md`                              | este plano                                                                                    |
| `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md` | sincronização documental                                                                      |
| `.adrs/0015-request-handler-1-1.md`, `.adrs/README.md`         | formalização do padrão                                                                        |

### 4.2 Fora do escopo

| Item                                                         | Motivo                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `apps/api/src/modules/shared/**`                             | Transversal; isento pela auditoria e pela skill.               |
| `apps/api/src/test/fakes/**`                                 | Infraestrutura de teste; isenta de camadas.                    |
| `apps/web/**`                                                | A refatoração é exclusiva da API; nenhum contrato do web muda. |
| `CreateSessionUseCase` / `ValidateSessionUseCase`            | Serviços internos da aplicação, permitidos pelo contrato 3.    |
| Mover rate limiters para `interface/rate-limiters/`          | Não é achado da auditoria; evitar churn sem requisito.         |
| Trocar rate limit em memória por store compartilhado         | Follow-up documentado em `QA.md`; mudaria infraestrutura.      |
| Adicionar sign-out/refresh no web                            | Feature fora da refatoração.                                   |
| Alterar mensagens, status, cookies ou qualquer regra de auth | Proibido pelo contrato 8.                                      |
| Renomear `hello.integration.spec.ts`                         | Não é achado; o nome já descreve o endpoint.                   |

### 4.3 Rastreabilidade dos achados

| ID         | Severidade | Passos que resolvem             |
| ---------- | ---------- | ------------------------------- |
| `AUTH-01`  | blocker    | 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| `AUTH-02`  | blocker    | 5, 8                            |
| `AUTH-03`  | minor      | 16                              |
| `AUTH-04`  | minor      | 17                              |
| `AUTH-05`  | minor      | 18, 19                          |
| `HELLO-01` | minor      | 3                               |

## 5. Confirmação da cobertura da auditoria

A auditoria foi conferida contra o código atual (`HEAD cb9dbd5`, cuja árvore é idêntica a `ca944a1`, base da auditoria):

| Slice     | Endpoints no código | Endpoints na auditoria | Cobertura de integração | Status |
| --------- | ------------------- | ---------------------- | ----------------------- | ------ |
| `auth`    | 7                   | 7                      | 7/7                     | ok     |
| `hello`   | 1                   | 1                      | 1/1                     | ok     |
| **Total** | **8**               | **8**                  | **8/8**                 | **ok** |

Rotas confirmadas: `POST /auth/sign-up`, `POST /auth/sign-in`, `POST /auth/sign-out`,
`POST /auth/confirm`, `POST /auth/forgot-password`, `POST /auth/reset-password`,
`GET /auth/me` e `GET /hello`, todas sob `/api/v1`.

**Condição de parada:** se durante a execução aparecer uma rota, método ou arquivo de endpoint que
não esteja no golden master da auditoria, **pare** e registre a divergência. Não reescreva a
auditoria nem amplie o escopo silenciosamente.

## 6. Decisão explícita sobre `AUTH-02` — `GetCurrentUserUseCase` fino

**Decisão:** criar `GetCurrentUserUseCase` em `application/` e injetá-lo no
`GetCurrentUserRequestHandler` (1:1). **Não** registrar exceção ao contrato 2.

**Contrato do use case:**

```ts
// apps/api/src/modules/auth/application/get-current-user.use-case.ts
import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../domain/auth-user";

/**
 * Intenção do endpoint `GET /auth/me`: devolver a pessoa autenticada.
 * O `SessionGuard` já resolveu e validou o `AuthUser`; este use case não
 * relê o repositório para não duplicar I/O nem alterar o comportamento.
 */
@Injectable()
export class GetCurrentUserUseCase {
  execute(user: AuthUser): AuthUser {
    return user;
  }
}
```

O handler recebe `@CurrentUser() user: AuthUser`, chama `execute(user)` e monta `{ user }`.

**Por que não reler `UsersRepositoryPort` no use case:** o `SessionGuard` já executa
`ValidateSessionUseCase`, que valida JWT + sessão + dono e carrega o usuário (`users.findById`). Uma
segunda leitura mudaria o número de consultas e poderia mudar o resultado observável (por exemplo,
usuário removido entre guard e handler: hoje `200` com o usuário já resolvido; com releitura,
`401`). O contrato 8 (comportamento preservado) vence a preferência por um use case "com lógica".

**Alternativas descartadas:**

| Alternativa                                 | Por que foi descartada                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Exceção documentada no ADR para `/me`       | O contrato 2 é não negociável e o pedido prefere o use case; a exceção deixaria um handler sem nenhum use case e enfraqueceria a regra. |
| Handler injetar `ValidateSessionUseCase`    | Duplicaria a validação já feita pelo guard, com I/O e comportamento diferentes.                                                         |
| `GetCurrentUserUseCase` reler o repositório | Muda I/O e o resultado em corridas; não preserva o comportamento atual.                                                                 |
| Manter `/me` no controller                  | Viola o contrato 4 (controller multi-endpoint) e o 2 (handler sem use case).                                                            |

O use case é deliberadamente fino, mas é o **ponto de extensão** para enriquecer o `/me` no futuro
(permissões, perfil, preferências) sem tocar no handler.

## 7. Abordagem técnica e ondas

### 7.1 Princípios de execução

- **Mover, não reescrever:** o corpo de cada método do controller é copiado para o handler; a ordem
  de rate limit, validação, chamada do use case e tradução de erro é preservada literalmente.
- **Sem rota duplicada:** ao criar um handler, o método correspondente sai do `AuthController` no
  **mesmo passo**. Registrar os dois ao mesmo tempo faria o Express usar a primeira rota e a
  integração não exercitaria o handler novo.
- **Controller só sai no fim:** o arquivo `auth.controller.ts` permanece (sem a rota já migrada) até
  o passo 14, quando não tiver mais nenhum endpoint.
- **Cada passo fecha verde:** teste direcionado + `types:check`; ao fim de cada onda, a suíte da API
  inteira.
- **Sem big bang:** nenhum passo mexe em regra de negócio, contrato HTTP ou web.

### 7.2 Mapa das ondas

| Onda  | Objetivo                                                           | Passos | Achados                         |
| ----- | ------------------------------------------------------------------ | ------ | ------------------------------- |
| **1** | Movimentos estruturais e piloto do padrão, sem mudar comportamento | 1–4    | `HELLO-01`                      |
| **2** | Use case por fluxo, incluindo o novo `/me`                         | 5–6    | `AUTH-02`                       |
| **3** | Request handlers 1:1 e ligação no módulo                           | 7–15   | `AUTH-01`, `AUTH-02`            |
| **4** | Limpeza, nomenclatura, testes e documentação                       | 16–25  | `AUTH-03`, `AUTH-04`, `AUTH-05` |

### 7.3 Ordem e justificativa

- `HELLO-01` foi antecipado para a Onda 1 como **piloto**: é uma slice independente, de um único
  endpoint e baixo risco. Ele valida o formato do handler, o registro no módulo e a execução da
  integração antes de tocar no `auth`.
- `AUTH-02` vem antes da Onda 3 porque o handler de `/me` precisa do use case já existente.
- Na Onda 3, a ordem é do menor para o maior risco: `sign-out` (sem corpo/rate limit), `/me`
  (somente guard), `sign-in`, `sign-up`, `forgot-password`, `reset-password`, `confirm`. Assim, os
  primeiros passos provam o padrão antes dos fluxos com status dinâmico e rate limit duplo.
- `AUTH-03` e `AUTH-04` ficam na Onda 4 porque não bloqueiam a divisão e são limpezas localizadas.
- `AUTH-05` e os specs de handler ficam depois da divisão para renomear/medir o desenho final.

## 8. Passos executáveis

### Portão 0 — Pré-condições (não conta como passo)

- [x] Confirmar `git status --short --branch`: apenas `.plans/refactor-api-all-audit.md` (e este
      plano) não versionados; nenhuma mudança alheia.
- [x] Confirmar branch `refactor/api-all` e HEAD `cb9dbd5` (merge de `origin/main`); confirmar que
      `git diff ca944a1..HEAD` está vazio (árvore idêntica à base da auditoria). **Não trocar de
      branch nem resetar.**
- [x] Rodar o baseline e registrar: `bun run lint`, `bun run types:check`, `bun run test`,
      `bun run build`.
- [x] Ferramenta de busca: os comandos com `rg` abaixo podem ser executados com `git grep` ou com
      a ferramenta de busca do ambiente; o critério é o resultado esperado (sem resultados,
      8 ocorrências, 7 portas).
- [x] Se qualquer gate falhar antes do passo 1, **parar**: não há como provar preservação sobre base
      vermelha.

### Onda 1 — Movimentos estruturais e piloto (passos 1–4)

- [x] **Passo 1 — [AUTH-01, preparação] Extrair `clientIp` do controller**
  - **Arquivos:** `apps/api/src/modules/auth/interface/auth.controller.ts`; criar
    `apps/api/src/modules/auth/interface/client-ip.ts`.
  - **Mudança:** mover a função `clientIp(request: Request): string` (linhas 126–128 do controller)
    para `client-ip.ts`, exportá-la e importá-la no controller. Nenhuma alteração de lógica.
  - **Verificação:** `bunx turbo types:check --filter=api --only` e
    `bunx turbo test --filter=api --only`.
  - **Conclusão:** o controller compila, a suíte da API continua verde e a função tem um único dono.

- [x] **Passo 2 — [AUTH-01, preparação] Extrair `readConfirmationToken` do controller**
  - **Arquivos:** `apps/api/src/modules/auth/interface/auth.controller.ts`; criar
    `apps/api/src/modules/auth/interface/read-confirmation-token.ts`.
  - **Mudança:** mover a função `readConfirmationToken(body: unknown): string | null`
    (linhas 130–144) para o novo arquivo, exportá-la e importá-la no controller. Nenhuma alteração
    de lógica.
  - **Verificação:** `bunx turbo types:check --filter=api --only` e
    `bunx turbo test --filter=api --only`.
  - **Conclusão:** a validação do token de confirmação continua idêntica e o helper está isolado
    para o handler de `confirm-account`.

- [x] **Passo 3 — [HELLO-01] Migrar `HelloController` para request handler**
  - **Arquivos:** criar
    `apps/api/src/modules/hello/interface/request-handlers/get-hello.request-handler.ts`; alterar
    `apps/api/src/modules/hello/hello.module.ts`; remover
    `apps/api/src/modules/hello/interface/hello.controller.ts`.
  - **Mudança:** criar `GetHelloRequestHandler` com `@Controller("hello")`, exatamente um método
    `@Get()` `handle(): HelloResponse`, injetando apenas `GetHelloUseCase`. Registrar
    `GetHelloRequestHandler` em `HelloModule.controllers` e apagar o controller antigo.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/hello/interface/hello.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** `GET /api/v1/hello` continua `200 { message: "Hello World" }`; CORS, 404 fora do
    prefixo e preflight permanecem verdes; não existe mais `hello.controller.ts`.

- [x] **Passo 4 — [contrato 5] Verificar portas, adaptadores e direção de dependência**
  - **Arquivos:** nenhum (verificação).
  - **Mudança:** confirmar que as 7 portas estão em `application/ports/`, os adaptadores em
    `infrastructure/`, e que não há import para fora:
    - `rg -n "from \"\\.\\./infrastructure|from \"\\.\\./interface" apps/api/src/modules/auth/application`
      → sem resultados.
    - `rg -n "from \"\\.\\./application" apps/api/src/modules/auth/domain` → sem resultados.
    - `rg -n "from \"\\.\\./interface" apps/api/src/modules/auth/infrastructure` → sem resultados.
    - `rg --files apps/api/src/modules/auth/application/ports` → 7 portas.
  - **Verificação:** os comandos acima; registrar a saída no relatório/QA.
  - **Conclusão:** nenhuma porta/adaptador precisa mudar de lugar; o contrato 5 já está satisfeito.

### Onda 2 — Use cases por fluxo (passos 5–6)

- [x] **Passo 5 — [AUTH-02] Criar `GetCurrentUserUseCase` e seu spec**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/application/get-current-user.use-case.ts` e
    `apps/api/src/modules/auth/application/get-current-user.use-case.spec.ts`; alterar
    `apps/api/src/modules/auth/auth.module.ts` para registrar o provider.
  - **Mudança:** implementar o use case conforme a §6 (recebe `AuthUser`, devolve o mesmo
    `AuthUser`, sem portas e sem releitura). O spec unitário deve provar que o use case devolve a
    mesma referência e não tem dependência de repositório.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/application/get-current-user.use-case.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** o provider é resolvível pelo Nest (a integração de `/me` continua verde) e o
    use case está coberto por unitário.

- [x] **Passo 6 — [contrato 3] Confirmar um use case por fluxo nos demais endpoints**
  - **Arquivos:** nenhum (verificação).
  - **Mudança:** confirmar que os 6 fluxos restantes já têm um use case de endpoint cada
    (`SignUpUseCase`, `SignInUseCase`, `SignOutUseCase`, `ConfirmAccountUseCase`,
    `RequestPasswordResetUseCase`, `ResetPasswordUseCase`) e que `CreateSessionUseCase` e
    `ValidateSessionUseCase` continuam como serviços internos, sem virar use case de endpoint.
  - **Verificação:** `rg -n "class .*UseCase" apps/api/src/modules/auth/application`; conferir a
    lista contra a auditoria.
  - **Conclusão:** nenhum use case precisa ser dividido; a decisão fica registrada no ADR 0015.

### Onda 3 — Request handlers 1:1 e ligação no módulo (passos 7–15)

**Template para cada handler de auth (aplicar em todos os passos 7–13):**

1. Criar `apps/api/src/modules/auth/interface/request-handlers/<flow>.request-handler.ts` com
   `@Controller("auth")`, exatamente **um** método decorado com rota e exatamente **um**
   `@Inject(*UseCase)`. Rate limiter, guard e `@CurrentUser` são colaboradores permitidos.
2. Mover o corpo do método correspondente de `auth.controller.ts` **sem reescrever regra**; copiar
   constantes, mensagens e tipos de resposta do endpoint para o arquivo do handler (não há
   importadores externos dessas constantes; verificado por grep).
3. Remover do `auth.controller.ts` o método, as constantes/imports que ficaram órfãos e a injeção
   correspondente. **Não deixar a rota nos dois lugares**: o Express usaria a primeira e a
   integração não exercitaria o handler novo.
4. Adicionar a classe ao array `controllers` de `auth.module.ts`, mantendo `AuthController` até o
   passo 14.
5. Rodar o spec de integração do endpoint e `bunx turbo types:check --filter=api --only`.
6. Ajustar os imports relativos: de `request-handlers/`, use `../../application/...`,
   `../../domain/...` e `../<colaborador-da-interface>`.

- [x] **Passo 7 — [AUTH-01] `SignOutRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/sign-out.request-handler.ts`; alterar
    `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("sign-out")`, `@UseGuards(SessionGuard)`,
    `@HttpCode(HttpStatus.NO_CONTENT)`; injetar `SignOutUseCase`; copiar `extractBearerToken` e o
    `if (token !== null)` sem alteração. Remover `signOut` e a injeção de `SignOutUseCase` do
    controller.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/sign-out.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** `204` sem corpo, `401` do guard e revogação imediata continuam iguais.

- [x] **Passo 8 — [AUTH-01, AUTH-02] `GetCurrentUserRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/get-current-user.request-handler.ts`;
    alterar `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Get("me")`, `@UseGuards(SessionGuard)`; injetar **apenas**
    `GetCurrentUserUseCase`; receber `@CurrentUser() user: AuthUser` e devolver
    `{ user: this.getCurrentUser.execute(user) }`. Remover `me`, `MeResponse` e a injeção/imports
    órfãos do controller.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/auth.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** `GET /auth/me` continua `200 { user }` com os mesmos 4 campos e o mesmo `401`
    fixo; o handler injeta um único use case.

- [x] **Passo 9 — [AUTH-01] `SignInRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/sign-in.request-handler.ts`; alterar
    `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("sign-in")`, `@HttpCode(HttpStatus.OK)`,
    `@Res({ passthrough: true })`; injetar `SignInUseCase` + `SignInRateLimiter`. Copiar
    `parseSignInInput`, o `400` sem `fieldErrors`, o rate limit **depois** da validação, o
    `Retry-After`, o helper `invalidCredentials` e os mapeamentos `401 INVALID_CREDENTIALS` /
    `403 EMAIL_NOT_CONFIRMED`. Remover `signIn`, `invalidCredentials` e as injeções do controller.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/sign-in.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** a ordem validação → rate limit → use case e todos os status/corpos continuam
    iguais.

- [x] **Passo 10 — [AUTH-01] `SignUpRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/sign-up.request-handler.ts`; alterar
    `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("sign-up")`, sem `@HttpCode`, `@Res({ passthrough: true })`; injetar
    `SignUpUseCase` + `SignUpRateLimiter`. Copiar o rate limit **antes** da validação, a validação
    com `fieldErrors`, o `response.status(result.created ? 201 : 200)`, o corpo com `user` só no
    `201` e os mapeamentos `409 EMAIL_ALREADY_CONFIRMED` / `503 CONFIRMATION_EMAIL_FAILED`.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/sign-up.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** o status dinâmico `201/200` e a presença condicional de `user` continuam
    idênticos.

- [x] **Passo 11 — [AUTH-01] `RequestPasswordResetRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/request-password-reset.request-handler.ts`;
    alterar `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("forgot-password")`, `@HttpCode(HttpStatus.OK)`,
    `@Res({ passthrough: true })`; injetar `RequestPasswordResetUseCase` +
    `ForgotPasswordRateLimiter`. Copiar o limite por `ip:` **antes** da validação, a validação com
    `fieldErrors.email`, o limite por `email:` **depois** da validação e o `200` genérico.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/forgot-password.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** a dupla chave do rate limit, a ordem e a resposta genérica continuam iguais.

- [x] **Passo 12 — [AUTH-01] `ResetPasswordRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/reset-password.request-handler.ts`;
    alterar `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("reset-password")`, `@HttpCode(HttpStatus.OK)`,
    `@Res({ passthrough: true })`; injetar `ResetPasswordUseCase` + `ResetPasswordRateLimiter`.
    Copiar o rate limit **antes** da validação, a validação de senha/confirmação com precedência
    sobre o token, o mapeamento `400 INVALID_RESET_TOKEN` e o `200` com a mensagem de sucesso.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/reset-password.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** `VALIDATION_ERROR` continua vencendo `INVALID_RESET_TOKEN` e o token não é
    consumido em erro de senha.

- [x] **Passo 13 — [AUTH-01] `ConfirmAccountRequestHandler`**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/confirm-account.request-handler.ts`;
    alterar `auth.controller.ts` e `auth.module.ts`.
  - **Mudança:** `@Post("confirm")`, `@HttpCode(HttpStatus.OK)`,
    `@Res({ passthrough: true })`; injetar `ConfirmAccountUseCase` +
    `ConfirmationRateLimiter`. Copiar o rate limit **antes** da leitura do token,
    `readConfirmationToken`, o `400 INVALID_CONFIRMATION_TOKEN` de token ausente e os mapeamentos
    `400 INVALID_CONFIRMATION_TOKEN` / `409 ACCOUNT_ALREADY_CONFIRMED`.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/confirm.integration.spec.ts`
    e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** a ordem rate limit → token → use case e todos os corpos continuam iguais.

- [x] **Passo 14 — [AUTH-01] Remover o `AuthController` vazio**
  - **Arquivos:** remover `apps/api/src/modules/auth/interface/auth.controller.ts`; alterar
    `apps/api/src/modules/auth/auth.module.ts`.
  - **Mudança:** apagar o controller (que já não tem nenhum endpoint) e remover seu import e sua
    entrada do array `controllers`. O array final tem os 7 handlers.
  - **Verificação:** `rg -n "AuthController|auth\\.controller" apps/api` → sem resultados;
    `bunx turbo test --filter=api --only` e `bunx turbo types:check --filter=api --only`.
  - **Conclusão:** não há `*.controller.ts` em `auth`; a suíte inteira continua verde.

- [x] **Passo 15 — [AUTH-01, contrato 4] Inventariar rotas e relação 1:1**
  - **Arquivos:** nenhum (verificação).
  - **Mudança:** conferir que existem 7 handlers de auth + 1 de hello, cada um com exatamente um
    decorator de rota e exatamente um `@Inject(*UseCase)`.
  - **Verificação:**
    - `rg --files apps/api/src/modules/auth apps/api/src/modules/hello | rg "\\.controller\\.ts$"`
      → sem resultados.
    - `rg -n "@(Get|Post|Put|Patch|Delete)\\(" apps/api/src/modules/auth/interface/request-handlers apps/api/src/modules/hello/interface/request-handlers`
      → 8 ocorrências (7 + 1).
    - `rg -n "@Inject\\([A-Za-z]+UseCase\\)" apps/api/src/modules/auth/interface/request-handlers apps/api/src/modules/hello/interface/request-handlers`
      → 8 ocorrências (uma por handler).
  - **Conclusão:** o contrato 1/2/4 está comprovado por inspeção e a suíte da API está verde.

### Onda 4 — Limpeza, nomenclatura, testes e documentação (passos 16–25)

- [x] **Passo 16 — [AUTH-03] Reduzir os exports de `AuthModule` ao contrato público real**
  - **Arquivos:** `apps/api/src/modules/auth/auth.module.ts`.
  - **Mudança:** manter **apenas** `SessionTokenPort` em `exports` e remover os outros 9
    (`CreateSessionUseCase`, `SignUpUseCase`, `SignUpRateLimiter`, `ConfirmAccountUseCase`,
    `ConfirmationRateLimiter`, `SignInUseCase`, `SignInRateLimiter`, `ValidateSessionUseCase`,
    `JoseSessionTokenAdapter`). Adicionar um comentário curto explicando que
    `SessionTokenPort` é exportado para os testes de integração que assinam JWT via
    `moduleRef.get(SessionTokenPort)`.
  - **Racional:** a auditoria considerou apenas importadores de produção; os specs
    `auth.integration.spec.ts`, `sign-out.integration.spec.ts`,
    `confirm.integration.spec.ts` e `sign-in.integration.spec.ts` usam
    `moduleRef.get(SessionTokenPort)` e dependem desse export. Removê-lo quebraria os testes sem
    necessidade. O contrato público do módulo passa a ser explícito e mínimo.
  - **Verificação:** `bunx turbo test --filter=api --only` e
    `rg -n "exports:" apps/api/src/modules/auth/auth.module.ts`.
  - **Conclusão:** a suíte continua verde e o módulo exporta somente o token de sessão.
  - **Se falhar:** se algum teste precisar de outro export, **não** enfraqueça o teste; pare,
    registre a dependência e reavalie o contrato público.

- [x] **Passo 17 — [AUTH-04] Fazer `ForgotPasswordRateLimiter` estender `SlidingWindowRateLimiter`**
  - **Arquivos:** `apps/api/src/modules/auth/interface/forgot-password-rate-limiter.ts`.
  - **Mudança:** substituir a implementação duplicada por herança, preservando `@Injectable`, as
    duas injeções e o JSDoc que explica as chaves `ip:`/`email:`:

    ```ts
    import { Inject, Injectable } from "@nestjs/common";

    import {
      FORGOT_PASSWORD_RATE_LIMIT_MAX,
      FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
    } from "../auth.tokens";

    import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

    @Injectable()
    export class ForgotPasswordRateLimiter extends SlidingWindowRateLimiter {
      constructor(
        @Inject(FORGOT_PASSWORD_RATE_LIMIT_MAX) max: number,
        @Inject(FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS)
        windowSeconds: number,
      ) {
        super(max, windowSeconds);
      }
    }
    ```

    Remover `RateLimitDecision`, `MAX_TRACKED_KEYS`, `attempts`, `consume`, `reset` e `prune`
    duplicados. A base tem algoritmo idêntico (janela deslizante, prune, `reset`).

  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/forgot-password-rate-limiter.spec.ts src/modules/auth/interface/forgot-password.integration.spec.ts`
    e `bunx turbo test --filter=api --only`.
  - **Conclusão:** os limites `ip:`/`email:` continuam com o mesmo comportamento e a suíte verde.

- [x] **Passo 18 — [AUTH-05] Renomear o spec de `/me`**
  - **Arquivos:** `apps/api/src/modules/auth/interface/auth.integration.spec.ts` →
    `apps/api/src/modules/auth/interface/get-current-user.integration.spec.ts`.
  - **Mudança:** `git mv` (sem alterar o conteúdo) para alinhar o nome ao fluxo/use case.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/get-current-user.integration.spec.ts`
    e `bunx turbo test --filter=api --only`; conferir que a contagem de testes não caiu.
  - **Conclusão:** o arquivo é descoberto pelo Vitest, o teste continua verde e nenhum caso foi
    removido.

- [x] **Passo 19 — [AUTH-05] Renomear o spec de confirmação**
  - **Arquivos:** `apps/api/src/modules/auth/interface/confirm.integration.spec.ts` →
    `apps/api/src/modules/auth/interface/confirm-account.integration.spec.ts`.
  - **Mudança:** `git mv` (sem alterar o conteúdo) para alinhar ao `ConfirmAccountUseCase`.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/confirm-account.integration.spec.ts`
    e `bunx turbo test --filter=api --only`; contagem de testes inalterada em relação ao passo 18.
  - **Conclusão:** o arquivo é descoberto, o teste continua verde e nenhum caso foi removido.

- [x] **Passo 20 — [Testes] Specs unitários dos handlers protegidos**
  - **Arquivos:** criar
    `apps/api/src/modules/auth/interface/request-handlers/sign-out.request-handler.spec.ts` e
    `apps/api/src/modules/auth/interface/request-handlers/get-current-user.request-handler.spec.ts`.
  - **Mudança:** testar a orquestração dos handlers com colaboradores mockados:
    - `sign-out`: token válido → `SignOutUseCase.execute(token)` chamado uma vez e `void`;
      `Authorization` ausente/malformado → use case **não** chamado (o guard já rejeitou em
      produção); nenhuma resposta/cookie criado.
    - `get-current-user`: `GetCurrentUserUseCase.execute` chamado uma vez com o mesmo `AuthUser`;
      retorno `{ user }` idêntico.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/request-handlers/sign-out.request-handler.spec.ts src/modules/auth/interface/request-handlers/get-current-user.request-handler.spec.ts`.
  - **Conclusão:** os dois handlers protegidos têm unitário focado em delegação/retorno; a
    integração continua sendo a prova do HTTP/guard.

- [x] **Passo 21 — [Testes] Specs unitários dos handlers públicos**
  - **Arquivos:** criar, em `apps/api/src/modules/auth/interface/request-handlers/`:
    `sign-up.request-handler.spec.ts`, `sign-in.request-handler.spec.ts`,
    `request-password-reset.request-handler.spec.ts`, `reset-password.request-handler.spec.ts`,
    `confirm-account.request-handler.spec.ts`.
  - **Mudança:** cobrir os casos da matriz da §10.1, com `vi.fn()` para use case/rate limiter e
    `Request`/`Response` falsos tipados com `unknown` + cast (sem `any`). Em especial:
    - `sign-up`: `201` com `user` vs `200` sem `user`; `429` antes da validação; `400` com
      `fieldErrors`; `409`/`503`.
    - `sign-in`: `400` antes do limiter; `429` + `Retry-After`; `401`/`403`; sucesso.
    - `forgot-password`: `429` de IP antes da validação; `400`; `429` de e-mail depois; `200`
      genérico.
    - `reset-password`: `429`; `400` de validação antes do token; `400 INVALID_RESET_TOKEN`; `200`.
    - `confirm-account`: `429` antes do token; `400` de token ausente; `400` inválido; `409`;
      `200`.
  - **Verificação:** `bun --cwd=apps/api run test src/modules/auth/interface/request-handlers`
    e `bunx turbo test --filter=api --only`.
  - **Conclusão:** a ordem rate limit/validação e a tradução de erros ficam travadas em unitário,
    sem substituir a integração.

- [x] **Passo 22 — [Documentação] Criar o ADR 0015 e registrá-lo**
  - **Arquivos:** criar `.adrs/0015-request-handler-1-1.md`; alterar `.adrs/README.md` e
    `.docs/ARCHITECTURE.md` (§6, tabela de decisões).
  - **Mudança:** ADR com contexto (controller de 7 endpoints + `/me` sem use case), decisão
    (handler 1:1, um use case de endpoint, prefixo compartilhado, serviços internos permitidos,
    `GetCurrentUserUseCase` fino sem releitura, erro traduzido na interface, controller removido só
    depois da integração verde), consequências e alternativas descartadas (manter controller,
    exceção para `/me`, releitura no use case). Adicionar a linha ao índice do `.adrs/README.md` e
    a linha correspondente na tabela de decisões da `ARCHITECTURE.md`.
  - **Verificação:** conferir links relativos do ADR e a renderização do índice; `rg -n "0015" .adrs/README.md .docs/ARCHITECTURE.md`.
  - **Conclusão:** o padrão de request handler deixa de ser informal e fica referenciado pela
    arquitetura.

- [x] **Passo 23 — [Documentação] Atualizar `ARCHITECTURE.md` (estrutura e sign-out)**
  - **Arquivos:** `.docs/ARCHITECTURE.md`.
  - **Mudança:**
    - §4.2: trocar `interface/ # guard, controller, rate limiter, testes de integração` por
      `interface/ # request handlers (1 por endpoint), guard, rate limiter, testes de integração`;
      adicionar `request-handlers/` à árvore e citar `GetCurrentUserUseCase` em `application/`.
    - §4.4/§4.5: corrigir os dois pontos que dizem que "o endpoint de sign-out ainda não existe"
      (linhas ~211 e ~545): o sign-out existe em `POST /api/v1/auth/sign-out`, revoga a sessão
      atual e responde `204`; o JWT deixa de valer imediatamente.
    - §4.5: registrar que `GET /auth/me` é atendido por `GetCurrentUserRequestHandler` +
      `GetCurrentUserUseCase` e que o guard continua resolvendo o `AuthUser`.
    - §6: atualizar a linha "Arquitetura em camadas + vertical slices ✅ (`hello`)" para
      `✅ (auth, hello)` e adicionar a decisão de request handler 1:1 (ADR 0015).
    - Cabeçalho: atualizar a data para `2026-11-11`.
  - **Verificação:** `rg -n "sign-out ainda não existe" .docs/ARCHITECTURE.md` → sem resultados;
    conferir a árvore e os links.
  - **Conclusão:** a documentação reflete o código atual e não contradiz o ADR 0015.

- [x] **Passo 24 — [Documentação] Atualizar `DEVELOPMENT.md` e `QA.md`**
  - **Arquivos:** `.docs/DEVELOPMENT.md`, `.docs/QA.md`.
  - **Mudança:**
    - `DEVELOPMENT.md` §3/§3.1: registrar que cada endpoint tem `*RequestHandler` em
      `interface/request-handlers/` com um método de rota e um `*UseCase`; que
      `GetCurrentUserUseCase` é fino e recebe o `AuthUser` do guard sem reler o repositório; que
      `CreateSessionUseCase`/`ValidateSessionUseCase` são serviços internos; que a tradução de erro
      fica no handler; e que os testes de integração são nomeados pelo fluxo.
    - `QA.md` §5.2: adicionar o check de request handler 1:1 e de ausência de controller
      multi-endpoint no escopo.
    - `QA.md` §5.9: adicionar o caso de `POST /auth/sign-out` com sessão ativa → `204` sem corpo e
      JWT invalidado; sem token/inválido → `401` do contrato.
    - `QA.md` §10: corrigir a lacuna "Sem sign-out/refresh" para "Sem refresh de sessão; sign-out
      implementado em `POST /api/v1/auth/sign-out`".
  - **Verificação:** conferir links internos e comandos citados; `rg -n "Sem sign-out" .docs/QA.md`
    → sem resultados; `rg -n "controller multi-endpoint" .docs/QA.md` → confirma o novo check;
    `rg -n "POST /api/v1/auth/sign-out" .docs/QA.md` → confirma o caso de sign-out.
  - **Conclusão:** os três documentos descrevem o mesmo padrão e não há contradição sobre sign-out.

- [x] **Passo 25 — [Gate final] Rodar todos os gates e a reauditoria**
  - **Evidências (2026-11-11):** `lint`, `types:check`, `build` verdes; `test --force` verde com
    **343 testes / 52 arquivos** (baseline 313/44; +30 testes e +8 arquivos, todos de specs novos
    dos passos 5, 20 e 21). Reauditoria: 0 `*.controller.ts` no disco, 8 decorators de rota, 8
    `@Inject(*UseCase)`, 0 imports de `infrastructure`/`interface` em `application`, 0
    `any`/`@ts-ignore`/`eslint-disable`, `apps/web` e manifestos de dependência sem diff, sem
    referências a `AuthController` nem a "sem sign-out" na documentação.
  - **Arquivos:** `.plans/refactor-api-all-plan.md` (marcar checkboxes e registrar evidências).
  - **Mudança:** executar, nesta ordem:
    1. `bun run lint`
    2. `bun run types:check`
    3. `bun run test`
    4. `bun run build`
  - **Reauditoria (comandos):**
    - `rg --files apps/api/src/modules/auth apps/api/src/modules/hello | rg "\\.controller\\.ts$"` → sem resultados.
    - `rg -n "@(Get|Post|Put|Patch|Delete)\\(" apps/api/src/modules/auth/interface/request-handlers apps/api/src/modules/hello/interface/request-handlers` → 8 ocorrências.
    - `rg -n "@Inject\\([A-Za-z]+UseCase\\)" apps/api/src/modules/auth/interface/request-handlers apps/api/src/modules/hello/interface/request-handlers` → 8 ocorrências.
    - `rg -n "from \"\\.\\./infrastructure|from \"\\.\\./interface" apps/api/src/modules/auth/application` → sem resultados.
    - `rg -n ":\\s*any\\b|<any>|\\bas any\\b|@ts-ignore|eslint-disable" apps/api/src/modules/auth apps/api/src/modules/hello` → sem resultados.
    - `git diff --name-only -- apps/web` → vazio.
    - `git diff -- package.json apps/api/package.json bun.lock` → vazio.
    - `rg -n "sign-out ainda não existe|Sem sign-out" .docs` → sem resultados.
  - **Contagem de testes:** registrar a contagem final e comparar com o baseline de **313 testes /
    44 arquivos**. O delta deve ser explicado apenas por specs novos (passos 5, 20, 21); renomes
    (passos 18, 19) não podem reduzir a contagem. Nenhum teste existente pode ser removido,
    marcado `skip`/`todo` ou ter asserção enfraquecida.
  - **Conclusão:** gates verdes, reauditoria sem blockers/majors/minors no escopo, documentação
    sincronizada. Entregar para o Agente 4 (QA) gerar `.plans/refactor-api-all-qa.md`.
  - **Não commitar** nesta fase; o commit é do Agente 5.

## 9. Checklist de contrato de comportamento

### 9.1 Contrato global (não pode mudar)

- [ ] Todas as rotas continuam sob `/api/v1`; caminhos fora do prefixo (incluindo `GET /`)
      respondem `404 { code: "NOT_FOUND", message: "Resource not found." }`.
- [ ] Erros seguem `{ code, message, fieldErrors? }`; 5xx não previstos viram
      `500 INTERNAL_ERROR` opaco.
- [ ] O `401` de sessão é sempre
      `{ code: "UNAUTHORIZED", message: "Your session is invalid or has expired. Sign in again." }`,
      sem detalhes internos.
- [ ] A API **não** define `Set-Cookie`; o cookie `session_token` continua sendo responsabilidade
      do web.
- [ ] `Retry-After` aparece **somente** em respostas `429`.
- [ ] Rate limiters continuam em memória, por processo, com as chaves e janelas atuais.
- [ ] Nenhuma rota, método, status, corpo, header, cookie, código de erro, mensagem, e-mail ou
      efeito colateral é renomeado/alterado.

### 9.2 Por endpoint

- [ ] **`POST /api/v1/auth/sign-up`**
  - **Guard/rate limit:** sem guard; `SignUpRateLimiter` (default 5/60 s por IP) consumido
    **antes** da validação; `429` + `Retry-After`.
  - **Sucesso:** `201` com `{ message, user }` quando cria a conta; `200` com `{ message }` quando
    reenvia confirmação; `message = "Check your email to confirm your account."`; status dinâmico
    via `@Res({ passthrough: true })` + `response.status`.
  - **Erros:** `400 VALIDATION_ERROR` + `fieldErrors` (5 campos); `409 EMAIL_ALREADY_CONFIRMED`
    (`"An account with this email already exists. Sign in instead."`);
    `503 CONFIRMATION_EMAIL_FAILED`
    (`"We could not send the confirmation email. Try again in a moment."`); `429`.
  - **Headers/cookies:** sem `Set-Cookie`; `Retry-After` só no `429`.
  - **Efeitos:** cria usuário não confirmado + token, ou reemite token de conta não confirmada;
    envia e-mail "Confirm your account"; logs sem PII.

- [ ] **`POST /api/v1/auth/sign-in`**
  - **Guard/rate limit:** sem guard; `SignInRateLimiter` (default 5/60 s por
    `IP|e-mail normalizado`) consumido **depois** da validação; `429` + `Retry-After`.
  - **Sucesso:** `200` com `{ accessToken, tokenType: "Bearer", expiresIn, user }`;
    `expiresIn = SESSION_TTL_SECONDS`.
  - **Erros:** `400 VALIDATION_ERROR` sem `fieldErrors`; `401 INVALID_CREDENTIALS`
    (`"Invalid email or password."`); `403 EMAIL_NOT_CONFIRMED`
    (`"Please confirm your email before signing in."`); `429`.
  - **Headers/cookies:** sem `Set-Cookie`; `Retry-After` só no `429`.
  - **Efeitos:** verifica a senha antes do estado de confirmação; revoga sessões anteriores; cria
    sessão `sign_in`; envia "New session on your account"; logs sem PII.

- [ ] **`POST /api/v1/auth/sign-out`**
  - **Guard/rate limit:** `@UseGuards(SessionGuard)`; sem rate limit.
  - **Sucesso:** `204 No Content`, sem corpo.
  - **Erros:** `401 UNAUTHORIZED` do guard para token ausente/malformado/expirado/revogado.
  - **Headers/cookies:** sem corpo e sem `Set-Cookie`.
  - **Efeitos:** revoga a sessão atual; o JWT deixa de funcionar imediatamente.

- [ ] **`POST /api/v1/auth/confirm`**
  - **Guard/rate limit:** sem guard; `ConfirmationRateLimiter` (default 10/60 s por IP) consumido
    **antes** da leitura do token; `429` + `Retry-After`.
  - **Sucesso:** `200` com `{ accessToken, tokenType: "Bearer", expiresIn, user }`.
  - **Erros:** `400 INVALID_CONFIRMATION_TOKEN`
    (`"This confirmation link is invalid or has expired."`) para token ausente, desconhecido,
    expirado ou usado; `409 ACCOUNT_ALREADY_CONFIRMED`
    (`"This account is already confirmed. Sign in instead."`); `429`.
  - **Headers/cookies:** sem `Set-Cookie`; `Retry-After` só no `429`.
  - **Efeitos:** consome o token, confirma a conta, revoga sessão anterior, cria sessão
    `sign_up_confirmation` e envia o e-mail de nova sessão; logs sem PII.

- [ ] **`POST /api/v1/auth/forgot-password`**
  - **Guard/rate limit:** sem guard; `ForgotPasswordRateLimiter` (default 5/60 s) por `ip:`
    **antes** da validação e por `email:` **depois** da validação; `429` + `Retry-After`.
  - **Sucesso:** `200` com `{ message }` genérico
    `"If an account exists for this email, we sent a password reset link."`.
  - **Erros:** `400 VALIDATION_ERROR` + `fieldErrors.email`; `429`.
  - **Headers/cookies:** sem `Set-Cookie`; `Retry-After` só no `429`.
  - **Efeitos:** para conta existente, invalida token anterior, persiste só o hash e envia
    "Reset your password"; para conta inexistente, mesma resposta sem envio; logs sem PII.

- [ ] **`POST /api/v1/auth/reset-password`**
  - **Guard/rate limit:** sem guard; `ResetPasswordRateLimiter` (default 5/60 s por IP) consumido
    **antes** da validação; `429` + `Retry-After`.
  - **Sucesso:** `200` com `{ message }` =
    `"Your password has been updated. Sign in with your new password."`.
  - **Erros:** `400 VALIDATION_ERROR` + `fieldErrors` (`password`, `passwordConfirmation`) com
    precedência sobre token inválido; `400 INVALID_RESET_TOKEN`
    (`"This password reset link is invalid or has expired."`); `429`.
  - **Headers/cookies:** sem `Set-Cookie`; `Retry-After` só no `429`.
  - **Efeitos:** troca a senha, consome o token, revoga todas as sessões e envia
    "Your password has been changed"; falha de e-mail não desfaz a troca; logs sem PII.

- [ ] **`GET /api/v1/auth/me`**
  - **Guard/rate limit:** `@UseGuards(SessionGuard)`; sem rate limit.
  - **Sucesso:** `200` com `{ user }`, onde `user` tem `id`, `firstName`, `lastName`, `email`.
  - **Erros:** `401 UNAUTHORIZED` do contrato para qualquer falha de sessão.
  - **Headers/cookies:** sem `Set-Cookie`.
  - **Efeitos:** nenhum (leitura); o `AuthUser` continua vindo do guard, sem nova consulta no use
    case.

- [ ] **`GET /api/v1/hello`**
  - **Guard/rate limit:** sem guard; sem rate limit.
  - **Sucesso:** `200` com `{ message: "Hello World" }`.
  - **Erros:** nenhum erro de endpoint; `404` global fora de `/api/v1`.
  - **Headers/cookies:** JSON; CORS global; sem `Set-Cookie`.
  - **Efeitos:** nenhum.

### 9.3 Prova de preservação

- [ ] `git diff` mostra apenas movimentos/adições de interface, o novo use case, limpeza de exports,
      herança do limiter, renomes de specs, testes novos e documentação.
- [ ] Nenhuma asserção existente foi removida, enfraquecida, marcada `skip`/`todo` ou substituída
      por `expect` genérico.
- [ ] Os 8 specs de integração continuam executando os 8 endpoints; os dois renomeados mantêm o
      mesmo conteúdo.
- [ ] O comportamento observável é o da §9.2, comprovado pela suíte de integração e pelo QA manual.

## 10. Plano de testes

### 10.1 Unitários

| Alvo                                 | Casos mínimos                                                                                       | Passo |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ----- |
| `GetCurrentUserUseCase`              | devolve a mesma referência de `AuthUser`; não tem porta/repositório                                 | 5     |
| `SignOutRequestHandler`              | token válido → use case chamado uma vez; token ausente → use case não chamado                       | 20    |
| `GetCurrentUserRequestHandler`       | use case chamado uma vez com o usuário; retorno `{ user }`                                          | 20    |
| `SignUpRequestHandler`               | `201` com `user`; `200` sem `user`; `429` antes da validação; `400` com `fieldErrors`; `409`; `503` | 21    |
| `SignInRequestHandler`               | `400` antes do limiter; `429` + `Retry-After`; `401`; `403`; sucesso                                | 21    |
| `RequestPasswordResetRequestHandler` | `429` de IP antes da validação; `400`; `429` de e-mail; `200` genérico                              | 21    |
| `ResetPasswordRequestHandler`        | `429`; `400` de validação antes do token; `400 INVALID_RESET_TOKEN`; `200`                          | 21    |
| `ConfirmAccountRequestHandler`       | `429` antes do token; `400` de token ausente; `400` inválido; `409`; `200`                          | 21    |

Regras dos unitários:

- Testar **comportamento/orquestração**, não detalhes de implementação.
- Usar `vi.fn()` para use case e rate limiter; `Request`/`Response` falsos tipados com `unknown` +
  cast, nunca `any`.
- Não inicializar a aplicação Nest para unitários de handler; a integração cobre guard, pipes,
  serialização e rota.
- Não substituir nem remover asserções da integração.

### 10.2 Integração

- [ ] Manter os 8 specs existentes; renomear apenas os dois indicados (`AUTH-05`).
- [ ] Rodar a suíte da API após cada passo da Onda 3 e ao fim de cada onda:
      `bunx turbo test --filter=api --only`.
- [ ] Não alterar fixtures/fakes para "acomodar" a refatoração.
- [ ] Conferir que a contagem de testes não caiu; o delta positivo vem apenas dos specs novos.
- [ ] Verificar que cada endpoint continua coberto pelo spec do fluxo:
      `sign-up`, `sign-in`, `sign-out`, `confirm-account`, `forgot-password`, `reset-password`,
      `get-current-user`, `hello`.

### 10.3 Reauditoria

O Agente 4 deve reaplicar `.agents/skills/refactor-vertical-slices/references/audit-checklist.md`
(§4–§10) e registrar em `.plans/refactor-api-all-qa.md`:

- [ ] Nenhum `*.controller.ts` multi-endpoint em `auth`/`hello`.
- [ ] Cada handler tem exatamente um método de rota e um `*UseCase`.
- [ ] Portas em `application/ports/`; adaptadores em `infrastructure/`; direção de dependência
      preservada.
- [ ] Erros de domínio não viram HTTP fora da interface.
- [ ] Rotas/status/corpos/headers/cookies/rate limits/guards/erros/efeitos idênticos à auditoria.
- [ ] Nenhum `any`, `@ts-ignore`, `eslint-disable`, dependência nova, segredo ou artefato gerado.
- [ ] Comparação com a auditoria original: 2/2 blockers e 4/4 minors resolvidos; sem achado novo.

### 10.4 QA manual

Executar com a API local (`bun run dev`) e registrar no relatório. Os fluxos completos de
sign-up/sign-in/reset dependem de Supabase/Mailtrap; a prova principal deles é a integração com
fakes. Smoke mínimo:

| Ação                                                      | Esperado                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/v1/hello`                                       | `200 { "message": "Hello World" }`                                                                |
| `GET /api/v1/auth/me` sem `Authorization`                 | `401 { code: "UNAUTHORIZED", message: "Your session is invalid or has expired. Sign in again." }` |
| `POST /api/v1/auth/sign-out` sem `Authorization`          | `401` do contrato                                                                                 |
| `POST /api/v1/auth/sign-in` com `{}`                      | `400 { code: "VALIDATION_ERROR", ... }`                                                           |
| `POST /api/v1/auth/sign-up` com `{}`                      | `400 VALIDATION_ERROR` com `fieldErrors` dos 5 campos                                             |
| `POST /api/v1/auth/forgot-password` com e-mail inválido   | `400 VALIDATION_ERROR` com `fieldErrors.email`                                                    |
| `POST /api/v1/auth/reset-password` com senha fraca        | `400 VALIDATION_ERROR` (antes de olhar o token)                                                   |
| `POST /api/v1/auth/confirm` com `{}`                      | `400 INVALID_CONFIRMATION_TOKEN`                                                                  |
| `GET /`                                                   | `404 { code: "NOT_FOUND", message: "Resource not found." }`                                       |
| Repetir sign-up/confirm/forgot/reset/sign-in até o limite | `429` + `Retry-After`; sem detalhes internos                                                      |

`bun run test:e2e` **não** é executado: a mudança é exclusiva da API e não toca `apps/web`.

## 11. Riscos e mitigação

| Risco                                                               | Impacto                                                               | Mitigação                                                                                              | Detecção                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Rota duplicada ao registrar handler e manter o método no controller | Express usa a primeira rota; a integração não exercita o handler novo | Remover o método do controller no mesmo passo da criação do handler; conferir o inventário do passo 15 | Spec do endpoint + contagem de decorators |
| Ordem rate limit → validação → use case alterada                    | Muda `429` vs `400`, consome token indevidamente                      | Copiar o corpo do método literalmente; unitários dos handlers travam a ordem                           | Specs de integração + unitários           |
| Status dinâmico `201/200` do sign-up fixado por `@HttpCode`         | Contrato quebrado                                                     | Manter `@Res({ passthrough: true })` e `response.status(...)`                                          | `sign-up.integration.spec.ts`             |
| `Retry-After` perdido                                               | `429` sem header                                                      | Manter `response.setHeader` antes do `throw`                                                           | Specs que checam o header                 |
| Mensagens/códigos de erro alterados                                 | Contrato quebrado                                                     | Copiar constantes byte a byte; não "melhorar" textos                                                   | Specs de integração                       |
| `GetCurrentUserUseCase` reler o repositório                         | I/O extra e mudança em corrida                                        | Use case recebe o `AuthUser` do guard e devolve o mesmo; unitário prova a identidade                   | `auth.integration.spec.ts` (401/200)      |
| Remover exports quebrar testes                                      | Suíte vermelha                                                        | Manter `SessionTokenPort` exportado e documentar o contrato; rodar a suíte completa                    | `bunx turbo test --filter=api --only`     |
| Herança do `ForgotPasswordRateLimiter` divergir da base             | Limites diferentes                                                    | Base tem algoritmo idêntico; unitário do limiter + integração                                          | `forgot-password-rate-limiter.spec.ts`    |
| DI do Nest não resolver handler/provider                            | API não sobe                                                          | Registrar handlers/providers no módulo; integração sobe o `AppModule`                                  | Testes de integração                      |
| Renomear specs e perder casos                                       | Cobertura cai                                                         | `git mv` sem alterar conteúdo; conferir contagem                                                       | Contagem de testes + Vitest               |
| Testes enfraquecidos para "passar"                                  | Perde a prova de preservação                                          | Proibido remover asserção/`skip`; QA reaudita o diff                                                   | Reauditoria do Agente 4                   |
| Documentação divergir do código                                     | Confusão e regressão de entendimento                                  | Atualizar docs no mesmo passo; buscar "sign-out ainda não existe"/"Sem sign-out"                       | `rg` no passo 25                          |

## 12. Condições de parada

Pare imediatamente e reporte se:

1. O baseline (`lint`, `types:check`, `test`, `build`) não estiver verde antes do passo 1.
2. Aparecer endpoint/rota fora do golden master da auditoria (8 endpoints).
3. Um teste de integração falhar por comportamento diferente do documentado — **não** ajuste o
   teste para aceitar a mudança.
4. For necessário adicionar dependência, usar `any`, `@ts-ignore` ou `eslint-disable`.
5. O Nest não conseguir resolver um handler/provider sem mudar comportamento.
6. A remoção dos exports exigir alterar testes além de manter `SessionTokenPort` (reavaliar o
   contrato público, não enfraquecer teste).
7. Houver mudança inesperada em `apps/web`, `packages/**`, `modules/shared` ou arquivos gerados.
8. O `git status` mostrar mudanças alheias ao escopo.
9. A documentação revelar uma regra de negócio nova ou uma divergência que exija mudança de
   comportamento (ex.: sign-out com semântica diferente da documentada).

## 13. Documentação

| Documento                           | Mudança                                                                                                                        | Passo  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `.adrs/0015-request-handler-1-1.md` | Novo ADR formalizando handler 1:1, use case por fluxo e a decisão do `/me`                                                     | 22     |
| `.adrs/README.md`                   | Linha do ADR 0015 no índice                                                                                                    | 22     |
| `.docs/ARCHITECTURE.md`             | Árvore da §4.2, nota de handlers/`GetCurrentUserUseCase`, correção do sign-out (§4.4/§4.5 e §5), tabela de decisões (§6), data | 22, 23 |
| `.docs/DEVELOPMENT.md`              | Convenções de `auth` (§3/§3.1): handler 1:1, use case fino, serviços internos, erros na interface, nomes de specs              | 24     |
| `.docs/QA.md`                       | Check de handler 1:1 (§5.2), sign-out (§5.9), correção da lacuna "Sem sign-out" (§10)                                          | 24     |
| `.plans/refactor-api-all-plan.md`   | Checkboxes e evidências da execução                                                                                            | 25     |

> O ADR 0004 (camadas + vertical slices) continua válido; o ADR 0015 o complementa com o contrato
> de entrada 1:1. Não é necessário substituir o 0004.

## 14. Rollout e rollback

### 14.1 Branch e base

- Trabalhar **somente** em `refactor/api-all`; não trocar de branch.
- Base da refatoração: `ca944a1` (auditoria). O HEAD atual é `cb9dbd5`, um merge de `origin/main`
  com árvore idêntica; não é necessário resetar. O PR deve usar `feat/observability-dashboard` como
  base; se o orquestrador decidir `main`, registrar a decisão — não trocar em silêncio.

### 14.2 Commits

Commits pequenos, Conventional Commits, em inglês, com o trailer
`Co-authored-by: OpenCode Agent <noreply@opencode.ai>`. Sugestão mínima por onda:

1. `refactor(auth): extract request handler collaborators` (Onda 1 + piloto hello)
2. `refactor(auth): add get current user use case` (Onda 2)
3. `refactor(auth): split auth controller into request handlers` (Onda 3)
4. `refactor(auth): trim module exports and deduplicate rate limiter` (Onda 4, passos 16–17)
5. `test(auth): cover request handlers` (Onda 4, passos 18–21)
6. `docs(api): document request handler pattern` (Onda 4, passos 22–24)

Incluir os artefatos `.plans/refactor-api-all-audit.md`, `.plans/refactor-api-all-plan.md` e, ao
final, `.plans/refactor-api-all-qa.md`. Não commitar `.env`, artefatos de build, `dist`, `coverage`
ou mudanças do web.

### 14.3 PR

- Head: `refactor/api-all`.
- Base: `feat/observability-dashboard` (ver §14.1).
- Título: `refactor(api): align vertical slices with request handler pattern`.
- Corpo em `.plans/refactor-api-all-pr.md`, com resumo, achados resolvidos (`AUTH-01`…`AUTH-05`,
  `HELLO-01`), mudanças por camada, evidência de preservação, gates, riscos/follow-ups e links dos
  artefatos.
- O PR é aberto pelo Agente 6; **não** fazer merge.

### 14.4 Rollback

- Cada onda/commit fecha verde e é independente; o rollback é `git revert <hash>` do commit da
  onda, sem reescrever histórico e sem `push --force`.
- Se a Onda 3 regredir, o revert restaura o `AuthController` e remove os handlers do módulo no
  mesmo commit; a suíte de integração volta ao estado anterior.
- Se apenas a documentação estiver errada, reverter o commit de docs não afeta runtime.
- Não há migração de banco, mudança de env ou de contrato público; o rollback é somente de código.
- Após deploy, monitorar taxas de `5xx`, `401` e `429` e latência de auth; se houver anomalia,
  reverter a onda correspondente e abrir investigação.

## 15. Definition of Done

- [ ] Plano atualizado e checkboxes marcados.
- [ ] `bun run lint` verde.
- [ ] `bun run types:check` verde.
- [ ] `bun run test` verde, sem teste removido/enfraquecido.
- [ ] `bun run build` verde.
- [ ] Reauditoria sem blockers/majors/minors no escopo.
- [ ] Documentação e ADR atualizados.
- [ ] Sem segredos, artefatos gerados ou mudanças fora do escopo.
- [ ] Commit Conventional Commits + push (Agente 5).
- [ ] PR aberto (Agente 6) com corpo completo.
- [ ] Relatório final do orquestrador em `.plans/refactor-api-all-report.md`.

## 16. Resultado esperado

Ao final, `auth` e `hello` terão **8 request handlers 1:1 com 8 use cases de endpoint**, nenhum
`*.controller.ts`, o `/me` com `GetCurrentUserUseCase` fino e comportamento idêntico, os 4 minors
resolvidos, a documentação sincronizada e o padrão formalizado no ADR 0015. Nenhuma rota, status,
corpo, header, cookie, rate limit, guard, erro, e-mail ou efeito colateral muda.

PLAN_RESULT: ok
ondas: 4 | passos: 25 | blockers: 2/2 cobertos | majors: 0/0 cobertos
artefato: .plans/refactor-api-all-plan.md
