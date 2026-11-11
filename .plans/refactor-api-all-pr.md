## Resumo

Refatoração das vertical slices da API para o padrão do projeto: camadas
`interface → application → domain` com `infrastructure` implementando portas, **um use case por
fluxo** e **um request handler por endpoint em relação 1:1 com o use case de entrada**.

Escopo: `api-all` (slices: `auth`, `hello`; `shared` fora do escopo).
Branch: `refactor/api-all`.
Artefatos: `.plans/refactor-api-all-audit.md`, `-plan.md`, `-qa.md`, `-report.md`.

## Achados resolvidos

| ID       | Slice | Severidade | Regra | Resolução                                                                                      |
| -------- | ----- | ---------- | ----- | ---------------------------------------------------------------------------------------------- |
| AUTH-01  | auth  | blocker    | R1/R4 | `auth.controller.ts` (7 endpoints) dividido em 7 request handlers; controller removido         |
| AUTH-02  | auth  | blocker    | R2    | `GetCurrentUserUseCase` fino criado; `/me` atendido por `GetCurrentUserRequestHandler`         |
| AUTH-03  | auth  | minor      | R5    | `exports` de `AuthModule` reduzidos de 10 para `SessionTokenPort`                              |
| AUTH-04  | auth  | minor      | R3    | `ForgotPasswordRateLimiter` estende `SlidingWindowRateLimiter` (sem lógica duplicada)          |
| AUTH-05  | auth  | minor      | —     | Specs de integração renomeados pelo fluxo (`get-current-user`, `confirm-account`), 100% iguais |
| HELLO-01 | hello | minor      | R4    | `hello.controller.ts` virou `GetHelloRequestHandler`                                           |

Achados adiados: nenhum.

## Mudanças por camada

### Interface

- `auth/interface/request-handlers/*.request-handler.ts` — 7 handlers (um por endpoint) e
  `hello/interface/request-handlers/get-hello.request-handler.ts`.
- Helpers extraídos: `client-ip.ts` e `read-confirmation-token.ts`.
- Guard, decorator e rate limiters preservados.

### Application

- `auth/application/get-current-user.use-case.ts` — recebe o `AuthUser` já resolvido pelo guard,
  sem reler o repositório (preserva I/O e resultado observável).
- `CreateSessionUseCase` e `ValidateSessionUseCase` mantidos como serviços internos.

### Domain

- Sem mudanças.

### Infrastructure

- Sem mudanças; portas e adaptadores já estavam conformes.

### Módulo

- `auth.module.ts` e `hello.module.ts` — handlers registrados; controllers removidos.

## Preservação de comportamento

- [x] Rotas e métodos idênticos.
- [x] Status codes idênticos.
- [x] Corpos de sucesso e erro idênticos (`{ code, message, fieldErrors? }`).
- [x] Headers e cookies idênticos (a API não define `Set-Cookie`; `Retry-After` só no `429`).
- [x] Guards e rate limits idênticos (ordem validação/limiter preservada por endpoint).
- [x] Efeitos colaterais idênticos (e-mail, sessão, logs).
- [x] Testes de integração existentes passam sem enfraquecimento (os dois renomeados são R100).

Evidências: `.plans/refactor-api-all-qa.md` (comparação método a método com o controller do HEAD).

## Gates executados

| Comando               | Resultado                                           |
| --------------------- | --------------------------------------------------- |
| `bun run lint`        | ✅                                                  |
| `bun run types:check` | ✅                                                  |
| `bun run test`        | ✅ API 343 testes / 52 arquivos (baseline 313 / 44) |
| `bun run build`       | ✅                                                  |
| `bun run test:e2e`    | n/a (sem mudança no web)                            |

Os +30 testes vêm exclusivamente de specs novos (use case de `/me` e 7 handlers).

## Riscos e follow-ups

- O fluxo feliz contra Supabase e Mailtrap reais não foi exercitado; só os fakes de integração.
- Rate limiters seguem em memória, por processo (follow-up já documentado em `QA.md`).
- `AuthModule` exporta só `SessionTokenPort`; um módulo futuro que precise de outro provider deve
  exportá-lo explicitamente.

## Documentação

- [x] `ARCHITECTURE.md` atualizado.
- [x] `DEVELOPMENT.md` atualizado.
- [x] `QA.md` atualizado (checklist de arquitetura e caso de sign-out).
- [x] ADR 0015 criado (request handler 1:1).

## Checklist

- [x] Branch dedicada `refactor/api-all`.
- [x] Baseline verde antes de começar.
- [x] Auditoria completa com contrato de comportamento.
- [x] Plano em ondas cobrindo todos os blockers/majors.
- [x] Nenhum `*.controller.ts` no escopo.
- [x] Cada endpoint com handler próprio e use case 1:1.
- [x] Dependências apontam para dentro.
- [x] Gates verdes.
- [x] Reauditoria sem blockers/majors.
- [x] Commit Conventional Commits com trailer.
