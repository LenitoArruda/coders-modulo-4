# Padrão alvo — camadas, use case por fluxo e request handler 1:1

Este documento detalha **o que é uma slice conforme** e **como migrar** uma slice fora do
padrão. Use junto com `.docs/ARCHITECTURE.md` (§4), `.docs/DEVELOPMENT.md` (§2 e §3) e o
[ADR 0004](../../../../.adrs/0004-camadas-e-vertical-slices.md).

---

## 1. Direção das dependências

```text
interface ──► application ──► domain
                   ▲
             infrastructure (implementa portas)
```

Regra de ouro: **as setas apontam para dentro**. `infrastructure` implementa portas declaradas
em `application` (ou no domínio); nunca o contrário. `interface` só conhece `application`.

| Camada           | Pode importar                         | Nunca importa                                  |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| `domain`         | Só domínio (e tipos puros)            | `@nestjs/*`, HTTP, banco, SDK, `application`   |
| `application`    | `domain`, portas, tipos puros         | `infrastructure`, `interface`, `@Controller`   |
| `infrastructure` | `application` (portas), SDKs, drivers | `interface`, regra de negócio, `HttpException` |
| `interface`      | `application`, `domain`, `@nestjs/*`  | `infrastructure` (repositório/SDK) diretamente |

Exceção legítima: `shared` é transversal (config, logging, observabilidade, erros, guards
genéricos) e pode ser importado por qualquer camada de qualquer slice.

---

## 2. Árvore alvo de uma slice

```text
apps/api/src/modules/<slice>/
├── domain/
│   ├── <entity>.ts                     # entidade / value object / invariantes
│   ├── <flow>-input.ts                 # normalização e validação pura de entrada
│   └── <flow>.errors.ts                # erros de domínio (sem HTTP)
├── application/
│   ├── ports/
│   │   └── <resource>-repository.port.ts
│   ├── <flow>.use-case.ts              # um use case por fluxo de endpoint
│   ├── <flow>.use-case.spec.ts
│   └── <internal-service>.ts           # serviço interno compartilhado (opcional)
├── infrastructure/
│   ├── supabase-<resource>.repository.ts
│   └── <vendor>-<x>.adapter.ts
├── interface/
│   ├── request-handlers/
│   │   ├── <flow>.request-handler.ts   # exatamente um endpoint por classe
│   │   └── <flow>.request-handler.spec.ts
│   ├── <flow>.integration.spec.ts      # teste do endpoint via supertest
│   ├── guards/                         # quando existirem
│   ├── decorators/                     # quando existirem
│   ├── rate-limiters/                  # quando existirem
│   └── <flow>.errors.ts                # mapper domínio → contrato HTTP
└── <slice>.module.ts                   # liga portas, adaptadores e handlers
```

Nomes seguem `kebab-case`. Classes exportadas em `PascalCase`.

---

## 3. Contrato de request handler

Um **request handler** é a unidade de entrada da interface: uma classe por endpoint, com
exatamente um método de rota e exatamente um use case de entrada.

```ts
// interface/request-handlers/sign-in.request-handler.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";

import {
  SignInUseCase,
  type SignInResult,
} from "../../application/sign-in.use-case";
import { SignInRateLimiter } from "../rate-limiters/sign-in.rate-limiter";

@Controller("auth")
export class SignInRequestHandler {
  constructor(
    @Inject(SignInUseCase)
    private readonly signIn: SignInUseCase,
    @Inject(SignInRateLimiter)
    private readonly rateLimiter: SignInRateLimiter,
  ) {}

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResult> {
    this.rateLimiter.consume(/* ... */);
    const result = await this.signIn.execute(body);
    // cookies/headers definidos aqui, na interface
    return result;
  }
}
```

Regras do handler:

- Uma classe = um endpoint = um método com decorator de rota (`@Get`, `@Post`, `@Put`,
  `@Patch`, `@Delete`).
- Injeção: exatamente **um** `*UseCase`. Rate limiter, guard, logger, presenter e mapper de erro
  são colaboradores transversais permitidos e **não** contam como use case.
- Vários handlers podem reutilizar o mesmo prefixo `@Controller("auth")`. Prefixo compartilhado
  não é controller multi-endpoint.
- Toda tradução de erro de domínio → HTTP acontece aqui ou num mapper da interface. Nunca no use
  case.
