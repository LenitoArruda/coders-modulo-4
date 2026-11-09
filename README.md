# Coders Módulo 4 — Fundação

Monorepo da plataforma de **Experts**: agentes de IA especializados por área/posição da empresa.
Esta entrega é a **fundação** do projeto — web, API, banco local, testes e observabilidade — e
**não** implementa ainda funcionalidades de produto.

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
| Banco / Auth / Storage | Supabase local via CLI 3                               |
| Testes                 | Vitest + Supertest (API) e Playwright (web)            |
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

| Variável                      | Uso                                                  |
| ----------------------------- | ---------------------------------------------------- |
| `PORT`                        | Porta da API (padrão `3333`)                         |
| `WEB_ORIGIN`                  | Origem liberada no CORS (`http://localhost:3000`)    |
| `SUPABASE_URL`                | URL da API local do Supabase                         |
| `SUPABASE_ANON_KEY`           | Chave pública local                                  |
| `SUPABASE_SERVICE_ROLE_KEY`   | Chave de serviço local (nunca use em produção)       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP gRPC do LGTM (`http://localhost:4317`) |
| `OTEL_SERVICE_NAME`           | Nome do serviço na telemetria                        |

---

## Comandos

Execute na raiz do monorepo:

| Comando               | O que faz                                                    |
| --------------------- | ------------------------------------------------------------ |
| `bun run dev`         | Sobe web (3000), docs (3001) e API (3333)                    |
| `bun run build`       | Build de todos os apps/pacotes via Turbo                     |
| `bun run lint`        | ESLint em todos os apps/pacotes                              |
| `bun run lint:commit` | Valida a mensagem de commit preparada (Conventional Commits) |
| `bun run code:fix`    | ESLint `--fix` + Prettier em código, JSON, CSS e YAML        |
| `bun run format`      | Prettier em `**/*.{ts,tsx,md}`                               |
| `bun run types:check` | Checagem de tipos em todos os apps/pacotes                   |
| `bun run test`        | Testes unitários e de integração da API (Vitest)             |
| `bun run test:watch`  | Vitest em modo watch                                         |
| `bun run test:e2e`    | Smoke E2E do web (Playwright)                                |
| `bun run infra:up`    | Sobe LGTM (Compose) e Supabase local                         |
| `bun run infra:down`  | Para Supabase e LGTM (idempotente)                           |
| `bun run db:migrate`  | Aplica migrações pendentes no Supabase local                 |

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
| Docs            | <http://localhost:3001>  |
| API             | <http://localhost:3333>  |
| Grafana (LGTM)  | <http://localhost:3010>  |
| OTLP gRPC       | `localhost:4317`         |
| OTLP HTTP       | `localhost:4318`         |
| Supabase API    | <http://localhost:54321> |
| Supabase DB     | `localhost:54322`        |
| Supabase Studio | <http://localhost:54323> |
| Mailpit         | <http://localhost:54324> |

O Grafana do LGTM sobe com acesso anônimo (Admin) e já recebe logs, métricas e traces da API.
Consulte `service_name="coders-modulo-4-api"` em Loki, Tempo ou Prometheus.

---

## Estrutura

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
│   ├── hello/{domain,application,interface}
│   └── shared/{config,logging,observability}
├── app.module.ts
├── app-setup.ts
└── main.ts
```

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
  `infra:down` e `db:migrate`.
- 🧭 Produto, autenticação de usuário final, multi-tenancy/RLS, deploy e CI ainda não
  implementados.
- 🧭 `packages/shared`, OXLint/OXFmt, date-fns, TanStack e bcrypt fora desta entrega.

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
