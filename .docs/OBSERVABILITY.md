# Observabilidade e avaliação local — spec 018

> Status: **implementação local-first entregue; stack LangSmith self-hosted não validada**.
> Atualizado em: 2026-11-18.

Este documento descreve o que existe de telemetria no projeto, como habilitar a instrumentação de
IA, como ler os dashboards e como executar as evaluations offline. Nenhum valor de `.env`, chave,
token, URL sensível, hash, prompt, resposta ou conteúdo de arquivo é registrado aqui.

---

## 1. Estado e bloqueios conhecidos

| Item                                          | Estado             | Motivo                                                   |
| --------------------------------------------- | ------------------ | -------------------------------------------------------- |
| Instrumentação de chat, recuperação e geração | entregue e testada | spans emitidos por injeção opcional                      |
| Coletor HTTP local + fallback gracioso        | entregue e testado | sink `POST {endpoint}/runs` com `x-api-key`              |
| Sanitização e pseudonimização                 | entregue e testada | HMAC-SHA256 com sal server-side                          |
| Evaluation offline determinística             | entregue e testada | 4 datasets sintéticos versionados, CLI com baseline      |
| OpenTelemetry + dashboard LGTM                | entregue e em uso  | logs, métricas, traces e coletor Postgres                |
| LangSmith self-hosted real                    | **bloqueado**      | daemon Docker indisponível na máquina de desenvolvimento |
| Studio e validação ao vivo de traces/grafo    | **bloqueado**      | depende da imagem Enterprise licenciada do self-hosted   |
| CLI de evaluation ao vivo contra LangSmith    | **bloqueado**      | mesma dependência; substituída pela CLI offline local    |
| Alertas provisionados no Grafana              | não implementado   | painel `alertlist` existe, mas não há regras de alerta   |
| Correlação única `requestId`/`traceId`        | não implementada   | três identificadores independentes (ver §6)              |

`docker-compose.langsmith.yml` é um **template opcional**, protegido pelo profile `langsmith`, que
exige `LANGSMITH_IMAGE` e `LANGSMITH_API_KEY` fornecidos por quem possui a licença. Ele não é
usado pelo `bun run infra:up` padrão e não deve ser interpretado como configuração validada.

---

## 2. Inventário e pipeline de telemetria

### 2.1 Arquivos de código na API

| Caminho (relativo a `apps/api/src/`)                         | Papel                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `modules/shared/observability/telemetry.ts`                  | Inicializa `NodeSDK`: OTLP gRPC, métricas, logs, `HttpInstrumentation` |
| `modules/shared/observability/app-logger.ts`                 | `log()`: linha JSON + `logs.getLogger()` do `@opentelemetry/api`       |
| `modules/shared/observability/db-span.ts`                    | `withDbSpan()`: span `CLIENT` `<OPERAÇÃO> <tabela>` para SQL           |
| `modules/shared/logging/json-logger.ts`                      | Ponte `LoggerService` do Nest para o `app-logger`                      |
| `modules/shared/logging/request-logging.middleware.ts`       | `requestId`, log `HTTP request completed`, métricas HTTP               |
| `modules/shared/interface/error-contract.filter.ts`          | Log de exceções não tratadas/5xx com `requestId`                       |
| `modules/observability/domain/trace-span.ts`                 | Schema v1 do span e regras de metadados obrigatórios                   |
| `modules/observability/domain/span-metadata.ts`              | Builders de metadados de mídia e fontes                                |
| `modules/observability/domain/metadata-policy.ts`            | Lista de chaves proibidas e política de remoção                        |
| `modules/observability/domain/pii-sanitizer.ts`              | Máscara recursiva de e-mail/telefone/token                             |
| `modules/observability/domain/user-pseudonym.ts`             | HMAC-SHA256 do `userId` com sal server-side                            |
| `modules/observability/domain/cost-estimator.ts`             | Estimativa de custo por modelo (campo `estimatedCostUsd`)              |
| `modules/observability/domain/evaluation.ts`                 | Scorer puro e determinístico da evaluation offline                     |
| `modules/observability/application/trace-emitter.ts`         | Emissão, sanitização, pseudonimização e dispatch do span               |
| `modules/observability/application/ports/trace-sink.port.ts` | Porta `TraceSinkPort`                                                  |
| `modules/observability/application/evaluation-cli.ts`        | CLI de evaluation e comparação com baseline                            |
| `modules/observability/infrastructure/create-trace-sink.ts`  | Escolhe `NoopTraceSink` ou `HttpTraceSink`                             |
| `modules/observability/infrastructure/http-trace.sink.ts`    | Fila em memória, flush e `fetch` para `/runs`                          |
| `modules/observability/infrastructure/noop-trace.sink.ts`    | Sink desligado                                                         |
| `modules/observability/observability.module.ts`              | Wiring da slice (tokens, emitter, sink)                                |
| `scripts/obs-eval.ts` (na raiz)                              | Entry point do `bun run obs:eval`                                      |