- Decorators de contrato (`@HttpCode`, `@Header`, `@Res({ passthrough: true })`, cookies, guards)
  são preservados **exatamente** como estavam no controller original.

### Nomenclatura

| Item                  | Convenção                                    |
| --------------------- | -------------------------------------------- |
| Arquivo               | `<flow>.request-handler.ts`                  |
| Classe                | `<Flow>RequestHandler`                       |
| Método de rota        | `handle` (ou o nome de domínio já existente) |
| Prefixo compartilhado | `@Controller("<slice>")`                     |

`<flow>` descreve a **intenção do endpoint** (`sign-up`, `sign-in`, `confirm-account`,
`request-password-reset`, `reset-password`, `sign-out`), não a operação técnica.

---

## 4. Contrato de use case

- **Um use case por fluxo/intenção.** `SignUpUseCase`, `SignInUseCase`, `SignOutUseCase` são
  fluxos distintos; não existe um `AuthService` que faz tudo.
- O use case é `@Injectable()`, recebe portas por injeção e expõe um método público
  (`execute` é a convenção) com entrada normalizada e saída tipada.
- O use case **não** conhece `Request`, `Response`, status HTTP, `HttpException`, decorators ou
  `@Controller`.
- Um use case **pode** compor um **serviço interno da aplicação** (ex.: `CreateSessionUseCase`
  usado por sign-in e confirm-account) desde que esse serviço não seja um use case de endpoint.
- Um use case **não pode** chamar outro use case de endpoint. Se precisar, extraia o
  comportamento comum para um serviço interno ou porta.

```ts
// application/sign-out.use-case.ts
import { Inject, Injectable } from "@nestjs/common";

import { SessionsRepositoryPort } from "./ports/sessions-repository.port";

@Injectable()
export class SignOutUseCase {
  constructor(
    @Inject(SessionsRepositoryPort)
    private readonly sessions: SessionsRepositoryPort,
  ) {}

  async execute(sessionToken: string): Promise<void> {
    await this.sessions.revoke(sessionToken);
  }
}
```

---

## 5. Portas e adaptadores

- **Porta** = contrato na camada interna. Fica em `application/ports/` quando serve a um use
  case; fica no `domain/` quando a regra é do domínio.
- Portas são **classes abstratas** (convenção do projeto), não interfaces TypeScript soltas:

```ts
// application/ports/users-repository.port.ts
export abstract class UsersRepositoryPort {
  abstract findByEmail(email: string): Promise<UserAccount | null>;
  abstract create(input: CreateUserInput): Promise<UserAccount>;
}
```

- **Adaptador** = implementação concreta em `infrastructure/`, ligada no módulo:

```ts
// infrastructure/supabase-users.repository.ts
import { Injectable } from "@nestjs/common";

import { UsersRepositoryPort } from "../application/ports/users-repository.port";

@Injectable()
export class SupabaseUsersRepository extends UsersRepositoryPort {
  // implementação com o client Supabase
}
```

- O módulo decide qual adaptador satisfaz a porta. Trocar de fornecedor não deve tocar em
  `application`.

---

## 6. Erros: domínio → HTTP

```text
domain/<flow>.errors.ts       → erros puros (class InvalidCredentialsError extends Error)
interface/<flow>.errors.ts    → mapper para { status, code, message, fieldErrors? }
interface/request-handler.ts  → chama o mapper e lança a HttpException
```

- O domínio **nunca** importa `HttpException` nem conhece status.
- O contrato HTTP observável (`{ code, message, fieldErrors? }`) é preservado byte a byte.
- Se o projeto já tem um mapper global de erros, o handler pode delegar a ele; o importante é
  que a camada de domínio/aplicação permaneça pura.

---

## 7. Módulo da slice

O `<slice>.module.ts` é o único lugar que conhece concreto + abstrato ao mesmo tempo:

```ts
@Module({
  controllers: [
    SignUpRequestHandler,
    SignInRequestHandler,
    SignOutRequestHandler,
    // ... um por endpoint
  ],
  providers: [
    SignUpUseCase,
    SignInUseCase,
    SignOutUseCase,
    { provide: UsersRepositoryPort, useClass: SupabaseUsersRepository },
    { provide: SessionsRepositoryPort, useClass: SupabaseSessionsRepository },
  ],
})
export class AuthModule {}
```

