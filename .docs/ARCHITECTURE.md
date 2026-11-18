# ARCHITECTURE.md — Arquitetura

> **Status:** fundação + sessão + rotas + sign-up + confirmação + recuperação de senha + catálogo
> de Experts, chat, fontes de arquivo, URL e mídia, recuperação vetorial e citações implementados ·
> **Atualizado em:** 2026-11-18
> **Legenda:** ✅ implementado · 🧭 planejado · 🔍 decisão em aberto

Este documento descreve a estrutura do monorepo, a stack e a arquitetura alvo. Para regras de
engenharia, consulte [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 1. Visão geral

Monorepo **Turborepo** com **Bun**, contendo aplicações Next.js, uma API NestJS e pacotes
compartilhados. A fundação entrega web, API e PostgreSQL local; o catálogo de Experts e o chat em
persona (spec 012), a ingestão de fontes de arquivo (013), URL (014) e mídia (015), e a recuperação
vetorial com citações inline (016) já estão implementadas. O produto é uma plataforma de Experts
(ver [BUSINESS.md](./BUSINESS.md)), com:

- **Web app** para interação com Experts, conexão de arquivos locais e URLs públicas, e gestão de conectores.
- **API** dedicada para regras de negócio, ingestão e orquestração de agents.
- **PostgreSQL 18** como banco relacional; a **autenticação é própria da API** (JWT emitido pela
  API, sem provedor externo).
- **Weaviate local** como banco de vetores da base de conhecimento, na porta HTTP 8080.
- **Conectores externos** para trazer dados de Notion, Google Drive, Jira, PDF etc.

---

## 2. Estrutura atual

```text
.
├── apps/
│   ├── web/                     # Next.js — porta 3000
│   └── api/                     # NestJS — porta 3333
├── packages/
│   ├── ui/                      # Tailwind/shadcn, tokens e componentes compartilhados
│   ├── eslint-config/           # Configurações ESLint compartilhadas
│   └── typescript-config/       # tsconfig base/nextjs/react-library
├── scripts/
│   ├── infra.mjs                # Orquestra o Compose (PostgreSQL + LGTM)
│   └── db.mjs                   # Executor de migrações e testes SQL
├── db/
│   ├── migrations/              # Migrações versionadas (.sql)
│   └── tests/                   # Testes de schema em SQL
├── docker-compose.yml           # PostgreSQL 18 + LGTM (Grafana, OTel Collector, Loki/Tempo/Prometheus)
├── .plans/                      # Planos de tarefas (<numero>-<slug>-plan.md)
├── .specs/                      # Specs de feature (<numero>-<slug>.md)
├── .docs/                       # Documentação do projeto
├── .adrs/                       # Architecture Decision Records (ADRs)
├── turbo.json
├── package.json
└── bun.lock
```

| App/Pacote                   | Responsabilidade                        | Estado                                                                                                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                   | Interface principal do produto          | ✅ grupos `/auth/*` (público) e `/app/*` (privado), shell, guard, ponte de sessão, sign-up, confirmação, recuperação, troca de senha, chat com Experts, painel de fontes de arquivo/URL/mídia, citações inline e painel de origem na porta 3000                                                    |
| `apps/api`                   | API NestJS                              | ✅ hello em `/api/v1`, sessão JWT + cookie, sign-up, confirmação, forgot/reset-password, catálogo de Experts, conversas com LangGraph, fontes de arquivo/URL/mídia com dedup/chunks/embeddings/Weaviate, recuperação vetorial com citações, contrato de erro, env, CORS, logs e OTel na porta 3333 |
| `packages/ui`                | Componentes compartilhados              | ✅ Tailwind, shadcn, tokens, `cn` e `Button`                                                                                                                                                                                                                                                       |
| `packages/eslint-config`     | Lint compartilhado                      | ✅ `base`, `next-js`, `react-internal`; preset Babel resolvido                                                                                                                                                                                                                                     |
| `packages/typescript-config` | Tipagem compartilhada                   | ✅ `base`, `nextjs`, `react-library`                                                                                                                                                                                                                                                               |
| `packages/shared`            | Contratos, tipos e utilidades cross-app | 🧭 não existe; aguarda contrato real                                                                                                                                                                                                                                                               |

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
| Acesso ao banco (servidor)  | `pg` (SQL parametrizado)                 | 8.23.1           |
| Orquestração de LLM         | LangChain.js + LangGraph                 | 1.4.1 / 1.7.5    |
| Modelo (fatia 012)          | ChatOpenAI `gpt-4o-mini`                 | 1.8.4            |
| Ingestão de arquivos        | `pdf-parse` (PDF) + decodificação UTF-8  | 2.4.5            |
| Upload multipart            | `multer` (`@types/multer`)               | 2.5.0 (2.3.0)    |
| Banco de vetores local      | Weaviate via REST/GraphQL (`fetch`)      | 1.40.5           |
| Embeddings (fatia 013)      | OpenAI `text-embedding-3-small`          | 1536 dimensões   |
| E-mail transacional         | Mailtrap SDK (dev) + Resend HTTP API     | 6.2.0 / —        |
| Hash de senha               | `node:crypto` scrypt (ADR 0014)          | —                |
| Banco local                 | PostgreSQL via Docker Compose            | 18               |
| Testes unitários/integração | Vitest + Supertest                       | 5.1.0 / 7.3.1    |
| Testes E2E                  | Playwright                               | 1.65.0           |
| Observabilidade             | OpenTelemetry SDK + Grafana LGTM         | 0.301.0 / 0.39.0 |
| Lint                        | ESLint                                   | 10.9.1           |
| Formatação                  | Prettier                                 | 3.9.6            |
| Hooks Git                   | Lefthook + lint-staged                   | 2.2.2 / 17.6.0   |
| Mensagens de commit         | Commitlint + Conventional Commits        | 21.2.4           |

### 3.2 Stack alvo (planejada ou em avaliação)

| Camada                   | Tecnologia                     | Estado          |
| ------------------------ | ------------------------------ | --------------- |
| Datas                    | date-fns                       | 🧭              |
| Tabelas                  | TanStack Table                 | 🧭              |
| Gráficos                 | TanStack Charts                | 🧭              |
| Infra de produção        | Vercel + PostgreSQL gerenciado | 🧭              |
| Lint/format alternativos | OXLint + OXFmt                 | 🔍 em avaliação |
| Contratos compartilhados | `packages/shared`              | 🧭              |

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
| `infrastructure` | Repositórios (`pg`), filas, eventos, clientes HTTP     | `application`, `domain` |
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
│   │   ├── application/         # Casos de uso (inclui GetCurrentUserUseCase), templates, portas
│   │   ├── infrastructure/      # jose, scrypt, tokens opacos, repositórios `pg`, Mailtrap/Resend
│   │   └── interface/           # request handlers (1 por endpoint), guard, rate limiter, testes de integração
│   │       └── request-handlers/ # um handler por endpoint (sign-up, sign-in, sign-out, /me, confirm, forgot, reset)
│   ├── experts/
│   │   ├── domain/              # catálogo imutável de 9 Experts (identidade, papel, escopo, tom, sugestões)
│   │   ├── application/         # ListExpertsUseCase
│   │   └── interface/           # GET /api/v1/experts (autenticado)
│   ├── conversations/
│   │   ├── domain/              # Conversation, ConversationMessage, PromptSource, erros de domínio
│   │   ├── application/         # GetConversationUseCase, SendMessageUseCase, portas de repositório e responder
│   │   ├── infrastructure/      # repositório `pg`, adapter LangGraph/ChatOpenAI
│   │   └── interface/           # GET /conversations, POST /conversations/messages + integração
│   ├── citations/
│   │   ├── domain/              # Citation, RetrievalResult, politicas de dedupe/contexto/sanitizacao
│   │   ├── application/         # RetrieveContextUseCase, ComposeCitedAnswerUseCase, RefreshCitationsUseCase + portas
│   │   ├── infrastructure/      # embedding de query, Weaviate GraphQL e metadados de fontes via `pg`
│   │   └── interface/           # sem endpoints; consumida pela slice conversations
│   ├── sources/
│   │   ├── domain/              # Source, SourceVersion, Chunk, Document, políticas de arquivo/URL e hash
│   │   ├── application/         # conectar arquivo/URL, listar, processar, excluir e retry; portas de extrator/embedding/vetor/repositório/fetch
│   │   ├── infrastructure/      # repositório `pg`, `pdf-parse`, fetch HTTP seguro, OpenAIEmbeddings e Weaviate REST
│   │   └── interface/           # GET/POST /sources, POST /sources/urls, DELETE /sources/:id, POST /sources/:versionId/retry
│   ├── hello/
│   │   ├── domain/
│   │   ├── application/
│   │   └── interface/
│   └── shared/                  # config, database (pool `pg`), logging, observability, interface
├── test/fakes/                  # repositórios, e-mail e token em memória
├── app.module.ts
├── app-setup.ts
└── main.ts
```

Os domínios `experts` e `conversations` (spec 012), `sources` (specs 013–015) e `citations`
(spec 016) seguem o mesmo formato; novos domínios (`connectors`, `documents`, `knowledge`) devem
seguí-lo, criando `infrastructure/` quando houver implementação concreta. `auth`, `conversations`,
`sources` e `citations` são as referências de slices completos, com `citations` sem endpoints próprios.

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

O schema de auth é criado em `db/migrations/` e é de uso **exclusivo da API**; o navegador não
acessa essas tabelas (RLS habilitado, nenhuma policy pública). A API acessa o banco como o usuário
`postgres` do Compose, via pool `pg` e SQL parametrizado (ADR 0016).

| Tabela          | Papel                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | Conta da pessoa: nome, e-mail normalizado e único, hash de senha e confirmação de e-mail                                                    |
| `auth_tokens`   | Tokens opacos de uso único para confirmação de e-mail e reset de senha, persistidos só como hash                                            |
| `sessions`      | Registro server-side das sessões emitidas pela API, com expiração e revogação                                                               |
| `conversations` | Uma conversa por `(user_id, expert_id)`; dono e Expert da troca (spec 012)                                                                  |
| `messages`      | Mensagens `user`/`expert` de uma conversa, com conteúdo, data/hora e campos opcionais `citations`, `retrieval` e `answer_status` (spec 016) |

Regras centrais:

- `users.email` é armazenado em minúsculas; o índice único em `lower(email)` garante unicidade
  case-insensitive.
- `users.password_hash` armazena apenas o hash; a senha em claro nunca é persistida.
- `auth_tokens` usa `purpose` (`email_confirmation` ou `password_reset`), `expires_at` e
  `used_at`; apenas `token_hash` é persistido.
- `sessions` usa `origin` (`sign_up_confirmation` ou `sign_in`), `expires_at` e `revoked_at`;
  sessão ativa é a que tem `revoked_at` nulo e `expires_at` no futuro.
- `users`, `auth_tokens`, `sessions` e `conversations` usam UUID e `ON DELETE CASCADE` a partir do usuário; `messages` cascateia a partir de `conversations`.
- `conversations` tem `unique (user_id, expert_id)` e `expert_id` restrito aos nove IDs do catálogo; toda leitura filtra por `user_id`.
- `messages` tem `role check ('user','expert')`, conteúdo de 1 a 16000 caracteres e índice `(conversation_id, created_at, id)`. RLS habilitado sem policies, como nas tabelas de auth.

O detalhamento de campos e constraints está em `.specs/001-auth-schema.md`. A fatia 002 entrega a
infraestrutura de sessão descrita na §4.5, a fatia 004 o sign-up e a fatia 005 a confirmação
descritos na §4.6, a fatia 006 o sign-in na §4.7 e as fatias 007 e 008 a solicitação de recuperação e a troca de senha
na §4.8; o sign-out é atendido por `POST /api/v1/auth/sign-out` (`204`, revoga a sessão atual e o JWT
deixa de valer imediatamente).

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

| Peça                                                     | Responsabilidade                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CreateSessionUseCase`                                   | Cria a sessão, revoga as anteriores, assina o JWT e dispara o e-mail de nova sessão     |
| `ValidateSessionUseCase`                                 | Valida o JWT e confirma sessão ativa + dono antes de liberar a requisição               |
| `SessionTokenPort` / `jose`                              | Assina e valida HS256 com `JWT_SECRET`; claims `sub`, `sid`, `iat`, `exp`               |
| `SessionsRepositoryPort` / `pg`                          | Persiste, consulta e revoga sessões com SQL parametrizado                               |
| `UsersRepositoryPort` / `pg`                             | Carrega os dados básicos da pessoa autenticada                                          |
| `EmailSenderPort` / Mailtrap ou Resend                   | Envia o template en-US de nova sessão pelo provedor ativo (`NODE_ENV`)                  |
| `SessionGuard` + `@CurrentUser()`                        | Extrai o Bearer, aplica o contrato de 401 e injeta a pessoa na rota                     |
| `GetCurrentUserRequestHandler` + `GetCurrentUserUseCase` | Atende `GET /auth/me` com o `AuthUser` já resolvido pelo guard, sem reler o repositório |
| `ErrorContractFilter` (`APP_FILTER`)                     | Serializa `{ code, message, fieldErrors? }` sem stack/SQL/detalhes internos             |

Regras:

- Toda requisição autenticada relê a sessão: JWT válido **não** basta (revogação é imediata).
- `GET /auth/me` não relê o usuário: o `SessionGuard` resolve o `AuthUser` e o entrega ao
  `GetCurrentUserRequestHandler`, que delega a um `GetCurrentUserUseCase` fino (ADR 0015).
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
                                                   ├─ users (PostgreSQL, `pg`)
                                                   ├─ auth_tokens (apenas token_hash)
                                                   ├─ scrypt (password_hash)
                                                   └─ provedor de e-mail ativo
```

| Peça                              | Responsabilidade                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SignUpInput`                     | Valida/normaliza os cinco campos e devolve mensagens en-US por campo                                                                        |
| `SignUpUseCase`                   | Cria conta não confirmada, reenvia confirmação ou sinaliza conflito                                                                         |
| `PasswordHasherPort` / scrypt     | Hash forte da senha, sem dependência nativa (ADR 0014)                                                                                      |
| `OpaqueTokenPort` / `node:crypto` | 32 bytes aleatórios no link; SHA-256 em hex persistido em `token_hash`                                                                      |
| `AuthTokensRepositoryPort` / `pg` | Cria o token e invalida os pendentes do mesmo usuário/purpose                                                                               |
| `UsersRepositoryPort` / `pg`      | Busca por e-mail normalizado e cria a conta com `email_confirmed_at` nulo                                                                   |
| `email-layout`                    | Layout HTML compartilhado dos e-mails: light-only, paleta e tokens de `DESIGN.md`, tabelas + estilos inline, botão único e link de fallback |
| `confirmation-email`              | Template en-US "Confirm your account" com expiração de 24 h                                                                                 |
| `SignUpRateLimiter`               | Janela deslizante em memória por IP, limites configuráveis por env                                                                          |

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
                                                                  └─ provedor de e-mail ativo (e-mail de nova sessão)
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
                                                    └─ provedor de e-mail ativo (e-mail de nova sessão)
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

### 4.8 Recuperação e troca de senha

A recuperação é pública e sempre responde a mesma mensagem para qualquer e-mail sintaticamente
válido, exista ou não a conta. O web envia o formulário por uma Server Action para
`POST /api/v1/auth/forgot-password`; a API valida o e-mail, aplica rate limit por IP e por e-mail
normalizado e, apenas quando a conta existe, emite um token opaco de uso único e dispara o e-mail
com o link `/auth/reset-password?token=...` (a troca de senha é descrita na seção "Troca de senha" abaixo).

```text
/auth/forgot-password (web) ── Server Action ──► POST /api/v1/auth/forgot-password
                                                     │ email normalize + rate limit (IP/e-mail)
                                                     └─► RequestPasswordResetUseCase
                                                           ├─ users (busca por e-mail normalizado)
                                                           ├─ auth_tokens (purpose password_reset, apenas token_hash)
                                                           ├─ create-then-revoke (invalidateUnusedExcept)
                                                           └─ provedor de e-mail ativo
```

| Peça                          | Responsabilidade                                                              |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `ForgotPasswordInput`         | Valida/normaliza o e-mail e devolve mensagem en-US por campo                  |
| `RequestPasswordResetUseCase` | Emite o token para conta existente e mantém a resposta genérica               |
| `reset-password-email`        | Template en-US "Reset your password" com link, expiração e aviso para ignorar |
| `ForgotPasswordRateLimiter`   | Janela deslizante em memória por `ip:` e `email:`, limites via env            |
| `auth_tokens`                 | `purpose = password_reset`, `expires_at`, `used_at`; só o hash é persistido   |

Regras:

- Respostas: `200` com a mensagem genérica, `400` validação com `fieldErrors`, `429` excesso de
  tentativas e `500` sem detalhes internos. O envio ou não do e-mail é a única diferença interna.
- Conta inexistente não cria token nem envia e-mail. Conta confirmada ou não confirmada recebe o
  e-mail; o reset bem-sucedido da fatia 008 também confirma o endereço.
- Um novo pedido cria o token e invalida os pendentes do mesmo usuário/purpose exceto o recém-criado
  (`invalidateUnusedExcept`), preservando um único token válido sob concorrência.
- O token expira em `RESET_TOKEN_TTL_SECONDS` (padrão 1 hora), é de uso único e nunca aparece em
  logs, métricas ou respostas. Falha de envio de e-mail é registrada sem PII e não muda a resposta.
- O formulário usa `useActionState`, label visível, `aria-describedby`, resumo `role="alert"` e
  estado de sucesso `role="status"` que substitui o formulário. A UI é en-US e light-only.
- O rate limit é local ao processo; um store compartilhado fica como follow-up.

#### Troca de senha (fatia 008)

`/auth/reset-password?token=...` é pública e acessível com ou sem sessão. A página (Server Component)
lê o `token` no servidor e o entrega ao formulário; o formulário (`ResetPasswordForm`) remove o token
da barra de endereços com `history.replaceState` assim que carrega, mantém o valor no estado e o
envia, junto com a nova senha e a confirmação, por uma Server Action para
`POST /api/v1/auth/reset-password`. A rota responde com `Referrer-Policy: no-referrer`
(`headers()` do `next.config.js`), não carrega recursos externos e não é registrada no log de
requisições do `next dev`. Token ausente mostra o estado de link inválido, sem formulário.

```text
/auth/reset-password (web) ── Server Action ──► POST /api/v1/auth/reset-password
                                                   │ rate limit por IP (429 + Retry-After)
                                                   │ valida senha + confirmação (VALIDATION_ERROR, token intacto)
                                                   └─► ResetPasswordUseCase
                                                         1. hash da nova senha (scrypt)
                                                         2. consome o token (used_at is null)
                                                         3. users.updatePassword
                                                         4. users.confirmEmail (se ainda não confirmado)
                                                         5. auth_tokens.invalidateUnused (password_reset)
                                                         6. sessions.revokeAllActive
                                                         7. e-mail "Your password has been changed"
```

| Peça                       | Responsabilidade                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `password-policy`          | Política de senha (8–128, sem composição) e mensagens, compartilhadas com o sign-up               |
| `ResetPasswordInput`       | Valida senha e confirmação (token só é aparado) e devolve mensagem en-US por campo                |
| `ResetPasswordUseCase`     | Valida o token por hash e executa as escritas na ordem acima                                      |
| `password-changed-email`   | Template en-US "Your password has been changed" com orientação para solicitar novo reset          |
| `ResetPasswordRateLimiter` | Janela deslizante em memória por IP; `RESET_PASSWORD_RATE_LIMIT_MAX` (5) e `_WINDOW_SECONDS` (60) |
| `UsersRepositoryPort`      | Ganha `updatePassword(id, passwordHash)`                                                          |
| `SessionsRepositoryPort`   | Ganha `revokeAllActive(userId)` (todas as sessões ativas, sem exceção)                            |

Regras:

- Respostas: `200` com "Your password has been updated. Sign in with your new password.", `400`
  `INVALID_RESET_TOKEN` (token ausente, desconhecido, expirado, já usado, de outro propósito ou
  consumido por requisição concorrente), `400` `VALIDATION_ERROR` com `fieldErrors.password` e
  `fieldErrors.passwordConfirmation`, `429` com `Retry-After` e `500` genérico. Se token e senha são
  inválidos ao mesmo tempo vale `VALIDATION_ERROR`, e um erro de senha nunca consome o token.
- Uma senha que falha na própria política também reporta "Passwords do not match." na confirmação,
  como no sign-up (a política e o algoritmo de confirmação são os mesmos).
- Não há transação de banco: a consistência vem da **ordem** das escritas. O hash é calculado antes
  de consumir o token; o consumo é condicional (`used_at is null`), então de dois resets
  simultâneos com o mesmo token apenas um vence e o outro recebe `INVALID_RESET_TOKEN`. Se uma etapa
  falhar após o consumo, a pessoa solicita um novo link; nenhuma sessão antiga permanece válida
  após o `200`. A atomicidade estrita em banco segue como evolução (ADR 0013).
- O reset confirma o e-mail ainda não confirmado (o token prova a posse do endereço) e invalida os
  outros tokens `password_reset` não usados.
- Falha no e-mail de sucesso é registrada (`outcome` sem PII) e não reverte a troca.
- Após o `200`, o web mostra a confirmação (`role="status"`) e faz `router.replace` para
  `/auth/sign-in?reset=success`; o sign-in exibe a mensagem de sucesso (`role="status"`). O cookie
  antigo é tratado como ausente pelo guard, pois a sessão foi revogada.
- Logs carregam só `userId` e `outcome`; nunca token, senha ou e-mail.

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
- A raiz `/` redireciona para `/app` com sessão e, sem sessão, renderiza a landing pública
  (estática, em `app/_components/landing.tsx`). Rotas desconhecidas fora de `/auth` e `/app` caem
  em `app/not-found.tsx`.
- 404 de rotas inexistentes é resolvido dentro do layout do grupo (catch-all + `not-found.tsx`),
  para manter o shell público ou privado.
- O guard é uma camada de experiência; a autorização real continua na API, que valida o Bearer em
  toda rota protegida.
- Textos de UI e metadados são **en-US** (`html lang="en-US"`); a documentação interna é PT-BR.

### 4.10 Provedor de e-mail transacional

O provedor é escolhido por `NODE_ENV` na configuração (`loadEnv`) e a composição do
`EmailSenderPort` fica centralizada em `auth/infrastructure/create-email-sender.ts`:

| `NODE_ENV` efetivo      | Provedor | Variáveis exigidas                                     |
| ----------------------- | -------- | ------------------------------------------------------ |
| `production`            | Resend   | `RESEND_API_KEY` + `MAIL_FROM_EMAIL`/`MAIL_FROM_NAME`  |
| ausente, vazio ou outro | Mailtrap | `MAILTRAP_API_TOKEN` + `MAIL_FROM_*`; sandbox opcional |

Regras:

- `NODE_ENV` é opcional; ausente/vazio assume `dev`. A comparação normaliza espaços e
  capitalização, então `Production` seleciona Resend.
- A validação exige apenas as variáveis do provedor ativo; variáveis do provedor inativo são
  ignoradas.
- Resend usa a API HTTP oficial (`https://api.resend.com/emails`) via `fetch` nativo; Mailtrap usa
  o SDK `mailtrap`, com sandbox opcional em não produção.
- O boot registra `nodeEnv` e `emailProvider`, nunca chaves ou conteúdo de e-mail.

### 4.11 Catálogo de Experts e chat (fatia 012)

A primeira feature de produto entrega nove Experts selecionáveis e um chat em persona, com histórico
isolado por usuário autenticado (sem workspace). O catálogo é **conteúdo versionado na API** e a
web o consome no servidor; não há duplicação em `packages/ui` nem no bundle do cliente.

```text
/app (web, server) ──► GET /api/v1/experts ────────► ListExpertsUseCase (catálogo em EXPERT_CATALOG)
       │              GET /api/v1/conversations ──► GetConversationUseCase ─► conversations/messages
       │              POST /conversations/messages ► SendMessageUseCase ────► ExpertResponderPort
       ▼                                                                        │
  ExpertChat (client) ◄──── Server Actions ◄──────── { userMessage, expertMessage } (LangGraph/ChatOpenAI)
```

| Peça                                      | Responsabilidade                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `EXPERT_CATALOG`                          | Fonte única de identidade, papel, escopo, tom e sugestões, na ordem CTO, CMO, Sales, CS, Customer Hero, CEO, CFO, COO, CPO |
| `ListExpertsUseCase`                      | Devolve o catálogo imutável em `GET /api/v1/experts`                                                                       |
| `GetConversationUseCase`                  | Devolve o transcript de um Expert para o usuário autenticado ou estado vazio                                               |
| `SendMessageUseCase`                      | Valida o Expert, chama o modelo e persiste a troca; falha do modelo não grava mensagem parcial                             |
| `ConversationsRepositoryPort` / `pg`      | CRUD de `conversations`/`messages`, sempre filtrado por `user_id`, com `withDbSpan`                                        |
| `ExpertResponderPort` / LangGraph         | `StateGraph` com um nó `respond`; `SystemMessage` imutável por Expert e prompt do usuário como dado                        |
| `SessionGuard` + `@CurrentUser()`         | Reutilizados de `auth`; nenhum token chega ao cliente                                                                      |
| `chat-actions.ts` / `fetchApiWithSession` | Server Actions web que repassam o cookie `HttpOnly` como Bearer e mapeiam erros para texto en-US                           |

Regras:

- Um prompt vazio ou acima de `EXPERT_PROMPT_MAX_LENGTH` (padrão 4000) é rejeitado antes de chamar o modelo; o textarea valida localmente para feedback imediato.
- `OPENAI_API_KEY` é opcional no boot; sem chave, o envio responde `503 MODEL_UNAVAILABLE` com mensagem acionável, sem detalhes técnicos. O retry preserva o prompt.
- Sugestões clicáveis enviam exatamente o texto exibido (`source: "suggestion"`); telemetria registra só o identificador do Expert.
- Telemetria `expert.chat` registra identificadores, duração e desfecho — nunca conteúdo de prompt ou resposta.
- A UI é en-US, light-only, responsiva em 360/768/1280 px, com `aria-live` no transcript e `role="alert"` nos erros; header/perfil/logout permanecem intactos.

### 4.12 Fontes de conhecimento por arquivo (fatia 013)

A home privada passa a ter um botão flutuante (FAB) que abre um painel de fontes conectadas. O
processo de ingestão é assíncrono do ponto de vista da interface: o upload registra a versão como
`processing` e responde `202`; o processamento em segundo plano extrai texto, gera chunks e
embeddings, grava vetores no Weaviate e só então marca a versão como `ready`.

```text
/app (web, server) ── Server Action (multipart) ──► POST /api/v1/sources
        │                                             │ ConnectSourcesUseCase
        │                                             ├─ SHA-256 + normalized_name → Source/SourceVersion
        │                                             ├─ source_files (bytea)
        │                                             └─ ProcessSourceVersionUseCase (background)
        │                                                    ├─ pdf-parse / UTF-8 → chunkText
        │                                                    ├─ OpenAIEmbeddings (text-embedding-3-small)
        │                                                    └─ Weaviate KnowledgeChunk (REST)
        ▼
KnowledgeSources (client) ◄── Server Actions ◄── GET/DELETE/POST retry /api/v1/sources
```

| Peça                                     | Responsabilidade                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sources/domain/source.ts`               | Contrato compartilhado `Source`, `SourceVersion`, `Chunk`, `Document` e `SourceSummary` reutilizado pelas fatias 3 a 7                |
| `source-file-policy.ts`                  | Tipos aceitos, limites, `safeFileName`, normalização, SHA-256 e chunking determinístico                                               |
| `ConnectSourcesUseCase`                  | Dedup por hash no escopo do usuário, agrupamento por nome normalizado, versionamento e submit assíncrono                              |
| `ProcessSourceVersionUseCase`            | Extrai, faz chunks, gera embeddings, grava vetores e marca `ready`; falha parcial persiste `failed`                                   |
| `DeleteSourceUseCase`                    | Remove vetores, arquivo original, versões e chunks do usuário; retry limpa vetores parciais antes de reprocessar                      |
| `PostgresSourcesRepository`              | SQL parametrizado com `withDbSpan`, `user_id` em toda consulta; tabelas `sources`, `source_versions`, `source_files`, `source_chunks` |
| `DocumentTextExtractorAdapter`           | PDF via `pdf-parse`; TXT/Markdown com `TextDecoder` fatal (conteúdo vazio ou inválido não vira `ready`)                               |
| `OpenAIEmbeddingGeneratorAdapter`        | `OpenAIEmbeddings`, `text-embedding-3-small`, 1536 dimensões; chave injetada do servidor via `loadEnv().openaiApiKey`                 |
| `WeaviateRestVectorStoreAdapter`         | Collection `KnowledgeChunk`, `vectorizer: none`, cosine, IDs determinísticos; REST/GraphQL na porta 8080 (sem gRPC)                   |
| `source-actions.ts` / `KnowledgeSources` | Server Actions e painel com estados vazio, `processing`, `ready`, `failed`, duplicado, retry e remoção                                |

Endpoints autenticados (`SessionGuard`):

| Rota                                    | Resposta                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/v1/sources`                   | `200 { sources: SourceSummary[] }` (somente versão atual de cada fonte) |
| `POST /api/v1/sources`                  | `202 { results: ConnectedSourceResult[] }`; multipart `files` (até 5)   |
| `DELETE /api/v1/sources/:sourceId`      | `204` sem corpo                                                         |
| `POST /api/v1/sources/:versionId/retry` | `202 { versionId, status: "processing" }`                               |

Regras:

- Deduplicação é por SHA-256 do conteúdo bruto **no escopo de `user_id`**; o nome normalizado apenas
  agrupa versões. O índice único parcial `(user_id, content_hash) where status <> 'failed'`
  transforma corrida concorrente em “Already connected” sem duplicar versão ou vetor.
- O arquivo original fica em `source_files.bytes` (`bytea`), sem caminho de filesystem nem nova
  variável de ambiente. Versões antigas e seus vetores são retidos até a exclusão da fonte; a
  versão anterior deixa de ser a atual e é sinalizada como desatualizada para a fatia 5.
- `POST /sources` valida tipo, tamanho e quantidade na borda antes de persistir. O web replica a
  validação no Server Action e define `experimental.serverActions.bodySizeLimit: "64mb"` para
  cobrir cinco arquivos de até 10 MB mais overhead multipart.
- Limites provisórios: `MAX_SOURCE_FILE_BYTES = 10 MB` e `MAX_FILES_PER_UPLOAD = 5`, centralizados
  no domínio e espelhados no web. Limites definitivos, retenção e metas numéricas seguem em aberto.
- Telemetria `knowledge.sources` registra apenas `userId`, IDs opacos, desfecho, duração e
  `chunkCount`. Nunca conteúdo, nome de arquivo, hash, trecho extraído ou valor de chave de API.
- Conteúdo de documento é tratado como dado não confiável: o chunker apenas divide texto; nenhuma
  instrução dentro do arquivo altera regras do Expert, do chat ou da plataforma.
- As suítes usam fakes (`InMemorySourcesRepository`, extrator/embedding/vetor em memória) e um
  servidor HTTP local para o adaptador Weaviate. A chave real não é usada nos testes.

### 4.13 Fontes de conhecimento por URL (fatia 014)

O mesmo painel passa a aceitar uma URL pública. A fatia reaproveita integralmente o contrato e o
pipeline da fatia 013: a página buscada vira um `SourceVersion` do tipo `txt`, com marcador MIME
privado `text/plain+url`, e segue para chunks, embeddings e vetores sem tipo paralelo de fonte.

```text
/app (web, server) ── Server Action (JSON) ──► POST /api/v1/sources/urls
        │                                       │ ConnectSourceUrlUseCase
        │                                       ├─ normalizeSourceUrl + SSRF policy
        │                                       ├─ HttpWebPageFetcherAdapter (DNS + redirects)
        │                                       └─ ConnectSourcesUseCase (SHA-256 do texto extraído)
        ▼
KnowledgeSources (client) ◄── Server Actions ◄── GET/DELETE/POST retry /api/v1/sources
```

| Peça                        | Responsabilidade                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source-url-policy.ts`      | Normalização (http/https, hosts, fragmentos, parâmetros de rastreamento, 255 caracteres), bloqueio SSRF e extração de título/texto |
| `WebPageFetcherPort`        | Porta de busca com `allowPrivateHosts` apenas em testes; timeout, limite de bytes, redirecionamentos e retries configuráveis       |
| `HttpWebPageFetcherAdapter` | `fetch` com validação de DNS e de cada hop, 8 s, 2 MB, 3 redirecionamentos e 1 retry; nunca registra URL, página ou hash           |
| `ConnectSourceUrlUseCase`   | Busca, dedup/versionamento pelo pipeline 013 e persistência de versão `failed` com mensagem acionável quando a busca não termina   |
| `RetrySourceVersionUseCase` | Para versões de URL, refaz a busca antes de reprocessar; falha de busca permanece `failed`                                         |
| `source-actions.ts`         | `connectSourceUrlAction`: JSON com token apenas no servidor; expõe apenas códigos públicos e mensagens en-US                       |
| `KnowledgeSources`          | Campo “Add a URL”, estados `processing`/`ready`/`failed`, “Already connected”, retry, remoção e linha com URL normalizada e título |

Endpoint adicional autenticado:

| Rota                        | Resposta                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST /api/v1/sources/urls` | `202 { results: ConnectedSourceResult[] }`; JSON `{ url }`; falhas de busca viram versão `failed` |

Regras:

- `sources.normalized_name` é a URL normalizada em minúsculas; `source_versions.original_name`
  guarda a URL para retry; `source_files.content` guarda o texto extraído. Nenhuma nova migração.
- Deduplicação continua sendo SHA-256 do conteúdo extraído no escopo de `user_id`. O hash de uma
  busca falha usa placeholder e é excluído da dedup.
- SSRF: apenas http/https sem credenciais; bloqueio de loopback, privados, link-local, metadados,
  special-use e hostnames internos; DNS e cada redirecionamento são validados antes da conexão.
- `SOURCE_OPENAI_API_KEY` permanece no servidor. Logs e telemetria `knowledge.sources` registram
  apenas `userId`, IDs opacos, código de erro, desfecho, duração e `chunkCount` — nunca URL,
  conteúdo da página, hash ou chave.
- O texto externo é tratado como não confiável e nunca altera regras de Expert/chat/plataforma.
- E2E usa um fake API com catálogo de páginas controlável por teste; nenhuma rede externa é
  necessária e os limites de timeout/redirecionamento seguem decisão aberta com Engenharia.

### 4.14 Mídia como conhecimento (fatia 015)

A fatia 015 estende o pipeline da 013 com imagem (JPEG/PNG), áudio (MP3) e vídeo (MP4). A mídia
é convertida em texto localmente (OCR ou transcrição) e esse texto segue o mesmo caminho de
chunking, embedding e vetores `KnowledgeChunk`, sem pipeline paralelo. A flag de rollout
`knowledge_media_enabled` (padrão `false`) controla a exposição das novas opções no web.

```text
/app (flag ligada) ── Server Action ──► POST /api/v1/sources  (allowMedia)
        │                                   │ ConnectSourcesUseCase
        │                                   ├─ MIME + extensão + magic bytes + limites por tipo
        │                                   ├─ SHA-256 → Source/SourceVersion (mediatype, duração, proveniência)
        │                                   └─ ProcessSourceVersionUseCase (background)
        │                                          ├─ MediaTextExtractorPort (OCR/transcrição local)
        │                                          │      ├─ extracting → "No speech detected" → failed
        │                                          ├─ chunking → embedding → Weaviate (sourceId)
        │                                          └─ ready (+ fases em processing)
        ▼
KnowledgeSources ◄── listagem com status 013 + progresso/erro legíveis em en-US
```

| Peça                             | Responsabilidade                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SourceType` estendido           | `image \| audio \| video` somados a `pdf \| txt \| md`; `sourceTypeFor` permanece documental, `sourceTypeForUpload`/`mediaTypeFor` tratam mídia                             |
| `media-file-policy.ts`           | Magic bytes (JPEG `FF D8 FF`, PNG assinatura completa, MP3 `ID3`/sync MPEG, MP4 `ftyp` no offset 4), limites 25/50/200 MB, duração máxima 60 min                            |
| `MediaTextExtractorPort`         | Contrato `extract(file, type, durationSeconds?)` → texto + `method`/`modelVersion`/`durationSeconds`                                                                        |
| `LocalMediaTextExtractorAdapter` | `execFile` de comandos OCR/transcrição configurados no servidor (`{file}`/`{output}`), diretório temporário removido em `finally`; sem chamada a OpenAI/Gemini              |
| `ProcessSourceVersionUseCase`    | Atualiza fases `extracting`/`chunking`/`embedding` dentro de `processing`, persiste proveniência e limpa vetores parciais em falha                                          |
| `0004_knowledge_media.sql`       | Migração aditiva: novos valores de `type`, colunas opcionais de mídia e constraint `media_type is not null and type = media_type`; sem migração de dados                    |
| `flags.ts` / `source-actions.ts` | Flag lida somente no servidor (env ou cookie `knowledge_media_enabled=1`), parâmetro `allowMedia` do cliente descartado e reaplicado no servidor                            |
| `KnowledgeSources`               | Seletor Image/Audio/Video, `accept` dinâmico, duração opcional, `aria-live` para fases e erro; rótulos/selectors da 013 (`knowledge-source-files`, “Add files”) preservados |

Regras:

- O status público continua `queued|processing|ready|failed`; `extracting|chunking|embedding` são
  detalhes opcionais de progresso, nunca novos valores de status da API.
- Validação na borda e no domínio: MIME + extensão + magic bytes + tamanho por tipo antes de
  persistir; limite de duração também no cliente e no servidor. Tipos não suportados recebem
  mensagem en-US específica e nenhuma fonte é criada.
- Transcrição/OCR vazia marca a versão como `failed` com **"No speech detected"**, sem gravar
  vetores; falhas de comando/provedor local são blocos parciais com mensagem acionável em en-US.
- Dedup é o SHA-256 da 013 no escopo do usuário: reenvio do mesmo arquivo reaproveita a versão e
  não duplica chunks/vetores; retry usa o mesmo `sourceId`.
- Telemetria `media.*` registra apenas IDs opacos, tipo, fases, durações e desfecho. Nunca nome de
  arquivo, hash, comando, texto extraído ou chave.
- `next.config.js` usa `bodySizeLimit: "1gb"` para cobrir o limite de 200 MB por vídeo; a chave de
  embedding continua exclusivamente no servidor via `SOURCE_OPENAI_API_KEY`.
- Modelos/formatos adicionais, OCR de frames e limites definitivos seguem como decisões abertas na
  spec; nenhum arquivo da fatia 014 (URLs) foi alterado.

### 4.15 Recuperação, citações e painel de fontes (fatia 5 / spec 016)

O slice `citations` liga o chat da fatia 012 à base vetorial da fatia 013. Ele não expõe rotas:
`SendMessageUseCase` e `GetConversationUseCase` o consomem por portas. A flag
`RAG_CITATIONS_ENABLED` (padrão `false`) controla a recuperação; com ela desligada, o chat é
idêntico ao da fatia 012 e nenhum campo novo é gravado. O histórico com citações continua legível
mesmo após desligar a flag.

```text
POST /conversations/messages ─► SendMessageUseCase
        │                          ├─ RetrieveContextUseCase (embed → Weaviate → metadados)
        │                          ├─ ExpertResponderPort (prompt aterrado, fontes como dados)
        │                          └─ ComposeCitedAnswerUseCase ([n] validado → mensagem)
        ▼
GET /conversations ───────────► GetConversationUseCase ─► RefreshCitationsUseCase
        ▼
CitedContent/CitationPanel (web): citação clicável + painel lateral, fechável com Esc
```

| Peça                                  | Responsabilidade                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `citations/domain/citation.ts`        | Contrato `Citation`, `RetrievalMetadata`, `GroundingContext`, `GroundedAnswer` e estados `plain`, `with_source`, `no_match`, `retrieval_unavailable` |
| `citation-policy.ts`                  | Dedupe por `chunkId`, limiar, orçamento de caracteres, bloco de dados não confiáveis e remoção de `[n]` fora do intervalo injetado                   |
| `QueryEmbeddingPort` / OpenAI adapter | Embedding da pergunta com `text-embedding-3-small`; chave apenas no servidor                                                                         |
| `KnowledgeRetrievalPort` / Weaviate   | GraphQL `nearVector` em `KnowledgeChunk`, filtro obrigatório `userId`, `limit = topK` e timeout de 4 s                                               |
| `CitationSourceMetadataPort` / `pg`   | Nome, tipo, versão atual, `isStale` e `sourceRemoved`; sem conteúdo de arquivo ou caminho absoluto                                                   |
| `RetrieveContextUseCase`              | Orquestra recuperação, dedupe, seleção por relevância e metadados; falha vira `unavailable`                                                          |
| `ComposeCitedAnswerUseCase`           | Sanitiza a resposta do modelo contra os trechos efetivamente injetados                                                                               |
| `RefreshCitationsUseCase`             | Recalcula `isStale`/`sourceRemoved` ao ler o histórico, preservando o texto da citação                                                               |
| `CitedContent` / `CitationPanel`      | Renderiza `[n]` como botões acessíveis, abre nome/tipo/localização/trecho e fecha com `Esc`                                                          |

Configurações centrais: `RAG_TOP_K = 5`, `RAG_THRESHOLD = 0.35` (certainty do Weaviate),
`RAG_MAX_CONTEXT_CHARS = 6000` e `RAG_MAX_HISTORY_MESSAGES = 6`. A migração aditiva
`0005_rag_citations.sql` acrescenta `citations`, `retrieval` e `answer_status` a `messages`, sem
alterar mensagens antigas e sem migração descendente executada. Nenhum arquivo da slice `sources`
foi alterado: o contrato `KnowledgeChunk` é reusado e tipos novos de fonte são tolerados.

Regras:

- Toda consulta ao vetorial e aos metadados usa o `user_id` autenticado; não há workspace.
- Trechos recuperados são dados não confiáveis em bloco delimitado; instruções dentro deles nunca
  alteram papel, tom ou regras de citação do Expert.
- Citação fora de `[1..k]` é removida; fonte inexistente não é inventada. A ordem das citações
  segue a relevância da recuperação.
- Sem trecho acima do limiar, a resposta diz que não encontrou base e não mostra citações.
- Falha do Weaviate gera aviso en-US acionável, resposta básica sem citações e botão
  "Retry search"; falha do modelo continua `503 MODEL_UNAVAILABLE`, sem detalhes técnicos e sem
  persistência parcial.
- Fonte antiga é sinalizada como "Outdated source"; fonte removida mantém o texto e desabilita o
  botão com "Source removed".
- Telemetria `rag.*` registra IDs opacos, contagens, duração e desfecho; nunca prompt, trecho,
  chave de API, hash de conteúdo ou token de sessão.

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
  │                               └─► Mailtrap/Resend (e-mail de nova sessão)
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
> `/auth/forgot-password`, token de reset e e-mail), a troca de senha
> (`POST /api/v1/auth/reset-password`, `/auth/reset-password`, revogação de sessões) e o sign-in real
> (`POST /api/v1/auth/sign-in`, `/auth/sign-in`, `returnTo` seguro), o sign-out
> (`POST /api/v1/auth/sign-out`, `204`, revoga a sessão atual e invalida o JWT imediatamente) e o
> esqueleto de navegação (`/auth/*` público, `/app/*` privado com shell e guard, raiz
> redirecionando por sessão), o catálogo de Experts (`GET /api/v1/experts`), o chat em persona com
> LangGraph/`gpt-4o-mini` (`GET /api/v1/conversations` e `POST /api/v1/conversations/messages`) e
> o histórico isolado por usuário. A fatia 013 acrescenta o FAB/painel de fontes, o upload
> multipart de PDF/TXT/Markdown, deduplicação por hash, chunks, embeddings e gravação no Weaviate
> local (`KnowledgeChunk`), com listagem, retry e exclusão isolados por usuário. A fatia 014
> acrescenta a conexão de URLs públicas ao mesmo painel, com validação SSRF e o mesmo pipeline de
> indexação. A fatia 015 acrescenta imagem, áudio e vídeo convertidos em texto por
> OCR/transcrição local e indexados pelo mesmo pipeline, atrás da flag
> `knowledge_media_enabled` (desligada por padrão). O schema de auth veio na fatia 001, o de
> conversas na fatia 012 e o de fontes na fatia 013, com colunas opcionais de mídia na migração
> 0004; os vetores ainda não são consultados pelo chat (fatia 5 do épico).

---

## 6. Decisões arquiteturais

Cada decisão abaixo possui um registro correspondente em [`.adrs/`](../.adrs/README.md), com
contexto, alternativas e consequências. Decisões ainda em aberto permanecem na §7 até serem
tomadas.

| Decisão                                      | Motivo                                                                                  | Estado                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| Monorepo com Turborepo + Bun                 | Compartilhar código, cache e execução paralela                                          | ✅                                           |
| Next.js App Router no front-end              | Server Components, streaming e SEO                                                      | ✅                                           |
| API separada em NestJS                       | Isolar domínio, ingestão e orquestração do front                                        | ✅                                           |
| PostgreSQL 18 via Docker Compose             | Ambiente reproduzível sem instalação global nem stack proprietária                      | ✅                                           |
| Auth própria na API (sem provedor externo)   | Controlar sessão única, tokens opacos e e-mails no domínio da aplicação                 | ✅ (schema + sessão + sign-up + recuperação) |
| Acesso ao banco com `pg` + SQL parametrizado | Sem ORM/query builder; SQL explícito e migrações versionadas (ADR 0016)                 | ✅                                           |
| Hash de senha com scrypt nativo              | Hash forte sem dependência nativa, com custo versionado (ADR 0014)                      | ✅                                           |
| Sessão com JWT HS256 + registro server-side  | Revogação imediata, sessão única e claims mínimos `sub`/`sid`/`iat`/`exp`               | ✅                                           |
| Cookie `HttpOnly` com ponte `Bearer` no web  | Token fora do JavaScript; o servidor do Next lê o cookie e chama a API                  | ✅                                           |
| Sessão única com create-then-revoke          | Preserva o invariante sob concorrência sem transação no banco (ADR 0013)                | ✅ (follow-up)                               |
| Namespace `/api/v1`                          | Versionar a API e manter contrato estável desde a primeira rota                         | ✅                                           |
| Grupos `/auth/*` público e `/app/*` privado  | Separar fluxo de auth da área privada, com guard server-side e layouts próprios         | ✅                                           |
| Contrato de erro global `{ code, message }`  | Respostas previsíveis para o web sem stack, SQL ou detalhes internos                    | ✅                                           |
| Arquitetura em camadas + vertical slices     | Baixo acoplamento e evolução por domínio                                                | ✅ (auth, hello)                             |
| Request handler 1:1 por endpoint             | Um handler e um caso de uso por fluxo, com erro traduzido na interface (ADR 0015)       | ✅                                           |
| Light theme único                            | Direção visual definida em `DESIGN.md`                                                  | ✅                                           |
| Tailwind CSS + shadcn/ui em `packages/ui`    | Base visual compartilhada e tokens únicos                                               | ✅                                           |
| TypeScript `strict`                          | Segurança de tipos no monorepo                                                          | ✅                                           |
| OpenTelemetry + Grafana LGTM desde o dia 0   | Diagnosticar ingestão e respostas de IA                                                 | ✅                                           |
| Vitest + Playwright + Supertest              | Unitário, E2E e API                                                                     | ✅                                           |
| LGTM all-in-one via Compose                  | Menos configuração e versões fixadas                                                    | ✅                                           |
| Migrações versionadas com executor próprio   | SQL versionado, transacional e concurrency-safe sem CLI de terceiros (ADR 0016)         | ✅                                           |
| Catálogo de Experts na API (fonte única)     | Web consome o catálogo no servidor; sem duplicação no cliente ou em `packages/ui`       | ✅                                           |
| Histórico por `(user_id, expert_id)`         | Isolamento por usuário autenticado, sem workspace, com `unique` e RLS                   | ✅                                           |
| LangChain.js + LangGraph para responder      | Orquestração do modelo atrás de `ExpertResponderPort`, isolada da aplicação             | ✅                                           |
| `OPENAI_API_KEY` opcional no boot            | Ausência gera `503 MODEL_UNAVAILABLE` só no envio; boot e testes seguem determinísticos | ✅                                           |
| Dedup de fontes por SHA-256 por usuário      | Reenvio idêntico não cria versão, chunk ou vetor; índice único cobre concorrência       | ✅                                           |
| Arquivo original em `bytea`                  | Exclusão atômica com a fonte, sem diretório compartilhado ou nova env var               | ✅                                           |
| Weaviate local com vectorizer `none`         | Vetores vêm do `text-embedding-3-small`; distância cosine e IDs determinísticos         | ✅                                           |
| Adaptador Weaviate por REST/GraphQL          | Compose expõe apenas a porta HTTP 8080; cliente v3 exigiria gRPC 50051                  | ✅                                           |
| Limites provisórios 10 MB / 5 arquivos       | Validação centralizada no domínio e ecoada no web; definição final segue em aberto      | ✅ (follow-up)                               |
| URL como fonte `txt` com marcador MIME       | Reusa o contrato 013 sem migração; hash do texto extraído e retry refaz a busca         | ✅                                           |
| Política SSRF centralizada no domínio        | Validação antes do fetch, no DNS e em cada redirecionamento; host privado nunca buscado | ✅                                           |

---

## 7. Decisões em aberto

| Tema                  | Pergunta                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Deploy da API         | NestJS na Vercel atende limites de execução e filas? Avaliar alternativa (Railway/Fly/Render).   |
| OXLint/OXFmt          | Migrar do ESLint/Prettier atual ou manter?                                                       |
| Multi-tenancy         | Workspace/organização é obrigatório no MVP? Impacta RLS e modelo de dados.                       |
| `packages/shared`     | Quais contratos realmente serão compartilhados entre web e api?                                  |
| PostgreSQL gerenciado | Qual provedor (Neon, RDS, Cloud SQL) será usado em produção?                                     |
| Limites de upload     | Tamanho máximo por arquivo e quantidade por envio definitivos (hoje 10 MB / 5, provisórios).     |
| Retenção de fontes    | Por quanto tempo manter arquivo original, versões antigas, chunks e embeddings após a conexão.   |
| Metas de ingestão     | Latência e custo máximos aceitáveis por arquivo e por página processados.                        |
| Limites de URL        | Timeout, tamanho máximo de resposta e redirecionamentos definitivos (hoje 8 s / 2 MB / 3).       |
| Robots e termos       | Verificar `robots.txt` antes de buscar páginas externas? Hoje apenas conteúdo público é buscado. |

---

## 8. Como manter este documento

Atualize `ARCHITECTURE.md` na mesma mudança que:

- adicionar/remover app ou pacote;
- instalar/remover tecnologia da stack;
- alterar a direção de dependência entre camadas;
- mudar o fluxo de dados ou o modelo de deploy;
- tomar ou revisar uma decisão arquitetural (crie/atualize um ADR em [`.adrs/`](../.adrs/README.md)).

Mantenha a legenda de status e as versões sincronizadas com os `package.json`.