Consumidores do `TraceEmitter`: `SendMessageUseCase` (raiz), `RetrieveContextUseCase`
(recuperação) e `LangGraphExpertResponder` (geração). Repositórios com `withDbSpan`: auth
(usuários, sessões, tokens), sources, conversations, media e citation metadata.

### 2.2 Infraestrutura e dashboards

| Caminho (raiz)                               | Papel                                                           |
| -------------------------------------------- | --------------------------------------------------------------- |
| `docker-compose.yml`                         | Serviços `postgres`, `lgtm`, `postgres-metrics` e `weaviate`    |
| `docker-compose.langsmith.yml`               | Override opcional do LangSmith licenciado (profile `langsmith`) |
| `observability/postgres-collector.yaml`      | Receiver/métricas do Postgres e processamento do coletor        |
| `observability/gen-dashboard.mjs`            | Fonte geradora do dashboard da API                              |
| `observability/dashboards/api-overview.json` | Dashboard provisionado no Grafana                               |
| `observability/dashboards.yaml`              | Provisionamento do painel no LGTM                               |
| `observability/lgtm-builtin-dashboards.yaml` | Ajustes nos dashboards embutidos do LGTM                        |
| `eval/datasets/*.json`                       | Datasets sintéticos da evaluation (ver README do diretório)     |

### 2.3 Fluxo de logs e métricas (OpenTelemetry nativo)

```text
Nest/use cases ──► app-logger ──┬──► stdout/stderr (JSON)
                               └──► logs.getLogger() ──► NodeSDK ──► OTLP ──► Loki (LGTM)
HTTP middleware ──► app-logger ("HTTP request completed")
                 └─► http.server.request.duration / http.server.requests ──► OTLP ──► Prometheus
pg repositories ──► withDbSpan ──► spans OTel ──► OTLP ──► Tempo
NodeSDK ──► HttpInstrumentation ──► spans HTTP ──► OTLP ──► Tempo
postgres-metrics ──► postgresql_* ──► Prometheus
```

- `log()` aceita `debug | info | warn | error`; `JsonLogger` mapeia `log→info`, `warn→warn`,
  `error/fatal→error`, `debug/verbose→debug`. Campos fixos: `timestamp`, `level`, `service`,
  `message` e atributos primitivos (`string | number | boolean`).
- O middleware lê/gera `x-request-id`, devolve o header, guarda `request.requestId` e loga no
  `finish`: `requestId`, `method`, `path`, `statusCode`, `durationMs` e `traceId` quando disponível.
  Nível: `>=500` → `error`, `>=400` → `warn`, demais → `info`.
- Spans de banco usam atributos `db.system`, `db.collection.name`, `db.operation.name`; em erro,
  `db.response.status_code` (SQLSTATE) e `error.type`. Nunca registram SQL, filtros ou mensagem raw.
- `OTEL_SDK_DISABLED=true` desliga o `NodeSDK` e a instrumentação; o `app-logger` continua
  escrevendo JSON no console e os `emit`s caem no provider no-op.

### 2.4 Fluxo de spans locais (spec 018)