Regras:

- Todo handler novo entra em `controllers` **antes** de o controller antigo ser removido.
- Toda porta usada por um use case tem um `provide` ligando ao adaptador.
- Guards e rate limiters entram em `providers` quando forem injetáveis.
- Não deixe provider órfão depois de remover o controller antigo.

---

## 8. Receita de migração (ordem segura)

Execute em ondas pequenas, com teste direcionado após cada passo.

### Onda 1 — Estrutura sem mudar comportamento

1. Crie as pastas alvo que faltarem (`application/ports`, `interface/request-handlers`).
2. Mova portas para `application/ports/` e adaptadores para `infrastructure/`, ajustando imports.
3. Confirme que `application` não importa `infrastructure`.
4. Rode o teste da slice e `types:check`.

### Onda 2 — Um use case por fluxo

5. Para cada fluxo atendido por um "service" genérico, extraia um `<flow>.use-case.ts` com a
   intenção do endpoint.
6. Mantenha colaboradores comuns como serviços internos da aplicação.
7. Rode os unitários dos use cases e o teste de integração da slice.

### Onda 3 — Request handlers

8. Para cada endpoint, crie `<flow>.request-handler.ts` movendo o corpo do método do controller
   **sem reescrever regra**.
9. Registre cada handler no módulo.
10. Rode a integração da slice inteira.
11. Só então remova o controller antigo e os providers órfãos.
12. Rode a integração de novo.

### Onda 4 — Limpeza e documentação

13. Corrija nomes, remova imports mortos, ajuste testes para o novo desenho.
14. Atualize `ARCHITECTURE.md`, `DEVELOPMENT.md`, `QA.md` e crie/atualize o ADR do padrão.
15. Rode todos os gates.

---

## 9. Exemplo antes/depois (auth)

### Antes (não conforme)

```text
interface/auth.controller.ts        # 7 endpoints em uma classe
application/sign-up.use-case.ts
application/sign-in.use-case.ts
application/sign-out.use-case.ts
application/confirm-account.use-case.ts
application/request-password-reset.use-case.ts
application/reset-password.use-case.ts
application/create-session.use-case.ts   # serviço interno (ok)
```

### Depois (conforme)

```text
interface/request-handlers/
├── sign-up.request-handler.ts
├── sign-in.request-handler.ts
├── sign-out.request-handler.ts
├── confirm-account.request-handler.ts
├── request-password-reset.request-handler.ts
├── reset-password.request-handler.ts
└── get-current-user.request-handler.ts
application/
├── sign-up.use-case.ts
├── sign-in.use-case.ts
├── sign-out.use-case.ts
├── confirm-account.use-case.ts
├── request-password-reset.use-case.ts
├── reset-password.use-case.ts
├── get-current-user.use-case.ts          # endpoint `me`; handler fino, mas 1:1
└── create-session.use-case.ts           # continua como serviço interno
```

> O endpoint `GET /auth/me` hoje devolve o usuário anexado pelo `SessionGuard` sem use case.
> Para cumprir o contrato 1:1, extraia um `GetCurrentUserUseCase` fino (ou registre a exceção
> explicitamente na auditoria e no ADR). O importante é que o handler injete **um** use case e
> que a decisão seja documentada, não implícita.

Cada handler importa **um** use case. `create-session.use-case.ts` não é endpoint: é colaborador
interno permitido.

---

## 10. Checklist rápido de conformidade

- [ ] Toda slice tem `domain`, `application`, `infrastructure` (se houver I/O) e `interface`.
- [ ] Nenhum `*.controller.ts` multi-endpoint na slice.
- [ ] Cada handler tem um endpoint e injeta um único `*UseCase`.
- [ ] Cada fluxo tem seu próprio `*UseCase`.
- [ ] `application` não importa `infrastructure`.
- [ ] `domain` não importa framework/SDK/HTTP.
- [ ] `interface` não acessa repositório/SDK direto.
- [ ] Portas em `application/ports/`; adaptadores em `infrastructure/`.
- [ ] Erros de domínio não viram HTTP fora da interface.
- [ ] Módulo liga portas e registra todos os handlers.
- [ ] Rotas, status, corpos, headers, cookies, rate limits, guards e erros preservados.
