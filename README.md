# Coders Módulo 4 — Fundação

Monorepo da plataforma de **Experts**: agentes de IA especializados por área/posição da empresa.
Esta entrega é a **fundação** do projeto — web, API, banco local, testes, observabilidade e
infraestrutura de sessão de auth — e **não** implementa ainda funcionalidades de produto.

> A fonte de verdade sobre produto, arquitetura, padrões e QA está em [`.docs/`](./.docs).
> Comece por [`.docs/AGENTS.md`](./.docs/AGENTS.md).

---

## Stack

| Camada                 | Tecnologia                                             |
| ---------------------- | ------------------------------------------------------ |
| Monorepo               | Turborepo 2 + Bun 1.4                                  |
| Web / Docs             | Next.js 16 (App Router) + React 19                     |
| UI                     | Tailwind CSS 4 + shadcn/ui (`packages/ui`)             |
| API                    | NestJS 12 + TypeScript (CommonJS)                      |
| Sessão / e-mail        | jose (JWT HS256) + SDK Mailtrap (API de envio)         |
| Banco / Auth / Storage | Supabase local via CLI 3 (`@supabase/supabase-js`)     |
| Testes                 | Vitest + Supertest (API), Vitest (web) e Playwright    |
| Observabilidade        | OpenTelemetry → Grafana LGTM (métricas, logs e traces) |
| Lint / formato         | ESLint + Prettier + Lefthook/lint-staged               |

---

## Pré-requisitos

- **Node.js** `>= 24`
- **Bun** `1.4.4`
- **Docker Desktop** em execução (Supabase local e LGTM)
- **Playwright Chromium** na primeira execução dos testes E2E:

```sh
bun x playwright install chromium
```

> A CLI do Supabase é devDependency e é executada com `bun x supabase`; não é necessário
> instalar globalmente.

---

## Setup

```sh
bun install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
bun run infra:up            # LGTM + Supabase local
bun run db:migrate          # aplica as migrações pendentes
bun run dev                 # web, docs e API em paralelo
```

O `.env` contém apenas valores locais de demonstração. **Nunca commite `.env` nem credenciais
reais.** A API valida as variáveis no boot e falha com mensagem clara (sem imprimir valores)
quando alguma chave está ausente ou inválida.

### Chaves do `.env`

| Variável                      | Uso                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `PORT`                        | Porta da API (padrão `3333`)                                                       |
| `WEB_ORIGIN`                  | Origem liberada no CORS (`http://localhost:3000`)                                  |
| `SUPABASE_URL`                | URL da API local do Supabase                                                       |
| `SUPABASE_ANON_KEY`           | Chave pública local                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`   | Chave de serviço local (nunca use em produção)                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP gRPC do LGTM (`http://localhost:4317`)                               |
| `OTEL_SERVICE_NAME`           | Nome do serviço na telemetria                                                      |
| `JWT_SECRET`                  | Segredo HS256 do JWT (obrigatório, ≥ 32 caracteres)                                |
| `SESSION_TTL_SECONDS`         | Duração da sessão em segundos (padrão `604800`)                                    |
| `MAILTRAP_API_TOKEN`          | Token da API do Mailtrap (obrigatório, segredo)                                    |
| `MAIL_FROM_EMAIL`             | Remetente; domínio verificado no Mailtrap Sending (padrão `hello@demomailtrap.co`) |
| `MAIL_FROM_NAME`              | Nome do remetente (padrão `Experts`)                                               |
| `API_BASE_URL`                | URL da API usada pelo servidor do web                                              |

> Gere um `JWT_SECRET` local com `openssl rand -base64 48` (ou equivalente). O valor vazio no
> `.env.example` é intencional: a API falha no boot se o segredo estiver ausente ou curto.

---

## Comandos

Execute na raiz do monorepo:

| Comando               | O que faz                                                    |
| --------------------- | ------------------------------------------------------------ |
| `bun run dev`         | Sobe web (3000) e API (3333)                                 |
| `bun run build`       | Build de todos os apps/pacotes via Turbo                     |
| `bun run lint`        | ESLint em todos os apps/pacotes                              |
| `bun run lint:commit` | Valida a mensagem de commit preparada (Conventional Commits) |
| `bun run code:fix`    | ESLint `--fix` + Prettier em código, JSON, CSS e YAML        |
| `bun run format`      | Prettier em `**/*.{ts,tsx,md}`                               |
| `bun run types:check` | Checagem de tipos em todos os apps/pacotes                   |
| `bun run test`        | Testes unitários e de integração da API e do web (Vitest)    |
| `bun run test:watch`  | Vitest em modo watch (API e web)                             |
| `bun run test:e2e`    | E2E de navegação do web (Playwright + API fake local)        |
| `bun run infra:up`    | Sobe LGTM (Compose) e Supabase local                         |
| `bun run infra:down`  | Para Supabase e LGTM (idempotente)                           |
| `bun run db:migrate`  | Aplica migrações pendentes no Supabase local                 |
| `bun run db:test`     | Executa os testes pgTAP de `supabase/tests/`                 |