```text
SendMessageUseCase (traceId local)
   ├── TraceEmitter(root) ──┐
   ├── RetrieveContext ─────┼──► sanitização ─► pseudonimização ─► TraceSinkPort ──► HttpTraceSink
   └── LangGraphResponder ──┘                                          │                  │
                                                                       └─► Noop (flag off) └─► POST {endpoint}/runs
```

- Flag desligada: `TraceEmitter.emit()` retorna imediatamente, o sink é `NoopTraceSink`, nenhuma
  variável extra é exigida e nenhuma chamada de rede acontece.
- Flag ligada: `loadEnv()` exige endpoint loopback/Docker DNS/RFC1918, chave e salt; endpoint
  público, protocolo inválido ou credenciais embutidas causam `ConfigurationError` no boot.
- Defaults em código: batch 32, flush 1 s; limites de 512 itens e 60 s. Não há sampling: todo
  span emitido entra na fila.
- A fila é um **array em memória sem limite e sem backpressure**; flush por tamanho/tempo e no
  shutdown. Falha gera `obs.trace.dropped` em log e nunca quebra a requisição.

---

## 3. Contrato do span (schema v1)

Campos obrigatórios em `extra.metadata`: `traceId`, `conversationId`, `messageId`, `expertId`,
`userPseudonym`, `modelId`, `timestamp`, `status`, `latencyMs`. Campos ausentes recebem o marcador
`missing` e geram o evento `obs.trace.missing_metadata` sem falhar a requisição.

Metadados por etapa:

- **recuperação:** `topK`, `threshold`, `scores[]`, `sourceIds[]`, `chunksConsidered`;
- **geração:** `promptVersion`, `tokensIn`, `tokensOut`, `estimatedCostUsd`, `finishReason`;
- **mídia:** `mediaKind`, `modelId`, `parameters`, `sizeBytes`, `durationSeconds`;
- **fontes:** `sourceId`, `sourceVersionId`, `extractionMethod` — sem hash, endereço ou trecho.

> Os builders `createMediaSpanMetadata()` e `createSourceSpanMetadata()` implementam os contratos
> de mídia/fontes e são testados, mas **não são chamados** nos fluxos reais. Não os descreva como
> telemetria ativa.

Payload enviado ao coletor: `id`, `name`, `run_type`, `start_time`, `end_time`, `status`, `tags`,
`extra.metadata`, `inputs: {}` e `outputs: {}`. Mapeamento de `run_type`: `chat`/`media`/`source` →
`chain`, `retrieval` → `retriever`, `generation` → `llm`. Tags incluem `schema:v1`.

Segurança:

- `userPseudonym = HMAC-SHA256(salt, userId)` — estável por usuário, sem e-mail/nome;
- sanitização recursiva remove chaves proibidas (`prompt`, `answer`, `content`, `email`,
  `password`, `apiKey`, `sessionToken`, `authorization`, `url`, `address`, `hash`, `raw`) e mascara
  e-mail/telefone/token, registrando apenas `obs.pii.sanitized`;
- nenhum prompt, resposta, PII, chave ou conteúdo de arquivo é enviado ao coletor por padrão;
- emissão é assíncrona, com flush por intervalo/tamanho configuráveis (ver §2.4).

Isolamento: não há workspace nesta fatia; toda correlação é por usuário autenticado, conversa e
mensagem. A fatia 017 é representada apenas por contrato/metadados de mídia — nenhum fluxo dela
foi alterado pela spec 018.

---

## 4. Evaluation offline

Datasets versionados em `eval/datasets/` (nome + revisão string, casos sintéticos):

| Dataset                 | Métrica             | Limiar default |
| ----------------------- | ------------------- | -------------- |
| `expert-answer-quality` | `answer_quality`    | 0.8            |
| `citation-fidelity`     | `citation_fidelity` | 0.8            |
| `rag-no-answer`         | `no_answer`         | 0.8            |
| `multimedia-intent`     | `media_intent`      | 0.8            |

Execução:

```bash
bun run obs:eval
bun run obs:eval --dataset eval/datasets/expert-answer-quality.json
bun run obs:eval --baseline eval/reports/baseline.json
bun run obs:eval --out eval/reports/current.json
```

