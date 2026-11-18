# Coders Módulo 4 — Plataforma de Experts

Monorepo da plataforma de **Experts**: agentes de IA especializados por área/posição da empresa
(CEO, CMO, CTO etc.). O produto já entrega catálogo de Experts, chat em persona com histórico
isolado, fontes de conhecimento (arquivo, URL e mídia), recuperação vetorial com citações,
entregáveis multimídia e observabilidade/avaliação local-first.

> **Estado:** specs `000`–`018` entregues. A spec `018` é local-first: instrumentação, sink HTTP e
> evaluation offline estão prontos; a stack LangSmith licenciada, Studio e validação ao vivo
> permanecem bloqueados (ver [`.docs/OBSERVABILITY.md`](./.docs/OBSERVABILITY.md)).
>
> A fonte de verdade sobre produto, arquitetura, padrões, IA e QA está em [`.docs/`](./.docs).
> Comece por [`.docs/AGENTS.md`](./.docs/AGENTS.md).

---

## Stack

| Camada                 | Tecnologia                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ |
| Monorepo               | Turborepo 2 + Bun 1.4 (Node >= 24)                                             |
| Web                    | Next.js 16 (App Router) + React 19                                             |
| UI                     | Tailwind CSS 4 + shadcn/ui (`packages/ui`), light-only                         |
| API                    | NestJS 12 + TypeScript (CommonJS), camadas + vertical slices                   |
| Auth                   | JWT HS256 (`jose`) + registro server-side, scrypt nativo, cookie `HttpOnly`    |
| E-mail                 | Mailtrap (dev/test, modo sandbox) / Resend (produção)                          |
| Banco relacional       | PostgreSQL 18 via Compose (`pg` + SQL parametrizado + migrações próprias)      |
| Busca vetorial         | Weaviate local (REST/GraphQL, `vectorizer: none`, distância cosine)            |
| IA / orquestração      | LangChain.js + LangGraph, OpenAI (`gpt-4o-mini`, embeddings), provider Gemini  |
| Mídia                  | OCR/transcrição local para conhecimento; geração de imagem/vídeo assíncrona    |
| Observabilidade        | OpenTelemetry → Grafana LGTM; spans locais tipo LangSmith + evaluation offline |
| Testes                 | Vitest + Supertest (API), Vitest (web), Playwright (E2E), k6 (carga)           |
| Lint / formato / hooks | ESLint + Prettier + Lefthook/lint-staged + commitlint                          |

---

## Pré-requisitos

- **Node.js** `>= 24`
- **Bun** `1.4.4`
- **Docker Desktop** em execução (PostgreSQL, LGTM e Weaviate)
- **Playwright Chromium** na primeira execução dos testes E2E:

```sh
bun x playwright install chromium
```

> O PostgreSQL, o LGTM e o Weaviate sobem pelo `docker-compose.yml`; não há CLI de banco nem
> servidor vetorial para instalar globalmente.

---

## Setup

```sh
bun install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
bun run infra:up            # PostgreSQL 18 + LGTM + Weaviate
bun run db:migrate          # aplica as migrações pendentes
bun run dev                 # web (3000) e API (3333)
```

Atalho equivalente: `bun run local:setup` (instala, cria `.env`, sobe a infra e migra).

O `.env` contém apenas valores locais de demonstração. **Nunca commite `.env`, chaves de modelo,
tokens ou credenciais.** A API valida as variáveis no boot e falha com mensagem clara, sem
imprimir valores, quando uma chave obrigatória está ausente ou inválida.

### Chaves do `.env` (apenas nomes)

A referência completa, com defaults e comentários, é o `.env.example`. Nenhum valor real deve ser
documentado, logado ou versionado.

