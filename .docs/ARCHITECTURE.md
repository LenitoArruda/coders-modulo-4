# ARCHITECTURE.md — Arquitetura

> **Status:** fundação + sessão + rotas + sign-up + confirmação + recuperação de senha implementados — produto não implementado · **Atualizado em:** 2026-11-10
> **Legenda:** ✅ implementado · 🧭 planejado · 🔍 decisão em aberto

Este documento descreve a estrutura do monorepo, a stack e a arquitetura alvo. Para regras de
engenharia, consulte [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 1. Visão geral

Monorepo **Turborepo** com **Bun**, contendo aplicações Next.js, uma API NestJS e pacotes
compartilhados. A fundação já entrega web, API e Supabase local; o produto será uma plataforma
de Experts (ver [BUSINESS.md](./BUSINESS.md)), com:

- **Web app** para interação com Experts e gestão de conectores.
- **API** dedicada para regras de negócio, ingestão e orquestração de agents.
- **Supabase/Postgres** como banco PostgreSQL e storage; a **autenticação é própria da API**
  (JWT emitido pela API; sem Supabase Auth).
- **Conectores externos** para trazer dados de Notion, Google Drive, Jira, PDF etc.

---

## 2. Estrutura atual

```text
.
├── apps/
│   ├── web/                     # Next.js — porta 3000
│   ├── docs/                    # Next.js — porta 3001 (starter, ainda não customizado)
│   └── api/                     # NestJS — porta 3333
├── packages/
│   ├── ui/                      # Tailwind/shadcn, tokens e componentes compartilhados
│   ├── eslint-config/           # Configurações ESLint compartilhadas
│   └── typescript-config/       # tsconfig base/nextjs/react-library
├── scripts/
│   └── infra.mjs                # Orquestra Compose (LGTM) + Supabase CLI
├── supabase/
│   ├── config.toml
│   └── migrations/
├── docker-compose.yml           # LGTM: Grafana + OTel Collector + Loki/Tempo/Prometheus
├── .plans/                      # Planos de tarefas (<numero>-<slug>-plan.md)
├── .specs/                      # Specs de feature (<numero>-<slug>.md)
├── .docs/                       # Documentação do projeto
├── .adrs/                       # Architecture Decision Records (ADRs)
├── turbo.json
├── package.json
└── bun.lock
```

| App/Pacote                   | Responsabilidade                        | Estado                                                                                                                                       |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                   | Interface principal do produto          | ✅ grupos `/auth/*` (público) e `/app/*` (privado), shell, guard, ponte de sessão, sign-up, confirmação e recuperação de senha na porta 3000 |
| `apps/docs`                  | Site de documentação                    | ✅ starter rodando na porta 3001; ainda não customizado                                                                                      |
| `apps/api`                   | API NestJS                              | ✅ hello em `/api/v1`, sessão JWT + cookie, sign-up, confirmação, forgot-password, contrato de erro, env, CORS, logs e OTel na porta 3333    |
| `packages/ui`                | Componentes compartilhados              | ✅ Tailwind, shadcn, tokens, `cn` e `Button`; legados `button`, `card`, `code` mantidos para `apps/docs`                                     |
| `packages/eslint-config`     | Lint compartilhado                      | ✅ `base`, `next-js`, `react-internal`; preset Babel resolvido                                                                               |
| `packages/typescript-config` | Tipagem compartilhada                   | ✅ `base`, `nextjs`, `react-library`                                                                                                         |
| `packages/shared`            | Contratos, tipos e utilidades cross-app | 🧭 não existe; aguarda contrato real                                                                                                         |

---

## 3. Stack

### 3.1 Implementada hoje

| Camada                      | Tecnologia                               | Versão           |
| --------------------------- | ---------------------------------------- | ---------------- |
| Monorepo                    | Turborepo                                | 2.11.10          |
| Package manager             | Bun                                      | 1.4.4            |
| Runtime                     | Node.js                                  | >= 24            |
| Linguagem                   | TypeScript (compilador nativo em Go)     | 7.0.2            |
| UI                          | Next.js (App Router) + React             | 16.3.8 / 19.2.8  |
| Estilo                      | Tailwind CSS                             | 4.3.4            |
| Design system               | shadcn/ui (configurado em `packages/ui`) | —                |
| API                         | NestJS                                   | 12.3.3           |
| JWT de sessão               | jose (HS256)                             | 6.2.17           |
| Acesso ao banco (servidor)  | `@supabase/supabase-js` (PostgREST)      | 2.119.0          |
| E-mail transacional (local) | nodemailer (SMTP do Mailpit)             | 10.4.0           |
| Hash de senha               | `node:crypto` scrypt (ADR 0014)          | —                |
| Banco local                 | Supabase CLI (PostgreSQL 15)             | 3.0.0            |
| Testes unitários/integração | Vitest + Supertest                       | 5.1.0 / 7.3.1    |
| Testes E2E                  | Playwright                               | 1.65.0           |
| Observabilidade             | OpenTelemetry SDK + Grafana LGTM         | 0.301.0 / 0.39.0 |
| Lint                        | ESLint                                   | 10.9.1           |
| Formatação                  | Prettier                                 | 3.9.6            |
| Hooks Git                   | Lefthook + lint-staged                   | 2.2.2 / 17.6.0   |
| Mensagens de commit         | Commitlint + Conventional Commits        | 21.2.4           |

### 3.2 Stack alvo (planejada ou em avaliação)

| Camada                   | Tecnologia        | Estado          |
| ------------------------ | ----------------- | --------------- |
| Datas                    | date-fns          | 🧭              |
| Tabelas                  | TanStack Table    | 🧭              |
| Gráficos                 | TanStack Charts   | 🧭              |
| Infra de produção        | Vercel + Supabase | 🧭              |
| Lint/format alternativos | OXLint + OXFmt    | 🔍 em avaliação |
| Contratos compartilhados | `packages/shared` | 🧭              |

> **Atenção:** a stack alvo **não está instalada**. Não importe date-fns, TanStack ou
> `packages/shared` sem antes adicioná-los ao `package.json` e atualizar esta tabela.

---

## 4. Arquitetura da API e do monorepo

### 4.1 Camadas

A API usa arquitetura em camadas, com dependências apontando para dentro:

```text
interface → application → domain
                 ↑
          infrastructure (implementa portas)
```

| Camada           | Responsabilidade                                       | Pode importar           |
| ---------------- | ------------------------------------------------------ | ----------------------- |
| `domain`         | Entidades, value objects, serviços e regras de domínio | Nada externo            |
| `application`    | Casos de uso, orquestração, portas/interfaces          | `domain`                |
| `infrastructure` | Repositórios, Supabase, filas, eventos, clientes HTTP  | `application`, `domain` |
| `interface`      | Controllers, DTOs, presenters, validação de entrada    | `application`           |

Regras:

- `domain` não conhece framework, banco, HTTP nem SDK.
- `application` não conhece implementações concretas; depende de portas.
- `infrastructure` implementa as portas definidas em `application`/`domain`.
- `interface` apenas valida, traduz e delega para casos de uso.

### 4.2 Vertical slices

A aplicação é fatiada por domínio, não por tipo técnico. Estrutura atual da API:

```text
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── domain/              # Session, SessionOrigin, AuthUser, SignUpInput, erros de auth
│   │   ├── application/         # Casos de uso (sessão, sign-up, confirmação, reset), templates, portas
│   │   ├── infrastructure/      # jose, scrypt, tokens opacos, repositórios Supabase, SMTP
│   │   └── interface/           # guard, controller, rate limiter, testes de integração
│   ├── hello/
│   │   ├── domain/
│   │   ├── application/
│   │   └── interface/
│   └── shared/                  # config, logging, observability, interface (contrato de erro)
├── test/fakes/                  # repositórios, e-mail e token em memória
├── app.module.ts
├── app-setup.ts
└── main.ts
```

Novos domínios (`experts`, `connectors`, `documents`, `conversations`) seguem o mesmo formato,
criando `infrastructure/` quando houver implementação concreta. `auth` é a referência de um slice
completo com as quatro camadas.

Regras:

- Cada módulo é dono do seu domínio e pode evoluir de forma independente.
- `modules/shared` contém apenas código transversal (erros, logging, config, tipos comuns).
- Não crie dependência circular entre módulos; comunicação via casos de uso ou eventos.

### 4.3 Estrutura do monorepo

```text
apps/
├── web/                         # Next.js — interface
├── docs/                        # Next.js — documentação (starter)
└── api/                         # NestJS — API
packages/
├── ui/                          # Design system compartilhado
├── shared/                      # 🧭 contratos, tipos e validações cross-app
├── eslint-config/
└── typescript-config/
```

Regras de dependência entre pacotes:

- `apps/web` pode importar `packages/ui` e `packages/shared`.
- `apps/api` pode importar `packages/shared`; **não** importa `packages/ui`.
- `packages/ui` não importa apps nem acessa API diretamente.
- `packages/shared` não depende de React, Next.js ou NestJS.

### 4.4 Modelo de dados de autenticação

O schema de auth é criado em `supabase/migrations/` e é de uso **exclusivo da API**; o navegador
não acessa essas tabelas (RLS habilitado, nenhuma policy para `anon`/`authenticated`). A API
opera com a credencial de servidor (`service_role`).

| Tabela        | Papel                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `users`       | Conta da pessoa: nome, e-mail normalizado e único, hash de senha e confirmação de e-mail         |
| `auth_tokens` | Tokens opacos de uso único para confirmação de e-mail e reset de senha, persistidos só como hash |
| `sessions`    | Registro server-side das sessões emitidas pela API, com expiração e revogação                    |

Regras centrais:

- `users.email` é armazenado em minúsculas; o índice único em `lower(email)` garante unicidade
  case-insensitive.
- `users.password_hash` armazena apenas o hash; a senha em claro nunca é persistida.
- `auth_tokens` usa `purpose` (`email_confirmation` ou `password_reset`), `expires_at` e
  `used_at`; apenas `token_hash` é persistido.
- `sessions` usa `origin` (`sign_up_confirmation` ou `sign_in`), `expires_at` e `revoked_at`;
  sessão ativa é a que tem `revoked_at` nulo e `expires_at` no futuro.
- `users`, `auth_tokens` e `sessions` usam UUID e `ON DELETE CASCADE` a partir do usuário.

O detalhamento de campos e constraints está em `.specs/001-auth-schema.md`. A fatia 002 entrega a
infraestrutura de sessão descrita na §4.5, a fatia 004 o sign-up e a fatia 005 a confirmação
descritos na §4.6, a fatia 006 o sign-in na §4.7 e a fatia 007 a solicitação de recuperação de senha na §4.8; os endpoints de
sign-out e a troca de senha em si entram nas fatias 007 e 008.

### 4.5 Sessão de autenticação

A autenticação é própria da API (ADR 0012) e a sessão combina **JWT + registro server-side**
(ADR 0013):

```text
web (server)                         api
  cookie session_token  ── Bearer ──►  SessionGuard
                                          │ valida assinatura/expiração (jose)
                                          └─► ValidateSessionUseCase
                                                │ sessão ativa? sub == user_id?
                                                └─► 200 { user }  |  401 UNAUTHORIZED
```

| Peça                                 | Responsabilidade                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `CreateSessionUseCase`               | Cria a sessão, revoga as anteriores, assina o JWT e dispara o e-mail de nova sessão |
| `ValidateSessionUseCase`             | Valida o JWT e confirma sessão ativa + dono antes de liberar a requisição           |
| `SessionTokenPort` / `jose`          | Assina e valida HS256 com `JWT_SECRET`; claims `sub`, `sid`, `iat`, `exp`           |
| `SessionsRepositoryPort` / Supabase  | Persiste, consulta e revoga sessões via PostgREST com `service_role`                |
| `UsersRepositoryPort` / Supabase     | Carrega os dados básicos da pessoa autenticada                                      |
| `EmailSenderPort` / nodemailer       | Envia o template en-US de nova sessão pelo SMTP local (Mailpit)                     |
| `SessionGuard` + `@CurrentUser()`    | Extrai o Bearer, aplica o contrato de 401 e injeta a pessoa na rota                 |
| `ErrorContractFilter` (`APP_FILTER`) | Serializa `{ code, message, fieldErrors? }` sem stack/SQL/detalhes internos         |

Regras:

- Toda requisição autenticada relê a sessão: JWT válido **não** basta (revogação é imediata).
- Sessão ativa = `revoked_at is null` e `expires_at > now`.
- Sessão única: a criação grava a nova sessão e revoga as demais ativas (`id != novo`). Sem
  transação no banco nesta fatia, essa é a ordem que preserva o invariante sob concorrência; a
  atomicidade estrita fica como follow-up no ADR 0013.
- A API só aceita `Authorization: Bearer`; o navegador nunca recebe o token (cookie `HttpOnly`
  lido pelo servidor do Next em `apps/web/lib/auth`).
- A API é versionada em `/api/v1`. Caminhos fora do prefixo respondem 404 com o mesmo contrato.
- O e-mail de nova sessão contém data/hora, alerta de senha e o link para
  `/auth/forgot-password`. Falha de e-mail não derruba a sessão já criada.

### 4.6 Sign-up e confirmação de e-mail

O sign-up é público e não cria sessão. O web envia o formulário por uma Server Action para
`POST /api/v1/auth/sign-up`; a API valida, persiste a conta como não confirmada, gera um token
opaco e dispara o e-mail com o link `/auth/confirm?token=...`.

A confirmação também é pública, consome esse token de uso único e cria a primeira sessão da
pessoa. Juntas, as duas rotas fecham a jornada iniciada em `/auth/sign-up`.

```text
/auth/sign-up (web) ── Server Action ──► POST /api/v1/auth/sign-up
                                             │ SignUpInput + rate limit por IP
                                             └─► SignUpUseCase
                                                   ├─ users (Postgres, service_role)
                                                   ├─ auth_tokens (apenas token_hash)
                                                   ├─ scrypt (password_hash)
                                                   └─ SMTP local (Mailpit)
```

| Peça                                  | Responsabilidade                                                          |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `SignUpInput`                         | Valida/normaliza os cinco campos e devolve mensagens en-US por campo      |
| `SignUpUseCase`                       | Cria conta não confirmada, reenvia confirmação ou sinaliza conflito       |
| `PasswordHasherPort` / scrypt         | Hash forte da senha, sem dependência nativa (ADR 0014)                    |
| `OpaqueTokenPort` / `node:crypto`     | 32 bytes aleatórios no link; SHA-256 em hex persistido em `token_hash`    |
| `AuthTokensRepositoryPort` / Supabase | Cria o token e invalida os pendentes do mesmo usuário/purpose             |
| `UsersRepositoryPort` / Supabase      | Busca por e-mail normalizado e cria a conta com `email_confirmed_at` nulo |
| `confirmation-email` / nodemailer     | Template en-US "Confirm your account" com expiração de 24 h               |
| `SignUpRateLimiter`                   | Janela deslizante em memória por IP, limites configuráveis por env        |

Regras:

- Respostas: `201` conta criada, `200` confirmação reenviada para e-mail não confirmado, `409`
  e-mail já confirmado, `400` validação com `fieldErrors` (uma mensagem por campo), `429` excesso
  de tentativas e `503` falha no envio do e-mail.
- O reenvio invalida o token pendente anterior e não cria usuário duplicado; falha de e-mail deixa
  a conta não confirmada reutilizável no próximo sign-up.
- Nenhum JWT, cookie ou registro em `sessions` é criado nesta rota.
- O rate limit é local ao processo (suficiente para "básico" nesta fatia); um store compartilhado
  fica como follow-up.
- O formulário usa `useActionState`, labels visíveis, `aria-describedby` por erro, resumo
  `role="alert"` e estado de sucesso que substitui o formulário. A UI é en-US e light-only.

#### Confirmação de e-mail

```text
/auth/confirm?token=... (web) ── Server Action ──► POST /api/v1/auth/confirm
                                                       │ rate limit por IP
                                                       └─► ConfirmAccountUseCase
                                                             ├─ auth_tokens.findByHash (SHA-256)
                                                             ├─ consume (used_at is null, atômico)
                                                             ├─ users.email_confirmed_at (conditional)
                                                             └─ CreateSessionUseCase (sign_up_confirmation)
                                                                  ├─ sessions (revoga as anteriores)
                                                                  ├─ JWT HS256
                                                                  └─ SMTP local (e-mail de nova sessão)
```

| Peça                                  | Responsabilidade                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `ConfirmAccountUseCase`               | Valida o token, confirma a conta, consome o token e cria a sessão                 |
| `AuthTokensRepositoryPort.findByHash` | Busca por `token_hash` sem revelar o token em claro                               |
| `AuthTokensRepositoryPort.consume`    | Marca `used_at` só se ainda estiver nulo e sinaliza quando perde a corrida        |
| `UsersRepositoryPort.confirmEmail`    | Preenche `email_confirmed_at` só se ainda estiver nulo                            |
| `CreateSessionUseCase`                | Reutilizado com `origin = sign_up_confirmation`; revoga sessões ativas anteriores |
| `ConfirmationRateLimiter`             | Janela deslizante por IP (`CONFIRMATION_RATE_LIMIT_*`), antes de validar o token  |

Regras:

- O web envia `{ token }` no corpo da requisição, nunca na URL da API. O token da URL do navegador
  é removido com `router.replace("/app")` depois do sucesso.
- O log de requests do `next dev` ignora `/auth/confirm` (`logging.incomingRequests.ignore` no
  `next.config.js`), para que o token da URL não apareça no terminal durante o desenvolvimento.
  Em produção o Next não registra URLs de requests de entrada.
- Respostas: `200` com `{ accessToken, tokenType: "Bearer", expiresIn, user }`, `400`
  `INVALID_CONFIRMATION_TOKEN` para token ausente, desconhecido, expirado ou já usado, `409`
  `ACCOUNT_ALREADY_CONFIRMED`, `429` com `Retry-After` e `500` genérico.
- Conta já confirmada vence o estado do token: uma segunda tentativa responde `409` e não cria
  sessão nem reenvia confirmação.
- O consumo condicional do token e a atualização condicional de `email_confirmed_at` garantem uso
  único mesmo com requisições concorrentes; a sessão nova revoga as anteriores e o JWT antigo
  passa a receber `401`.
- Falha no e-mail de nova sessão não bloqueia o acesso: a sessão continua válida e a falha é
  registrada sem PII, token ou JWT.
- A página usa Server Component + Server Action + formulário client com auto-submit único
  (guardado por `ref`) e botão de fallback sem JavaScript. Links inválidos, expirados ou usados
  mostram "This confirmation link is invalid or has expired." com o CTA principal "Sign in" (`/auth/sign-in`) e link secundário para `/auth/sign-up`;
  contas já confirmadas orientam o sign-in.
- `getSessionUser` é envolvido em `cache()` para deduplicar a chamada a `/me` entre layout e
  página privada na mesma renderização. `/app` exibe `Welcome, <firstName>`.
- A página de confirmação processa o token mesmo para quem já tem sessão, porque a nova sessão
  substitui a anterior; sem token, pessoa autenticada é enviada para `/app` e visitante para
  `/auth/sign-in`.

### 4.7 Sign-in

O sign-in é público. O web envia o formulário por uma Server Action para
`POST /api/v1/auth/sign-in`; a API valida o corpo (`400`), aplica o rate limit por IP + e-mail
normalizado (`SIGN_IN_RATE_LIMIT_MAX`, padrão 5, e `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS`, padrão 60;
a 6ª tentativa recebe `429` com `Retry-After`), localiza a conta e verifica a senha, usando um hash
dummy real quando a conta não existe. Só depois de senha correta checa a confirmação do e-mail
(`403 EMAIL_NOT_CONFIRMED`); credenciais inválidas respondem sempre `401 INVALID_CREDENTIALS`.

```text
/auth/sign-in (web) ── Server Action ──► POST /api/v1/auth/sign-in
                                          ├─ parseSignInInput (400)
                                          ├─ SignInRateLimiter (IP + e-mail → 429)
                                          └─ SignInUseCase
                                               ├─ users.findByEmail + PasswordHasherPort.verify
                                               ├─ e-mail confirmado? (403, só com senha correta)
                                               └─ CreateSessionUseCase (sign_in)
                                                    ├─ sessions (nova + revoga as anteriores)
                                                    ├─ JWT HS256
                                                    └─ SMTP local (e-mail de nova sessão)
◄── { accessToken, tokenType, expiresIn, user } ── Server Action grava cookie HttpOnly
    e redireciona para o returnTo sanitizado (ou /app)
```

Regras:

- O e-mail de nova sessão é enviado dentro do `CreateSessionUseCase` (best-effort), logo vale para
  sign-in e confirmação.
- Senha no login sem mínimo, com teto de 128 caracteres (acima disso `400`).
- O `returnTo` atravessa a página (input oculto `returnTo`) e é sanitizado de novo na Server
  Action; valores externos ou inseguros caem em `/app`.
- Logs carregam só `outcome` e `userId`; nunca e-mail, senha ou token.
- O rate limit é em memória por processo (store compartilhado é follow-up multi-instância).

### 4.8 Recuperação de senha

A recuperação é pública e sempre responde a mesma mensagem para qualquer e-mail sintaticamente
válido, exista ou não a conta. O web envia o formulário por uma Server Action para
`POST /api/v1/auth/forgot-password`; a API valida o e-mail, aplica rate limit por IP e por e-mail
normalizado e, apenas quando a conta existe, emite um token opaco de uso único e dispara o e-mail
com o link `/auth/reset-password?token=...` (a troca de senha é a fatia 008).

```text
/auth/forgot-password (web) ── Server Action ──► POST /api/v1/auth/forgot-password
                                                     │ email normalize + rate limit (IP/e-mail)
                                                     └─► RequestPasswordResetUseCase
                                                           ├─ users (busca por e-mail normalizado)
                                                           ├─ auth_tokens (purpose password_reset, apenas token_hash)
                                                           ├─ create-then-revoke (invalidateUnusedExcept)
                                                           └─ SMTP local (Mailpit)
```

| Peça                                | Responsabilidade                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `ForgotPasswordInput`               | Valida/normaliza o e-mail e devolve mensagem en-US por campo                  |
| `RequestPasswordResetUseCase`       | Emite o token para conta existente e mantém a resposta genérica               |
| `reset-password-email` / nodemailer | Template en-US "Reset your password" com link, expiração e aviso para ignorar |
| `ForgotPasswordRateLimiter`         | Janela deslizante em memória por `ip:` e `email:`, limites via env            |
| `auth_tokens`                       | `purpose = password_reset`, `expires_at`, `used_at`; só o hash é persistido   |

Regras:

- Respostas: `200` com a mensagem genérica, `400` validação com `fieldErrors`, `429` excesso de
  tentativas e `500` sem detalhes internos. O envio ou não do e-mail é a única diferença interna.
- Conta inexistente não cria token nem envia e-mail. Conta confirmada ou não confirmada recebe o
  e-mail; o reset bem-sucedido da fatia 008 também confirma o endereço.
- Um novo pedido cria o token e invalida os pendentes do mesmo usuário/purpose exceto o recém-criado
  (`invalidateUnusedExcept`), preservando um único token válido sob concorrência.
- O token expira em `RESET_TOKEN_TTL_SECONDS` (padrão 1 hora), é de uso único e nunca aparece em
  logs, métricas ou respostas. Falha de SMTP é registrada sem PII e não muda a resposta.
- O formulário usa `useActionState`, label visível, `aria-describedby`, resumo `role="alert"` e
  estado de sucesso `role="status"` que substitui o formulário. A UI é en-US e light-only.
- O rate limit é local ao processo; um store compartilhado fica como follow-up.

### 4.9 Rotas do web e guard

O web organiza a navegação em dois grupos do App Router, cada um com layout próprio:

| Grupo                | URL       | Acesso  | Layout / proteção                                                          |
| -------------------- | --------- | ------- | -------------------------------------------------------------------------- |
| `apps/web/app/auth/` | `/auth/*` | Público | Layout de autenticação light-only; sign-up, sign-in, confirm, forgot/reset |
| `apps/web/app/app/`  | `/app/*`  | Privado | Shell privado; o layout aplica o guard server-side antes de renderizar     |

Regras:

- O guard de `/app/*` lê o cookie `session_token` no servidor e consulta `GET /api/v1/auth/me`.
  Sem cookie, `401` ou erro da API, a pessoa é redirecionada para
  `/auth/sign-in?returnTo=<caminho>`. O destino vive em uma constante única
  (`SIGNED_OUT_REDIRECT_PATH`) em `apps/web/lib/auth/route-rules.ts`. Como layouts não conhecem o
  pathname, `apps/web/proxy.ts` copia `pathname + search` de `/app/*` para o header de requisição
  `x-return-to`; o guard o sanitiza com `sanitizeReturnTo` (somente `/app` e `/app/...`, sem
  esquema, `//`, barra invertida, `..` ou equivalentes codificados) antes de redirecionar.
- Pessoa autenticada em `/auth/sign-up` ou `/auth/sign-in` é enviada para `/app`.
  `/auth/confirm` processa o token mesmo com sessão ativa e, sem token, envia pessoa autenticada
  para `/app` e visitante para `/auth/sign-in`; `/auth/forgot-password` e
  `/auth/reset-password` permanecem acessíveis.
- A raiz `/` não renderiza produto: redireciona para `/app` com sessão e para `/auth/sign-in`
  sem sessão.
- 404 de rotas inexistentes é resolvido dentro do layout do grupo (catch-all + `not-found.tsx`),
  para manter o shell público ou privado.
- O guard é uma camada de experiência; a autorização real continua na API, que valida o Bearer em
  toda rota protegida.
- Textos de UI e metadados são **en-US** (`html lang="en-US"`); a documentação interna é PT-BR.

---

## 5. Fluxo de dados alvo

```text
Usuário
  │
  ▼
apps/web (Next.js)
  │  HTTP /api/v1  (servidor lê o cookie e envia Authorization: Bearer)
  ▼
apps/api (NestJS)
  ├── AuthN/AuthZ ──────────────► Postgres (auth própria: users, auth_tokens, sessions)
  │                               └─► SMTP local (e-mail de nova sessão / Mailpit)
  ├── Casos de uso
  │     ├── Conectores ─────────► Notion / Google / Jira / ...
  │     ├── Ingestão ───────────► Postgres + Storage (documentos e chunks)
  │     └── Experts ────────────► Recuperação de contexto + LLM
  └── Observabilidade ──────────► Grafana (LGTM)
```

Fluxo resumido:

1. O usuário conecta uma fonte externa via OAuth/token.
2. A ingestão sincroniza documentos, normaliza e armazena conteúdo + metadados.
3. O usuário faz um pedido a um Expert.
4. O Expert recupera contexto das fontes conectadas, gera a resposta e cita as origens.
5. Logs, métricas e traces são emitidos desde o dia 0.

> O fluxo acima é o alvo do produto. Hoje estão implementados o caminho web → API versionada
> (`GET /api/v1/hello`), a telemetria, a infraestrutura de sessão (`GET /api/v1/auth/me`, JWT,
> cookie `HttpOnly` e e-mail de nova sessão), o sign-up real (`POST /api/v1/auth/sign-up`,
> `/auth/sign-up`, hash scrypt, token de confirmação e e-mail), a confirmação de conta
> (`POST /api/v1/auth/confirm`, `/auth/confirm`, sessão única, cookie e `/app` personalizado), a
> solicitação de recuperação de senha (`POST /api/v1/auth/forgot-password`,
> `/auth/forgot-password`, token de reset e e-mail) e o sign-in real
> (`POST /api/v1/auth/sign-in`, `/auth/sign-in`, `returnTo` seguro) e o esqueleto de navegação
> (`/auth/*` público, `/app/*` privado com shell e guard, raiz redirecionando por sessão). O
> schema de auth veio na fatia 001; sign-out e a troca de senha em si entram nas fatias 007 e 008.

---

## 6. Decisões arquiteturais

Cada decisão abaixo possui um registro correspondente em [`.adrs/`](../.adrs/README.md), com
contexto, alternativas e consequências. Decisões ainda em aberto permanecem na §7 até serem
tomadas.

| Decisão                                     | Motivo                                                                          | Estado                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Monorepo com Turborepo + Bun                | Compartilhar código, cache e execução paralela                                  | ✅                                           |
| Next.js App Router no front-end             | Server Components, streaming e SEO                                              | ✅                                           |
| API separada em NestJS                      | Isolar domínio, ingestão e orquestração do front                                | ✅                                           |
| Supabase local via CLI                      | Ambiente reproduzível sem instalação global                                     | ✅                                           |
| Auth própria na API (sem Supabase Auth)     | Controlar sessão única, tokens opacos e e-mails no domínio da aplicação         | ✅ (schema + sessão + sign-up + recuperação) |
| Hash de senha com scrypt nativo             | Hash forte sem dependência nativa, com custo versionado (ADR 0014)              | ✅                                           |
| Sessão com JWT HS256 + registro server-side | Revogação imediata, sessão única e claims mínimos `sub`/`sid`/`iat`/`exp`       | ✅                                           |
| Cookie `HttpOnly` com ponte `Bearer` no web | Token fora do JavaScript; o servidor do Next lê o cookie e chama a API          | ✅                                           |
| Sessão única com create-then-revoke         | Preserva o invariante sob concorrência sem transação no banco (ADR 0013)        | ✅ (follow-up)                               |
| Namespace `/api/v1`                         | Versionar a API e manter contrato estável desde a primeira rota                 | ✅                                           |
| Grupos `/auth/*` público e `/app/*` privado | Separar fluxo de auth da área privada, com guard server-side e layouts próprios | ✅                                           |
| Contrato de erro global `{ code, message }` | Respostas previsíveis para o web sem stack, SQL ou detalhes internos            | ✅                                           |
| Arquitetura em camadas + vertical slices    | Baixo acoplamento e evolução por domínio                                        | ✅ (`hello`)                                 |
| Light theme único                           | Direção visual definida em `DESIGN.md`                                          | ✅                                           |
| Tailwind CSS + shadcn/ui em `packages/ui`   | Base visual compartilhada e tokens únicos                                       | ✅                                           |
| TypeScript `strict`                         | Segurança de tipos no monorepo                                                  | ✅                                           |
| OpenTelemetry + Grafana LGTM desde o dia 0  | Diagnosticar ingestão e respostas de IA                                         | ✅                                           |
| Vitest + Playwright + Supertest             | Unitário, E2E e API                                                             | ✅                                           |
| LGTM all-in-one via Compose                 | Menos configuração e versões fixadas                                            | ✅                                           |
| Supabase Analytics desabilitado             | `vector` exige Docker API em `2375`, indisponível por padrão no Docker Desktop  | ✅                                           |
| PostgreSQL local em `15`                    | Workaround de ambiente; a versão alvo será decidida antes de produção           | ✅                                           |

---

## 7. Decisões em aberto

| Tema                 | Pergunta                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Deploy da API        | NestJS na Vercel atende limites de execução e filas? Avaliar alternativa (Railway/Fly/Render). |
| `apps/docs`          | Será o site público de documentação ou deve ser removido?                                      |
| OXLint/OXFmt         | Migrar do ESLint/Prettier atual ou manter?                                                     |
| Multi-tenancy        | Workspace/organização é obrigatório no MVP? Impacta RLS e modelo de dados.                     |
| `packages/shared`    | Quais contratos realmente serão compartilhados entre web e api?                                |
| Versão do PostgreSQL | O ambiente local usa `15`; qual versão será adotada em produção?                               |
| Supabase Analytics   | Reabilitar expondo a Docker API em `2375` ou manter a telemetria apenas no LGTM?               |

---

## 8. Como manter este documento

Atualize `ARCHITECTURE.md` na mesma mudança que:

- adicionar/remover app ou pacote;
- instalar/remover tecnologia da stack;
- alterar a direção de dependência entre camadas;
- mudar o fluxo de dados ou o modelo de deploy;
- tomar ou revisar uma decisão arquitetural (crie/atualize um ADR em [`.adrs/`](../.adrs/README.md)).

Mantenha a legenda de status e as versões sincronizadas com os `package.json`.