Códigos de saída: `0` = todos os limiares atendidos; `1` = pelo menos um limiar não atendido;
`2` = dataset ausente/inválido ou baseline inválido. O relatório mostra score, limiar, `PASS`/`FAIL`
e `delta` por métrica quando `--baseline` é informado. Nenhum modelo externo é chamado: o scorer é
puro e determinístico, adequado para gate local antes de mudanças de prompt/modelo.

`eval/reports/` é ignorado pelo Git para evitar versionar relatórios gerados. Esquema dos datasets
e orientações de autoria em [`eval/datasets/README.md`](../eval/datasets/README.md).

---

## 5. Dashboards, consultas e limites do painel

`observability/gen-dashboard.mjs` gera `observability/dashboards/api-overview.json`: 10 rows,
51 visualizações e 64 queries, refresh de 30 s e janela padrão de 3 h. O provisionador usa
`allowUiUpdates: false`, embora o JSON seja `editable: true`.

Fontes: Loki (`service_name` da API), Prometheus (`traces_spanmetrics_*`, `otelcol_*`,
`postgresql_*`) e Tempo.

| Row                               | Conteúdo                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Visão geral                       | requisições, 5xx, 4xx, p95, warnings/errors, telemetria ativa                            |
| Tráfego, erros e latência         | por status, p50/p95/p99, por rota, erros por rota (LogQL sobre `HTTP request completed`) |
| Endpoints                         | tabela por método/rota/status e top 10 rotas lentas por p95                              |
| Autenticação e eventos de negócio | eventos por `outcome` e stream de mensagens de auth                                      |
| Logs                              | volume por nível, warnings/errors e stream completo                                      |
| Traces (Tempo) e RED por span     | taxa/erro/latência por `span_name`, traces lentos/com erro                               |
| Banco: queries da API             | contagem/erro/p95 por `<OPERAÇÃO> <tabela>` e queries no Tempo                           |
| Postgres: saúde do banco          | conexões, cache hit, tamanho, rollbacks, deadlocks, locks, scans                         |
| Alertas                           | apenas painel `alertlist` — **nenhuma regra provisionada**                               |
| Saúde da pipeline OTel Collector  | `up`, refused/failed, fila do exporter, memória, accepted/refused                        |

Limites conhecidos do painel:

- o gerador filtra `postgresql_database_name="postgres"` de forma fixa, enquanto o coletor usa
  `${POSTGRES_DB}` do Compose — os painéis Postgres podem ficar vazios;
- algumas métricas `postgresql_*` consumidas dependem de defaults do receiver e não estão
  declaradas explicitamente em `postgres-collector.yaml`;
- `up{job="otelcol-contrib"}` e `otelcol_*` dependem de self-metrics/scraping do coletor, sem
  configuração versionada no repositório;
- as métricas customizadas `http.server.request.duration` e `http.server.requests` **não** são
  usadas pelo dashboard: os painéis HTTP vêm de LogQL. O nome `http.server.request.duration`
  também pode colidir com a métrica automática do `HttpInstrumentation` (unidade diferente);
- não há painéis de chat, RAG, custo, citações, mídia, ingestão de fontes ou fila de jobs, nem
  painel de saúde do sink LangSmith (`obs.trace.dropped`, profundidade da fila, flush).

---

## 6. Limites conhecidos e dívida técnica