> Use sempre `bun run <script>`. `bun test` e `bun build` são comandos nativos do Bun e **não**
> executam os scripts do monorepo.

Executar em um pacote específico:

```sh
bunx turbo lint --filter=web --only
bunx turbo types:check --filter=api --only
bunx turbo build --filter=web
```

---

## Commits

As mensagens seguem [Conventional Commits](https://www.conventionalcommits.org/):

```text
<tipo>(<escopo opcional>): <descrição no imperativo>
```

Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore` e `revert`. A descrição é em inglês, no imperativo, sem ponto final.

```sh
git commit -m "feat: add expert onboarding"
git commit -m "fix(api): reject invalid env"
git commit -m "docs: document commit conventions"
```

O hook `commit-msg` do Lefthook valida a mensagem com o **commitlint** antes de o commit ser
criado. Para validar manualmente a última mensagem preparada:

```sh
bun run lint:commit
```

### Publicação

Ao final de cada spec, o fluxo `commit-and-push` analisa o diff, cria o commit e faz push:

```text
/commit-and-push
```

O comando está em `.opencode/commands/commit-and-push.md`, segue Conventional Commits e inclui
o trailer:

```text
Co-authored-by: OpenCode Agent <noreply@opencode.ai>
```

Fora da execução de uma spec, use o comando apenas com pedido explícito.

O commit inicial do starter (`Initial commit from create-turbo`) é anterior à regra e não segue
o padrão; não reescreva o histórico por causa disso.

---

## Portas

| Serviço         | URL                      |
| --------------- | ------------------------ |
| Web             | <http://localhost:3000>  |
| API             | <http://localhost:3333>  |
| Grafana (LGTM)  | <http://localhost:3010>  |
| OTLP gRPC       | `localhost:4317`         |
| OTLP HTTP       | `localhost:4318`         |
| Supabase API    | <http://localhost:54321> |
| Supabase DB     | `localhost:54322`        |
| Supabase Studio | <http://localhost:54323> |

O Grafana do LGTM sobe com acesso anônimo (Admin) e já recebe logs, métricas e traces da API.
Consulte `service_name="coders-modulo-4-api"` em Loki, Tempo ou Prometheus.

---

## Estrutura

```text
.
├── apps/
│   ├── web/                     # Next.js — porta 3000
│   └── api/                     # NestJS — porta 3333
├── packages/
│   ├── ui/                      # Tailwind/shadcn, tokens e componentes compartilhados
│   ├── eslint-config/           # Configurações ESLint compartilhadas
│   └── typescript-config/       # tsconfig base/nextjs/react-library
├── scripts/infra.mjs            # Orquestra Compose (LGTM) + Supabase CLI
├── supabase/                    # config.toml e migrações
├── docker-compose.yml           # LGTM: Grafana + OTel Collector + Loki/Tempo/Prometheus
├── .docs/                       # Documentação do projeto (fonte de verdade)
├── .adrs/                       # Architecture Decision Records (ADRs)
├── .specs/                      # Specs de feature
├── .plans/                      # Planos de execução
├── .opencode/commands/          # Comandos do OpenCode (ex.: commit-and-push)
├── turbo.json
├── package.json
└── bun.lock
```

A API segue arquitetura em camadas + vertical slices:

```text
apps/api/src/
├── modules/
│   ├── auth/{domain,application,infrastructure,interface}
│   ├── hello/{domain,application,interface}
│   └── shared/{config,logging,observability,interface}
├── test/fakes/                  # repositórios, e-mail e token em memória
├── app.module.ts
├── app-setup.ts
└── main.ts
```

---

## Auth e sessão

A autenticação é própria da API (sem Supabase Auth) e a API é versionada em `/api/v1`:

| Rota                          | Comportamento                                                |
| ----------------------------- | ------------------------------------------------------------ |
| `GET /api/v1/hello`           | Hello world (200)                                            |
| `GET /api/v1/auth/me`         | Dados básicos da pessoa autenticada (200) ou 401 do contrato |
| Qualquer rota fora do prefixo | 404 com o contrato de erro                                   |

- Sessão = JWT HS256 (`sub`, `sid`, `iat`, `exp`) + registro em `sessions`; toda requisição
  autenticada confere se a sessão está ativa. Sessão única: um novo login revoga os anteriores.
- O web guarda o token no cookie `session_token` (`HttpOnly`, `SameSite=Lax`, `Secure` em
  produção); o servidor do Next lê o cookie e envia `Authorization: Bearer` (`apps/web/lib/auth`).
  O token nunca vai para o JavaScript do navegador.
- O e-mail de nova sessão é enviado pela API do Mailtrap; consulte os envios nos logs
  (<https://mailtrap.io/sending/email_logs>). A fatia entrega a infraestrutura; páginas públicas de confirmação,
  sign-in, sign-out e recuperação de senha entram nas fatias 004–008.
- Erros seguem `{ code, message, fieldErrors? }`, sem stack, SQL ou detalhes internos.

### Navegação e idioma

O web separa o fluxo público da área privada em dois grupos de rota:

| Rota                    | Acesso  | Comportamento                                         |
| ----------------------- | ------- | ----------------------------------------------------- |
| `/`                     | Público | Sessão válida → `/app`; sem sessão → `/auth/sign-up`  |
| `/auth/sign-up`         | Público | Placeholder; com sessão → `/app`                      |
| `/auth/sign-in`         | Público | Placeholder; com sessão → `/app`                      |
| `/auth/confirm`         | Público | Placeholder; com sessão → `/app`                      |
| `/auth/forgot-password` | Público | Placeholder; acessível com ou sem sessão              |
| `/auth/reset-password`  | Público | Troca de senha com token; acessível com ou sem sessão |
| `/app` e `/app/*`       | Privado | Shell privado; sem sessão válida → `/auth/sign-up`    |

- O guard de `/app/*` é server-side: lê o cookie e confirma a sessão em `GET /api/v1/auth/me`;
  erro, `401` ou ausência de cookie contam como sem sessão. A API continua validando toda chamada.
- Todo texto de produto (UI, metadados e e-mails), rotas e endpoints é **en-US**; a documentação
  interna é PT-BR.
- O E2E do web usa uma API fake local (`127.0.0.1:3434`) via override de `API_BASE_URL`, sem banco
  compartilhado nem `JWT_SECRET`.
- As telas de auth e `/app` desta entrega são **placeholders**; os fluxos reais entram nas fatias
  004–008.

---

## Observabilidade

- A API emite **logs estruturados em JSON**, métricas (`http.server.*`) e traces via
  OpenTelemetry (OTLP gRPC).
- O `docker-compose.yml` usa a imagem all-in-one `grafana/otel-lgtm`, que já inclui Grafana,
  OTel Collector, Loki, Tempo e Prometheus.
- O Supabase Analytics fica desabilitado em `supabase/config.toml`: o coletor `vector` depende do
  Docker API em `host.docker.internal:2375`, porta não exposta por padrão no Docker Desktop. A
  observabilidade da aplicação não depende dele.

---

## Status

- ✅ Fundação implementada: web, docs, API, Supabase local, migrações, testes, lint/tipos/build e
  observabilidade.
- ✅ Scripts `code:fix`, `types:check`, `test`, `test:watch`, `test:e2e`, `infra:up`,
  `infra:down`, `db:migrate` e `db:test`.
- ✅ Infraestrutura de sessão (spec 002): JWT HS256 + sessão server-side, `GET /api/v1/auth/me`,
  ponte de cookie `HttpOnly` no web, contrato de erro, hello em `/api/v1` e e-mail de nova sessão.
- ✅ Navegação de auth (spec 003): `/auth/*` público com placeholders en-US, `/app/*` privado com
  shell e guard server-side, raiz redirecionando por sessão e CORS restrito à origem do web.
- 🧭 Fluxos públicos de auth (confirmação, sign-in, sign-out e recuperação de senha), produto,
  multi-tenancy/RLS, deploy e CI ainda não implementados.
- 🧭 `packages/shared`, OXLint/OXFmt, date-fns, TanStack e hash de senha fora desta entrega.

Detalhes e decisões: [`.docs/ARCHITECTURE.md`](./.docs/ARCHITECTURE.md) e
[`.specs/000-foundation.md`](./.specs/000-foundation.md).

---

## Notas de ambiente

- O Docker Desktop em Windows usa containerd snapshotter; arquivos de imagem podem ficar com
  0 byte após atualizações. Se um container falhar com binário vazio (ex.: `node`), recrie a
  imagem local com `docker pull` antes de investigar o código.
- O Supabase local está configurado com PostgreSQL `15` (`supabase/config.toml`) como workaround
  de ambiente. Ajuste apenas com justificativa e atualize a documentação.
- Em PowerShell, o Bun pode emitir `NativeCommandError` como ruído; confira o código de saída
  (`$LASTEXITCODE`) antes de concluir que o comando falhou.

---

## Documentação

| Documento                                            | Conteúdo                             |
| ---------------------------------------------------- | ------------------------------------ |
| [`.docs/AGENTS.md`](./.docs/AGENTS.md)               | Ponto de entrada e fluxo de trabalho |
| [`.docs/RULES.md`](./.docs/RULES.md)                 | Regras obrigatórias do projeto       |
| [`.docs/ARCHITECTURE.md`](./.docs/ARCHITECTURE.md)   | Estrutura, stack e decisões          |
| [`.docs/DEVELOPMENT.md`](./.docs/DEVELOPMENT.md)     | Padrões de engenharia                |
| [`.docs/QA.md`](./.docs/QA.md)                       | Comandos, verificações e DoD         |
| [`.docs/DESIGN.md`](./.docs/DESIGN.md)               | Direção visual                       |
| [`.docs/DESIGN_SYSTEM.md`](./.docs/DESIGN_SYSTEM.md) | Tailwind, shadcn e tokens            |
| [`.docs/BUSINESS.md`](./.docs/BUSINESS.md)           | Produto, Experts e conectores        |
| [`.adrs/README.md`](./.adrs/README.md)               | Decisões arquiteturais (ADRs)        |