| Área            | Variáveis                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serviços        | `PORT`, `WEB_ORIGIN`, `API_BASE_URL`, `NODE_ENV`                                                                                                                                                                                                                                                                                                                  |
| Banco           | `DATABASE_URL`                                                                                                                                                                                                                                                                                                                                                    |
| Auth / e-mail   | `JWT_SECRET`, `SESSION_TTL_SECONDS`, `CONFIRMATION_TOKEN_TTL_SECONDS`, `RESET_TOKEN_TTL_SECONDS`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAILTRAP_API_TOKEN`, `MAILTRAP_SANDBOX`, `MAILTRAP_SANDBOX_ID`, `RESEND_API_KEY`                                                                                                                                          |
| Rate limit      | `SIGN_UP_RATE_LIMIT_MAX`, `SIGN_UP_RATE_LIMIT_WINDOW_SECONDS`, `CONFIRMATION_RATE_LIMIT_MAX`, `CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS`, `FORGOT_PASSWORD_RATE_LIMIT_MAX`, `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS`, `SIGN_IN_RATE_LIMIT_MAX`, `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS`, `RESET_PASSWORD_RATE_LIMIT_MAX`, `RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS` |
| Modelos         | `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_API_BASE_URL`, `EXPERT_PROMPT_MAX_LENGTH`                                                                                                                                                                                                                                                      |
| RAG / citações  | `RAG_CITATIONS_ENABLED`, `RAG_TOP_K`, `RAG_THRESHOLD`, `RAG_MAX_CONTEXT_CHARS`, `RAG_MAX_HISTORY_MESSAGES`                                                                                                                                                                                                                                                        |
| Weaviate        | `WEAVIATE_URL`, `WEAVIATE_PORT`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `WEAVIATE_DISTANCE`                                                                                                                                                                                                                                                                   |
| Multimídia      | `MULTIMEDIA_DELIVERABLES_ENABLED`, `MEDIA_IMAGE_MODEL_ID`, `MEDIA_VIDEO_MODEL_ID`, `MEDIA_IMAGE_QUOTA_PER_HOUR`, `MEDIA_VIDEO_QUOTA_PER_HOUR`, `MEDIA_QUOTA_WINDOW_SECONDS`, `MEDIA_MAX_FILE_BYTES`                                                                                                                                                               |
| Observabilidade | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `LANGSMITH_TRACING_ENABLED`, `LANGSMITH_ENDPOINT`, `LANGSMITH_API_KEY`, `OBS_USER_PSEUDONYM_SALT`, `OBS_TRACE_BATCH_SIZE`, `OBS_TRACE_FLUSH_INTERVAL_MS`                                                                                                                                                      |

> O servidor MCP opcional do Grafana usa `GRAFANA_URL` e `GRAFANA_SERVICE_ACCOUNT_TOKEN` em
> `.mcp.json`, **fora** do `.env`. Nunca versionar o token; a configuração do repositório apenas
> referencia o nome da variável.
>
> Gere um `JWT_SECRET` local com `openssl rand -base64 48` (ou equivalente). O valor vazio no
> `.env.example` é intencional: a API falha no boot se o segredo estiver ausente ou curto.
> As flags de IA/multimídia e o tracing LangSmith são **desligadas por padrão**; verifique o
> comportamento atual diretamente em `.env.example` e em
> [`.docs/AI.md`](./.docs/AI.md) antes de habilitá-las.

---

## Comandos

Execute na raiz do monorepo:

| Comando                   | O que faz                                                    |
| ------------------------- | ------------------------------------------------------------ |
| `bun run dev`             | Sobe web (3000) e API (3333)                                 |
| `bun run build`           | Build de todos os apps/pacotes via Turbo                     |
| `bun run lint`            | ESLint em todos os apps/pacotes                              |
| `bun run lint:commit`     | Valida a mensagem de commit preparada (Conventional Commits) |
| `bun run code:fix`        | ESLint `--fix` + Prettier em código, JSON, CSS e YAML        |
| `bun run format`          | Prettier em `**/*.{ts,tsx,md}`                               |
| `bun run types:check`     | Checagem de tipos em todos os apps/pacotes                   |
| `bun run test`            | Testes unitários e de integração da API e do web (Vitest)    |
| `bun run test:watch`      | Vitest em modo watch (API e web)                             |
| `bun run test:e2e`        | E2E do web (Playwright, com API fake local)                  |
| `bun run infra:up`        | Sobe PostgreSQL, LGTM e Weaviate (Compose)                   |
| `bun run infra:down`      | Para a infra (idempotente)                                   |
| `bun run db:migrate`      | Aplica migrações pendentes no PostgreSQL local               |
| `bun run db:test`         | Executa os testes SQL de `db/tests/`                         |
| `bun run obs:eval`        | Evaluation offline determinística dos datasets de IA         |
| `bun run load:seed`       | Semeia dados para testes de carga (`load:clean` limpa)       |
| `bun run load:smoke`      | k6: smoke                                                    |
| `bun run load:load`       | k6: carga sustentada                                         |
| `bun run load:stress`     | k6: estresse                                                 |
| `bun run load:spike`      | k6: pico                                                     |
| `bun run load:soak`       | k6: soak                                                     |
| `bun run load:rate-limit` | k6: limite de requisições                                    |
| `bun run env:setup`       | Copia `.env.example` para `.env`                             |
| `bun run local:setup`     | `install` + `env:setup` + `infra:up` + `db:migrate`          |

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
criado. Para validar manualmente a última mensagem preparada: `bun run lint:commit`.

### Publicação

Ao final de cada spec, o fluxo `commit-and-push` analisa o diff, cria o commit e faz push:

```text
/commit-and-push
```

O comando está em `.agents/commands/commit-and-push.md`, segue Conventional Commits e inclui
o trailer:

```text
Co-authored-by: OpenCode Agent <noreply@opencode.ai>
```

Fora da execução de uma spec, use o comando apenas com pedido explícito. O commit inicial do
starter (`Initial commit from create-turbo`) é anterior à regra; não reescreva o histórico por
causa disso.

---

## Portas

| Serviço                    | URL / porta             |
| -------------------------- | ----------------------- |
| Web                        | <http://localhost:3000> |
| API                        | <http://localhost:3333> |
| Grafana (LGTM)             | <http://localhost:3010> |
| OTLP gRPC                  | `localhost:4317`        |
| OTLP HTTP                  | `localhost:4318`        |
| PostgreSQL                 | `localhost:5432`        |
| Weaviate (REST/GraphQL)    | `localhost:8080`        |
| LangSmith local (opcional) | `localhost:1980`        |

O Grafana do LGTM sobe com acesso anônimo (Admin) e recebe logs, métricas e traces da API.
Use `service_name="coders-modulo-4-api"` em Loki/Tempo e o dashboard **API Overview** provisionado.
O coletor `postgres-metrics` publica métricas do banco com `service.name = coders-modulo-4-postgres`.

---

## Estrutura

```text
.
├── apps/
│   ├── web/                     # Next.js — porta 3000
│   └── api/                     # NestJS — porta 3333
│       └── src/modules/
│           ├── auth/            # sign-up, confirmação, sign-in/out, recuperação
│           ├── experts/         # catálogo de Experts
│           ├── conversations/   # chat, histórico, responder via LangGraph
│           ├── sources/         # arquivos, URLs e mídia como conhecimento
│           ├── citations/       # recuperação vetorial e citações
│           ├── media/           # geração de imagem/vídeo e cota
│           ├── observability/   # spans locais, sanitização e evaluation
│           ├── hello/ e shared/ # healthcheck e infra compartilhada
├── packages/
│   ├── ui/                      # Tailwind/shadcn, tokens e componentes compartilhados
│   ├── eslint-config/           # Configurações ESLint compartilhadas
│   └── typescript-config/       # tsconfig base/nextjs/react-library
├── observability/               # dashboards, gerador, coletor Postgres e LGTM built-ins
├── eval/datasets/               # datasets sintéticos da evaluation offline
├── load-tests/                  # cenários k6 e seed
├── scripts/                     # infra, migrações, k6 e CLI de evaluation
├── db/                          # migrações versionadas e testes de schema
├── docker-compose.yml           # PostgreSQL 18 + LGTM + Weaviate
├── docker-compose.langsmith.yml # override opcional (profile `langsmith`, licenciado)
├── .docs/                       # Documentação do projeto (fonte de verdade)
├── .adrs/                       # Architecture Decision Records (ADRs)
├── .specs/ / .plans/            # Specs e planos de execução
├── .agents/ / .claude/          # Skills e comandos de agentes
└── turbo.json / package.json / bun.lock
```

Cada slice da API segue `domain → application → infrastructure → interface`, com um caso de uso
por fluxo e um request handler por endpoint. Detalhes em
[`.docs/ARCHITECTURE.md`](./.docs/ARCHITECTURE.md).

---

## Auth e sessão

Autenticação própria da API, versionada em `/api/v1`:

| Rota                                | Comportamento                                                   |
| ----------------------------------- | --------------------------------------------------------------- |
| `GET /api/v1/hello`                 | Hello world (200)                                               |
| `GET /api/v1/auth/me`               | Dados da pessoa autenticada (200) ou 401 do contrato            |
| `POST /api/v1/auth/sign-up`         | Cria conta e envia e-mail de confirmação                        |
| `POST /api/v1/auth/confirm`         | Confirma conta, emite sessão e envia e-mail de nova sessão      |
| `POST /api/v1/auth/sign-in`         | Autentica, revoga sessões anteriores e aceita `returnTo` seguro |
| `POST /api/v1/auth/sign-out`        | `204`, revoga a sessão atual e invalida o JWT                   |
| `POST /api/v1/auth/forgot-password` | Emite token de recuperação                                      |
| `POST /api/v1/auth/reset-password`  | Troca a senha e revoga sessões                                  |
| Qualquer rota fora do prefixo       | 404 com o contrato de erro                                      |

- Sessão = JWT HS256 (`sub`, `sid`, `iat`, `exp`) + registro em `sessions`; toda requisição
  autenticada confere se a sessão está ativa. Sessão única: um novo login revoga os anteriores.
- O web guarda o token no cookie `session_token` (`HttpOnly`, `SameSite=Lax`, `Secure` em
  produção); o servidor do Next lê o cookie e envia `Authorization: Bearer` (`apps/web/lib/auth`).
  O token nunca vai para o JavaScript do navegador.
- E-mails usam o provedor selecionado por `NODE_ENV`: Mailtrap em dev/test e Resend em produção.
  Com `MAILTRAP_SANDBOX=true`, os envios aparecem na **Email Testing → Inbox** do Mailtrap — não em
  Email Logs. Links de confirmação/retorno usam a origem configurada (`WEB_ORIGIN`, por padrão
  `http://localhost:3000`).
- Erros seguem `{ code, message, fieldErrors? }`, sem stack, SQL ou detalhes internos.
- Rate limits de auth são **locais ao processo** (em memória); um store compartilhado é follow-up.

### Navegação e idioma

| Rota                    | Acesso  | Comportamento                                         |
| ----------------------- | ------- | ----------------------------------------------------- |
| `/`                     | Público | Landing; com sessão válida → `/app`                   |
| `/auth/sign-up`         | Público | Cadastro real; com sessão → `/app`                    |
| `/auth/sign-in`         | Público | Login real com `returnTo` seguro; com sessão → `/app` |
| `/auth/confirm`         | Público | Confirmação via token; com sessão → `/app`            |
| `/auth/forgot-password` | Público | Solicitação de recuperação                            |
| `/auth/reset-password`  | Público | Troca de senha via token                              |
| `/app` e `/app/*`       | Privado | Shell do produto; sem sessão válida → `/auth/sign-up` |

- O guard de `/app/*` é server-side: lê o cookie e confirma a sessão em `GET /api/v1/auth/me`;
  erro, `401` ou ausência de cookie contam como sem sessão. A API continua validando toda chamada.
- Todo texto de produto (UI, metadados e e-mails), rotas e endpoints é **en-US**; a documentação
  interna é PT-BR.
- O E2E do web usa uma API fake local (`127.0.0.1:3434`) via override de `API_BASE_URL`, sem banco
  compartilhado nem `JWT_SECRET`.

---

## Produto e IA

- **Experts:** catálogo en-US servido pela API (`GET /api/v1/experts`); o chat mantém persona e
  histórico isolados por `(userId, expertId)`.
- **Fontes:** upload de PDF/TXT/Markdown com deduplicação por SHA-256, chunks, embeddings e
  gravação no Weaviate; conexão de URLs públicas com validação SSRF; imagem/áudio/vídeo
  convertidos em texto por OCR/transcrição local.
- **RAG e citações:** recuperação vetorial com `topK`/limiar configuráveis, contexto injetado na
  resposta, citações inline e painel de fontes, controlados por `RAG_CITATIONS_ENABLED`.
- **Multimídia:** geração assíncrona de imagem/vídeo com cota por hora, job persistido e anexo no
  chat, controlada por `MULTIMEDIA_DELIVERABLES_ENABLED`.
- **Avaliação:** quatro datasets sintéticos e scorer determinístico (`bun run obs:eval`), sem
  chamada a modelo externo.

Contratos, flags, limites e decisões abertas: [`.docs/AI.md`](./.docs/AI.md).

---

## Observabilidade

- **OpenTelemetry nativo:** logs JSON no console e via OTLP, métricas `http.server.*`, spans manuais
  de banco (`<OPERAÇÃO> <tabela>`) e dashboard **API Overview** no Grafana. As requisições HTTP
  recebem `requestId` (header `x-request-id`) e geram o log `HTTP request completed`.
- **Spans locais tipo LangSmith (spec 018):** flag `LANGSMITH_TRACING_ENABLED` desligada por padrão;
  quando ligada, envia spans de chat/recuperação/geração para um coletor local, com sanitização,
  pseudonimização e fallback gracioso. Não é a stack LangSmith licenciada.
- **Avaliação offline:** `bun run obs:eval` (detalhes em
  [`eval/datasets/README.md`](./eval/datasets/README.md)).
- **Limites conhecidos:** os três identificadores (`requestId`, `traceId` OTel, `traceId` local)
  ainda não são unificados; não há alertas provisionados nem métricas de domínio (custo, RAG,
  mídia, fila). Inventário e runbook em
  [`.docs/OBSERVABILITY.md`](./.docs/OBSERVABILITY.md).

---

## Status

- ✅ Fundação (000), auth/schema/sessão/rotas e fluxos (001–008), PostgreSQL nativo (009),
  provedor de e-mail por `NODE_ENV` (010), redesign da UI e landing (011).
- ✅ Plataforma de Experts (012–017): catálogo e chat, fontes de arquivo/URL/mídia, RAG com
  citações e entregáveis multimídia.
- ✅ Observabilidade local-first e evaluation offline (018); stack licenciada bloqueada.
- ✅ Scripts de QA, carga (`load:*`), evaluation (`obs:eval`) e setup local.
- 🧭 Em aberto: deploy da API, CI (`.github/workflows`), multi-tenancy/RLS, provedor PostgreSQL
  gerenciado, limites definitivos de upload/URL, retenção de fontes, alertas e métricas de domínio,
  correlação unificada de IDs e validação da stack LangSmith licenciada.
- ❌ Fora de escopo atual: dark mode, OXLint/OXFmt e `packages/shared`.

Detalhes e decisões: [`.docs/ARCHITECTURE.md`](./.docs/ARCHITECTURE.md),
[`.docs/AI.md`](./.docs/AI.md) e [`.specs/README.md`](./.specs/README.md).

---

## Notas de ambiente

- O Docker Desktop em Windows usa containerd snapshotter; arquivos de imagem podem ficar com
  0 byte após atualizações. Se um container falhar com binário vazio (ex.: `node`), recrie a
  imagem local com `docker pull` antes de investigar o código.
- O PostgreSQL local roda na imagem `postgres:18-alpine` com volume nomeado. O schema é aplicado
  por `bun run db:migrate`; os dados locais são descartáveis.
- Em PowerShell, o Bun pode emitir `NativeCommandError` como ruído; confira o código de saída
  (`$LASTEXITCODE`) antes de concluir que o comando falhou.

---

## Documentação

| Documento                                              | Conteúdo                                              |
| ------------------------------------------------------ | ----------------------------------------------------- |
| [`.docs/AGENTS.md`](./.docs/AGENTS.md)                 | Ponto de entrada e fluxo de trabalho                  |
| [`.docs/RULES.md`](./.docs/RULES.md)                   | Regras obrigatórias do projeto                        |
| [`.docs/ARCHITECTURE.md`](./.docs/ARCHITECTURE.md)     | Estrutura, stack, contratos e decisões                |
| [`.docs/AI.md`](./.docs/AI.md)                         | Experts, RAG, mídia, modelos, flags e segurança de IA |
| [`.docs/OBSERVABILITY.md`](./.docs/OBSERVABILITY.md)   | Telemetria, dashboards, runbook e avaliação           |
| [`.docs/DEVELOPMENT.md`](./.docs/DEVELOPMENT.md)       | Padrões de engenharia                                 |
| [`.docs/QA.md`](./.docs/QA.md)                         | Comandos, verificações, evidências e DoD              |
| [`.docs/DESIGN.md`](./.docs/DESIGN.md)                 | Direção visual                                        |
| [`.docs/DESIGN_SYSTEM.md`](./.docs/DESIGN_SYSTEM.md)   | Tailwind, shadcn e tokens                             |
| [`.docs/BUSINESS.md`](./.docs/BUSINESS.md)             | Produto, Experts e conectores                         |
| [`.specs/README.md`](./.specs/README.md)               | Specs `000`–`018` e índice navegável                  |
| [`.adrs/README.md`](./.adrs/README.md)                 | Decisões arquiteturais (ADRs)                         |
| [`eval/datasets/README.md`](./eval/datasets/README.md) | Esquema e execução dos datasets de avaliação          |
| [`load-tests/README.md`](./load-tests/README.md)       | Cenários k6 e leitura de resultados                   |