| Limite                                                                                                 | Impacto                                                 | Status    |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------- |
| `requestId` HTTP, `traceId` OTel e `traceId` local são independentes                                   | Não há navegação log → trace ponta a ponta              | 🔍        |
| Sem `AsyncLocalStorage`, `requestId` não entra em todos os logs                                        | Correlação manual fora do middleware HTTP               | 🔍        |
| `path` HTTP é logado sem normalização de rota / query string                                           | Alta cardinalidade e risco de dados de query em logs    | 🔍        |
| Exceções sem `error.type` estruturado e sem `stack` em dev; `withDbSpan` não chama `recordException()` | Diagnóstico de erro menos preciso                       | 🔍        |
| Fila do `HttpTraceSink` sem limite e sem backpressure                                                  | Crescimento ilimitado em picos de tráfego               | 🔍        |
| Sem métricas de profundidade da fila, duração de flush ou total de drops                               | Só o log `obs.trace.dropped` sinaliza falha             | 🔍        |
| Builders de metadados de mídia/fontes não conectados aos fluxos                                        | Contrato documentado sem telemetria ativa nessas etapas | 🔍        |
| Sem alertas provisionados e sem SLOs/error budget                                                      | Ninguém é avisado sobre 5xx, p95 ou queda do coletor    | 🔍        |
| Sem métricas de domínio (chat, RAG, tokens, custo, mídia)                                              | Sinais existem só como atributos de log/span            | 🔍        |
| Sem instrumentação no front-end (`x-request-id`/`traceparent`)                                         | Rastreamento começa na API                              | 🔍        |
| Sem Studio/traces ao vivo e sem persistência de spans                                                  | Validação depende de stack licenciada                   | bloqueado |

Corrigir `requestId` → `traceId`, erros estruturados, filtro do dashboard, cardinalidade do path,
métricas de domínio e alertas são as prioridades P0/P1 registradas em
[`ARCHITECTURE.md` §7](./ARCHITECTURE.md#7-decisões-em-aberto).

---

## 7. Runbook de troubleshooting

| Sintoma                             | Onde olhar primeiro                                                                  | Ação provável                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Nenhum log/trace aparece no Grafana | `docker compose ps`, painel "API enviando telemetria", `OTEL_EXPORTER_OTLP_ENDPOINT` | Subir LGTM; conferir nome do serviço e o endpoint OTLP                                        |
| Logs existem, traces não            | `HttpInstrumentation`, `withDbSpan`, variável `OTEL_SDK_DISABLED`                    | Reativar SDK; verificar se a rota é instrumentada                                             |
| Painéis Postgres vazios             | `postgresql_database_name` no gerador vs. `POSTGRES_DB` do Compose                   | Alinhar filtro e declarar as métricas no receiver                                             |
| `otelcol_*` sem dados               | self-metrics/scraping do coletor                                                     | Provisionar scraping ou remover painéis sem fonte                                             |
| Chat/RAG sem spans locais           | `LANGSMITH_TRACING_ENABLED`, log de boot, `obs.trace.*`                              | Flag desligada é esperado; ligada exige coletor local válido                                  |
| `obs.trace.dropped` nos logs        | coletor local, rede, timeout do `fetch`                                              | O erro é engolido por design: conferir sink e endpoint; a resposta ao usuário continua normal |
| `obs.trace.missing_metadata`        | metadados do caso de uso                                                             | Preencher o campo na origem; o valor `missing` é um marcador, não erro                        |
| `obs.pii.sanitized` em excesso      | campos passados ao `TraceEmitter`                                                    | Remover dados proibidos na origem; nunca desligar o sanitizador                               |
| `obs:eval` falha com exit 2         | dataset/baseline informados                                                          | Conferir caminho e formato; ver README de `eval/datasets/`                                    |
| Latência alta no chat               | logs `expert.chat`/`rag`, spans de geração, `estimatedCostUsd`                       | Distinguir recuperação de geração; considerar limites de `RAG_*`                              |
| Fila de mídia travada               | eventos `media_generation.requested/started/completed/failed`                        | Hoje só há logs: correlacionar por `mediaId` (métricas de fila são follow-up)                 |

Ao investigar, **nunca** copie prompt, resposta, PII, chave ou conteúdo de arquivo para tickets,
logs adicionais ou documentação. Use `traceId`, `requestId`, `userId`/pseudônimo e códigos de erro.

---

## 8. Verificação manual (quando a stack licenciada existir)

1. com a flag desligada, enviar prompt no chat: resposta normal e nenhum span;
2. com a flag ligada e coletor local ativo: conferir span raiz + recuperação + geração com o mesmo
   `traceId`;
3. com a flag ligada e coletor fora: resposta normal e `obs.trace.dropped` em log;
4. injetar e-mail/token sintético: span sem PII e evento `obs.pii.sanitized`;
5. apontar endpoint público com a flag ligada: boot falha com erro claro;
6. rodar `bun run obs:eval` com e sem `--baseline` e conferir exit codes 0/1/2;
7. abrir o trace no Studio e conferir o grafo — **não executável nesta fatia** (ver §1).

---

## 9. Decisões abertas (fora desta fatia)

Versão/licença do LangSmith, backend de armazenamento, retenção, conteúdo de prompt/resposta em
spans, limiares por suite, gate de deploy automático e evolução para Kubernetes. Somam-se a elas
as decisões de correlação, alertas, métricas de domínio e fila do sink listadas em §6. Ver
[`.specs/018-langsmith-local.md`](../.specs/018-langsmith-local.md), seção 15.

---

## 10. Evidência demonstrativa e diagnóstico de erros

Esta seção torna a observabilidade **demonstrável sem subir a stack**. Ela complementa §5
(implementação), §7 (runbook) e §8 (verificação ao vivo) com um artefato reproduzível e com o
caminho de diagnóstico apoiado nos campos que o código realmente emite.

> Não existe registro de incidente real de produção versionado neste repositório, nem captura do
> Grafana em execução. Os exemplos abaixo vêm do código e dos cenários simulados da suíte de
> testes; eles mostram **como diagnosticar**, não afirmam que determinado erro ocorreu em produção.

### 10.1 Prévia estrutural do dashboard

O artefato [`observability/dashboard-preview.svg`](../observability/dashboard-preview.svg) é gerado
de forma determinística a partir de `observability/dashboards/api-overview.json`:

```sh
bun observability/gen-dashboard-preview.mjs
```

O gerador usa apenas `node:fs`/`node:path`, lê o JSON versionado e escreve um SVG independente:
**10 rows, 51 visualizações, 64 queries**, com painéis agrupados por row e identificados por tipo,
fonte e número de queries. Cores: azul = Loki, laranja = Prometheus, roxo = Tempo, cinza = sem
datasource (`alertlist`). O cabeçalho registra UID, refresh (`30s`), janela (`now-3h → now`) e o
aviso explícito de que aquilo é a **estrutura do painel, não dados reais de produção**.

Para ver dados ao vivo — e tirar uma captura autêntica — é necessário subir o LGTM
(`bun run infra:up`), gere tráfego na API e abrir <http://localhost:3010> conforme §8. Essa etapa
continua bloqueada neste ambiente (Docker/PostgreSQL indisponíveis).

### 10.2 Inventário por row (extraído do JSON)

| Row                                              | Painéis | Queries | Fontes                                          |
| ------------------------------------------------ | ------: | ------: | ----------------------------------------------- |
| Visão geral (período selecionado)                |       6 |       6 | Loki, Prometheus                                |
| Tráfego, erros e latência                        |       4 |       6 | Loki                                            |
| Endpoints: o que funciona e o que não            |       2 |       2 | Loki                                            |
| Autenticação e eventos de negócio                |       2 |       2 | Loki                                            |
| Logs                                             |       3 |       3 | Loki                                            |
| Traces (Tempo) e RED por span                    |       5 |       7 | Prometheus, Tempo                               |
| Banco de dados: queries da API (spans)           |       9 |       9 | Prometheus, Tempo                               |
| Postgres: saúde do banco (métricas do servidor)  |      13 |      19 | Prometheus                                      |
| Alertas                                          |       1 |       0 | sem datasource                                  |
| Saúde da pipeline de telemetria (OTel Collector) |       6 |      10 | Prometheus                                      |
| **Total**                                        |  **51** |  **64** | 16 Loki / 30 Prometheus / 4 Tempo / 1 sem fonte |

Consultas que sustentam a prévia (valores de serviço/banco mascarados):

```logql
sum(count_over_time({service_name="<svc>"} |= "HTTP request completed" [$__range]))
max(quantile_over_time(0.95, {service_name="<svc>"} |= "HTTP request completed" | unwrap durationMs [$__range]))
sum by (statusCode, path) (count_over_time({service_name="<svc>"} |= "HTTP request completed" | statusCode=~"[45].." [$__auto]))
```

```promql
sum by (span_name) (rate(traces_spanmetrics_calls_total{service="<svc>"}[$__rate_interval]))
histogram_quantile(0.95, sum by (le) (rate(traces_spanmetrics_latency_bucket{service="<svc>"}[$__rate_interval])))
```

```traceql
{ resource.service.name = "<svc>" && duration > 300ms }
{ resource.service.name = "<svc>" && span.db.system = "postgresql" && status = error }
```

### 10.3 Logs estruturados emitidos pela aplicação

Formato base em `apps/api/src/modules/shared/observability/app-logger.ts`: `timestamp`, `level`,
`service`, `message`, atributos primitivos e `traceId` quando há span ativo. A linha vai para
stdout/stderr e para `otelLogger.emit()`.

| Mensagem                     | Campos principais                                                      | Origem no código                                                 |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `HTTP request completed`     | `requestId`, `method`, `path`, `statusCode`, `durationMs`, `traceId`?  | `modules/shared/logging/request-logging.middleware.ts`           |
| `Sign-in rejected`           | `outcome`, `userId`?                                                   | `modules/auth/application/sign-in.use-case.ts`                   |
| `Sign-in succeeded`          | `outcome`, `userId`                                                    | `modules/auth/application/sign-in.use-case.ts`                   |
| `expert.chat`                | `event`, `expertId`, `userId`, `source`?, `outcome`                    | `modules/conversations/application/send-message.use-case.ts`     |
| `rag`                        | `event`, `userId`, `topK`, `durationMs`?, `outcome`, `error`?          | `modules/citations/application/retrieve-context.use-case.ts`     |
| `knowledge.sources`          | `event`, `outcome`, `userId`, `sourceId`?, `versionId`?, `error`?      | `modules/sources/application/process-source-version.use-case.ts` |
| `media_generation.requested` | `event`, `mediaId`, `userId`, `expertId`, `kind`, `modelId`, `outcome` | `modules/media/application/request-media-generation.use-case.ts` |
| `obs.trace.missing_metadata` | `spanId`, `traceId`, `fields`                                          | `modules/observability/application/trace-emitter.ts`             |
| `obs.trace.dropped`          | `spanId`, `traceId`, `error` (nome do erro)                            | `trace-emitter.ts` e `infrastructure/http-trace.sink.ts`         |
| `Exceção não tratada`        | `requestId`, `statusCode`, `error` (`<ErrorName>: <mensagem>`)         | `modules/shared/interface/error-contract.filter.ts`              |
| `API iniciada`               | `port`, `webOrigin`, `nodeEnv`, `emailProvider`                        | `main.ts`                                                        |

Exemplo sanitizado (placeholders, sem valor real):

```json
{
  "timestamp": "<ISO-8601>",
  "level": "info",
  "service": "coders-modulo-4-api",
  "message": "HTTP request completed",
  "requestId": "<uuid>",
  "method": "<METHOD>",
  "path": "<normalized-or-raw-path>",
  "statusCode": "<status>",
  "durationMs": "<ms>",
  "traceId": "<span-trace-id>"
}
```

Spans de banco não são linhas de log: `withDbSpan()`
(`modules/shared/observability/db-span.ts`) cria spans CLIENT `<OPERAÇÃO> <tabela>` com
`db.system`, `db.collection.name`, `db.operation.name` e, em erro, `db.response.status_code` e
`error.type`. Eles alimentam os painéis Prometheus/Tempo descritos em §5.

### 10.4 Diagnóstico de erros: do sintoma à causa

Sequência recomendada ao investigar um erro reportado por usuário ou por 5xx no painel:

1. **Isole a requisição.** Pegue o `x-request-id` (ou o `requestId` devolvido) e filtre no Loki:
   `{service_name="<svc>"} | requestId="<id>"`. A linha `HTTP request completed` traz `method`,
   `path`, `statusCode` e `durationMs`; o painel "Requisições por status HTTP" e "Taxa de erro por
   rota (4xx/5xx)" mostram o comportamento agregado. Atenção: `path` não é normalizado (§6) — não
   copie query string para tickets, ela pode conter PII.
2. **Classifique o status.** `4xx` é falha de contrato/validação/autorização (o corpo segue
   `{ code, message, fieldErrors? }`); `5xx` indica falha da aplicação ou de integração e exige
   o próximo passo. `429` é esperado quando um rate limit local foi atingido; `401` pode ser
   sessão revogada por login anterior (sessão única).
3. **Leia o `outcome` e o `error` dos eventos de domínio.** Exemplos reais de campos emitidos:
   - e-mail falhou → `E-mail de confirmação/recuperação/nova sessão/senha alterada não foi enviado`
     com `outcome` (`confirmation_email_failed`, `reset_email_failed` etc.) e `error` (nome do
     erro). Em cenários simulados, o sign-up chega a `503` com `HttpException` no log
     `Exceção não tratada`;
   - RAG indisponível → `rag` com `event:"rag.retrieval.completed"`,
     `outcome:"unavailable"` e `error` — a resposta ao usuário pode continuar normal;
   - fonte/mídia → `knowledge.sources` com `NO_SPEECH_DETECTED`,
     `SOURCE_VECTOR_STORE_UNAVAILABLE` ou `SOURCE_URL_NO_TEXT`, e eventos
     `media.extraction.started/completed/failed`;
   - tracing local → `obs.trace.dropped` (coletor/timeout; erro engolido por design) e
     `obs.trace.missing_metadata` (marcador `missing`, não é erro).
4. **Vá do log ao trace.** O `traceId` presente no log aponta para o span no Tempo (busca por
   `traceID`), onde a row "Traces (Tempo) e RED por span" separa latência, erro e `span_name`.
   Para banco, use "Queries lentas (> 100 ms)", "Queries com erro" e a row "Banco de dados:
   queries da API (spans)", com `db.operation.name`/`db.collection.name`.
5. **Confirme a pipeline antes de culpar a aplicação.** Se não há nem logs, o painel "API enviando
   telemetria" e as queries `up{job="otelcol-contrib"}`, `otelcol_exporter_queue_size` e
   `otelcol_receiver_*` dizem se o coletor recebeu e exportou. Painéis Postgres vazios têm causa
   conhecida em §5 (filtro `postgresql_database_name` fixo).
6. **Aja conforme o sinal.**

| Sinal                                             | Interpretação provável          | Ação                                                                 |
| ------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `4xx` isolado com `outcome` de validação          | comportamento de contrato       | Ajustar cliente/dados; não abrir alerta de disponibilidade           |
| `429` em auth                                     | rate limit local ao processo    | Verificar origem e janela; store compartilhado é follow-up           |
| `503` + `*_email_failed`                          | provedor de e-mail indisponível | Conferir provedor por `NODE_ENV` e logs do envio; resposta é 503     |
| `rag` `outcome:"unavailable"`                     | recuperação vetorial falhou     | Conferir Weaviate/embeddings; citações degradam, chat pode responder |
| `obs.trace.dropped`                               | sink local não entregou         | Conferir endpoint/timeout do coletor; resposta ao usuário não muda   |
| `statusCode=error` em span `db.system=postgresql` | query ou conexão falhou         | Usar `db.operation.name`/tabela e correlação com `postgresql_*`      |
| `up{job="otelcol-contrib"} == 0`                  | coletor fora                    | Subir LGTM/coletor; ver §7                                           |

### 10.5 Limites desta evidência

- A correlação `requestId` → `traceId` OTel → `traceId` local ainda não é unificada (§6): o
  diagnóstico cruza campos manualmente.
- Não há alertas provisionados nem painéis de chat/RAG/custo/mídia/fila; sinais de domínio existem
  só como atributos de log/span.
- A prévia SVG prova a **estrutura versionada**, não a efetividade do painel com dados. Para
  evidência "ao vivo", execute §8 com Docker/LGTM disponíveis e anexe a captura ao relatório.
- O checklist reproduzível de testes/cobertura está em
  [QA.md §22](./QA.md#22-evidências-de-testes-e-cobertura--revisão-do-módulo-4-2026-11-18).
