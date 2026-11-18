# AI.md — IA, RAG e entregáveis multimídia

> **Status:** documentação da implementação entregue nas specs `012`–`018` ·
> **Atualizado em:** 2026-11-18
> **Público:** engenharia, produto e agentes que alteram qualquer fatia de IA.

Este é o documento dono de **Experts, chat, fontes de conhecimento, recuperação/citações,
mídia generativa, modelos, flags e segurança de IA**. Para telemetria e avaliação, consulte
[OBSERVABILITY.md](./OBSERVABILITY.md); para arquitetura geral,
[ARCHITECTURE.md](./ARCHITECTURE.md). Nenhum prompt, resposta, chave, token, hash, URL sensível
ou dado de usuário é reproduzido aqui.

---

## 1. Estado das specs de IA

| Spec                                                                                      | Entrega                                                                               | Ponto de atenção                                                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [012 — Catálogo de Experts e chat](../.specs/012-expert-chat.md)                          | ✅ nove Experts, chat em persona, histórico isolado por usuário                       | Decisão de agrupar histórico por Expert está fechada no plano, mas a tabela da spec ainda a marca como aberta |
| [013 — Fontes de conhecimento por arquivo](../.specs/013-knowledge-files.md)              | ✅ upload, dedup por SHA-256, versões, chunks, embeddings, Weaviate, retry e exclusão | Limites provisórios e retenção já efetivos no código                                                          |
| [014 — Fontes de conhecimento por URL](../.specs/014-knowledge-url.md)                    | ✅ URL pública reusando o pipeline 013, com validação SSRF                            | Constantes de fetch já fixadas; `robots.txt` permanece fora                                                   |
| [015 — Conexão de mídia como conhecimento](../.specs/015-knowledge-media.md)              | ✅ imagem/áudio/vídeo → texto via OCR/transcrição local, atrás de flag                | Existe a migração `0004_knowledge_media.sql`; a spec dizia "sem migração"                                     |
| [016 — Respostas com recuperação e citações](../.specs/016-rag-citations.md)              | ✅ recuperação vetorial, fundamentação, citações `[n]`, status de resposta            | Contrato de citação em anexo de mídia precisa ser reconciliado com 017                                        |
| [017 — Entregáveis multimídia no chat](../.specs/017-multimedia-deliverables.md)          | ✅ geração assíncrona de imagem/vídeo, cota, preview, download, retry/cancel          | Fila e cota em memória; persistência é `bytea`, não volume de arquivos                                        |
| [018 — Observabilidade e avaliação com LangSmith local](../.specs/018-langsmith-local.md) | ✅ local-first: spans sanitizados + evaluation offline                                | Studio, traces ao vivo e stack licenciada 🚧 bloqueados; critérios parciais marcados na spec                  |

Todas as specs estão `done`; a `018` registra explicitamente a ressalva local-first. O histórico
de execução está em [QA.md §21](./QA.md#21-índice-navegável-spec--plano--evidência) e no
[índice de specs](../.specs/README.md#índice-navegável).

---

## 2. Arquitetura das fatias de IA

### 2.1 API (`apps/api/src/modules/`)

| Módulo                 | Camadas e responsabilidades                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experts/`             | Catálogo en-US servido pela API; handler `interface/request-handlers/list-experts.request-handler.ts`                                                                                                                                                                                  |
| `conversations/`       | Chat e histórico; handlers `send-message.request-handler.ts` e `get-conversation.request-handler.ts`; caso de uso `application/send-message.use-case.ts` orquestra modelo, RAG, mídia e telemetria                                                                                     |
| `citations/`           | Recuperação, embedding da consulta e metadados de fonte em `infrastructure/`; módulo e tokens em `citations.module.ts` / `citations.tokens.ts`                                                                                                                                         |
| `sources/`             | Upload/URL/mídia; policies `domain/source-file-policy.ts` e `domain/source-url-policy.ts`; handlers `connect-sources`, `connect-source-url`, `list-sources`, `delete-source`, `retry-source-version`; adaptadores de fetch, extração local, embeddings e Weaviate em `infrastructure/` |
| `media/`               | Geração de imagem/vídeo; handlers `get-media-status`, `cancel-media-generation`, `retry-media-generation`, `download-media`; fila/cota em memória, repositório PostgreSQL e providers em `infrastructure/`                                                                             |
| `observability/`       | Slice de tracing local (ver [OBSERVABILITY.md §2](./OBSERVABILITY.md#2-inventário-e-pipeline-de-telemetria))                                                                                                                                                                           |
| `shared/config/env.ts` | Validação e defaults de todas as variáveis de IA na borda do processo                                                                                                                                                                                                                  |

O prefixo global é `/api/v1` (`apps/api/src/app-setup.ts`). Cada endpoint tem um request handler
1:1 e um caso de uso por fluxo, com dependências apontando para o domínio.

### 2.2 Web (`apps/web/`)

| Arquivo                                                                                                     | Papel                                                          |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `app/app/chat-actions.ts`                                                                                   | Envio de mensagens e carregamento de conversa (server actions) |
| `app/app/source-actions.ts`                                                                                 | Conectar/listar/remover/retry de fontes                        |
| `app/app/media-actions.ts`                                                                                  | Solicitar status, cancelar, retry e baixar mídia               |
| `app/app/media/[mediaId]/content/route.ts`                                                                  | Proxy autenticado de download do bytes persistidos             |
| `lib/expert-chat/citations.ts`                                                                              | Parsing/validação de marcadores `[n]`                          |
| `lib/knowledge/types.ts`                                                                                    | Tipos de fonte e status compartilhados                         |
| `lib/knowledge/flags.ts`, `lib/media/flags.ts`                                                              | Leitura dos cookies de feature flag                            |
| `app/app/_components/expert-chat.tsx`, `cited-content.tsx`, `media-attachment.tsx`, `knowledge-sources.tsx` | Chat, renderização de citações, anexos e painel de fontes      |

### 2.3 Dados

Migrações em `db/migrations/`: `0002_expert_conversations.sql` (conversas/mensagens),
`0003_knowledge_sources.sql` (fontes/versões/chunks), `0004_knowledge_media.sql` (colunas de
mídia), `0005_rag_citations.sql` (citações/recuperação) e `0006_multimedia_deliverables.sql`
(jobs/anexos). O arquivo original e o arquivo gerado são persistidos em `bytea` no PostgreSQL;
os vetores ficam no Weaviate local (`KnowledgeChunk`, índice REST/GraphQL na porta 8080).

```text
Web (server actions)
   │  Authorization: Bearer (cookie HttpOnly)
   ▼
API /api/v1 ──► conversations (orquestração)
                    ├── experts ──► catálogo/persona
                    ├── citations ──► embedding da pergunta ──► Weaviate ──► contexto/citações
                    ├── sources ──► arquivo/URL/mídia ──► chunks ──► embeddings ──► Weaviate
                    ├── media ──► provider de imagem/vídeo ──► bytea ──► download autenticado
                    └── observability ──► spans locais sanitizados (flag desligada por padrão)
```

---

## 3. Contratos públicos

### 3.1 Endpoints sob `/api/v1`

| Método   | Rota                          | Finalidade                                      |
| -------- | ----------------------------- | ----------------------------------------------- |
| `GET`    | `/experts`                    | Lista o catálogo de Experts                     |
| `GET`    | `/conversations?expertId=...` | Histórico daquele Expert do usuário autenticado |
| `POST`   | `/conversations/messages`     | Envia mensagem e obtém resposta do Expert       |
| `GET`    | `/sources`                    | Lista fontes do usuário                         |
| `POST`   | `/sources`                    | Upload de arquivos/fontes de mídia              |
| `POST`   | `/sources/urls`               | Conecta URL pública                             |
| `DELETE` | `/sources/:sourceId`          | Remove fonte, versões, chunks e vetores         |
| `POST`   | `/sources/:versionId/retry`   | Reprocessa versão falha                         |
| `GET`    | `/media/:mediaId/status`      | Consulta status do job                          |
| `POST`   | `/media/:mediaId/cancel`      | Cancela job em andamento                        |
| `POST`   | `/media/:mediaId/retry`       | Tenta novamente após falha                      |
| `GET`    | `/media/:mediaId/content`     | Download autenticado do arquivo gerado          |

### 3.2 Erros

Formato global: `{ code, message, fieldErrors? }`, sem stack, SQL ou detalhes internos. Códigos
públicos confirmados:

- **gerais/chat:** `VALIDATION_ERROR`, `UNKNOWN_EXPERT`, `MODEL_UNAVAILABLE`,
  `NOT_FOUND` quando a flag de mídia está desligada;
- **mídia generativa:** `MEDIA_NOT_FOUND`, `MEDIA_LIMIT_EXCEEDED`;
- **fontes de arquivo:** `UNSUPPORTED_SOURCE_FILE`, `SOURCE_FILE_TOO_LARGE`,
  `TOO_MANY_SOURCE_FILES`, `EMPTY_SOURCE_FILE`, `MEDIA_DURATION_TOO_LONG`,
  `INVALID_MEDIA_DURATION`, `NO_SPEECH_DETECTED`, `MEDIA_EXTRACTION_UNAVAILABLE`,
  `SOURCE_PROCESSING_FAILED`, `SOURCE_VECTOR_STORE_UNAVAILABLE`,
  `SOURCE_EMBEDDING_UNAVAILABLE`, `SOURCE_NOT_FOUND`, `SOURCE_VERSION_NOT_FOUND`;
- **fontes de URL:** `INVALID_SOURCE_URL`, `BLOCKED_SOURCE_URL`, `SOURCE_URL_UNAVAILABLE`,
  `SOURCE_URL_NO_TEXT`, `SOURCE_URL_TOO_LARGE`.

### 3.3 Formatos de resposta

```ts
SendMessageResult = { conversationId, userMessage, expertMessage }

GetConversationResult = { conversationId: string | null, messages }

ConversationMessage = {
  id, conversationId, role, content, createdAt,
  citations?, retrieval?, answerStatus?, media?
}

Citation = {
  citationNumber, sourceId, sourceVersionId, chunkIndex,
  sourceName, sourceType, location, snippet, isStale, sourceRemoved
}

RetrievalMetadata = {
  queryEmbeddingModel, vectorIndex, topK, threshold, scores,
  latencyMs, chunksConsidered, status
}

AnswerStatus = "plain" | "with_source" | "no_match" | "retrieval_unavailable"

MediaAttachment = {
  mediaId, kind, status, uri, mimeType, sizeBytes,
  width?, height?, durationSeconds?, modelId, modelVersion, parameters,
  createdAt, citation?, errorCode?, errorMessage?, attempts?
}

MediaStatus = "queued" | "generating" | "ready" | "failed" | "cancelled"

MediaErrorCode =
  "INVALID_BRIEF" | "LIMIT_EXCEEDED" | "QUOTA_EXCEEDED" |
  "PROVIDER_UNAVAILABLE" | "CONTENT_REFUSED" | "CANCELLED" | "NOT_FOUND"
```

`GroundedAnswer.invalidCitationNumbers` identifica marcadores que não puderam ser associados a
uma fonte válida; nesses casos a resposta não apresenta a citação inválida.

---

## 4. Catálogo e chat (spec 012)

- Catálogo com **nove Experts** em en-US, servido pela API e consumido no servidor pelo web; os
  nomes, papéis e sugestões são dados de produto, não segredos.
- Histórico isolado por usuário e **agrupado por Expert** (`conversationId` por `(userId,
expertId)`); recarregar a conversa preserva as mensagens daquele Expert.
- Modelo de resposta: `gpt-4o-mini` via LangChain.js/LangGraph atrás de `ExpertResponderPort`.
- Prompt enviado pelo usuário é limitado por `EXPERT_PROMPT_MAX_LENGTH` (default `4000`); prompt
  vazio não chama o modelo. Não há retenção com expiração nesta fatia.
- `OPENAI_API_KEY` é opcional no boot: sem chave, o envio falha com `503 MODEL_UNAVAILABLE` e o
  restante da aplicação continua disponível — importante para testes determinísticos.
- A fatia 012 em si **não tem feature flag**; as flags de IA abaixo vieram nas fatias 015–018.
- Metas numéricas de latência/custo do chat não foram medidas em ambiente real.

---

## 5. Fontes de conhecimento (specs 013–015)

### 5.1 Arquivo (013)

1. Upload de PDF/TXT/Markdown → validação de tipo/tamanho no domínio.
2. Hash SHA-256 no escopo do usuário: conteúdo idêntico retorna a fonte existente
   ("Already connected"); conteúdo alterado cria nova `SourceVersion`.
3. Status `queued` → `processing` → `ready`; versões antigas ficam marcadas como desatualizadas.
4. Chunks + embeddings (`text-embedding-3-small`, 1536 dimensões) gravados no Weaviate.
5. Retry reprocessa a mesma versão; exclusão remove arquivo, versões, chunks e vetores e
   preserva o histórico de conversa.

Limites vigentes: `10 MB` por arquivo e `5` arquivos por envio (provisórios, em discussão).
Retenção adotada: até a exclusão da fonte.

### 5.2 URL (014)

- Reusa o contrato e o pipeline da 013; dedup pelo **conteúdo obtido**, não pela string da URL.
- Validação de esquema/host antes do fetch, no DNS e em cada redirecionamento: hosts privados
  nunca são buscados (política SSRF centralizada em `domain/source-url-policy.ts`).
- Constantes já fixadas no código: timeout `8 s`, resposta máxima `2 MB`, até `3`
  redirecionamentos, `1` retry e URL de até `255` caracteres.
- `robots.txt` e termos de uso **não** são verificados: apenas conteúdo público é buscado.
- URLs sem texto, grande demais ou bloqueadas viram erros acionáveis; nenhum endereço, trecho ou
  hash aparece em log/span.

### 5.3 Mídia como conhecimento (015)

- Imagem, áudio e vídeo são convertidos em texto por OCR/transcrição local e seguem o mesmo
  pipeline de chunks/embeddings; reuso por hash e retry por `sourceId`.
- Áudio sem fala produz `NO_SPEECH_DETECTED`; falha de extração produz
  `MEDIA_EXTRACTION_UNAVAILABLE`.
- Flag: `KNOWLEDGE_MEDIA_ENABLED` (default `false`); no web existe o cookie
  `knowledge_media_enabled` e internamente o token `SOURCE_MEDIA_ENABLED`.
- A migração `0004_knowledge_media.sql` adiciona as colunas de mídia — a afirmação da spec de
  "nenhuma migração" está desatualizada.
- Ainda em aberto: modelos de OCR/transcrição, OCR visual de vídeo, idioma da transcrição, mídia
  por URL, limites operacionais definitivos e versionamento da extração.

---

## 6. RAG e citações (spec 016)

1. Pergunta → embedding da consulta (mesmo modelo da ingestão) → recuperação no Weaviate com
   `topK`/`threshold`.
2. Contexto limitado por `RAG_MAX_CONTEXT_CHARS` e histórico por `RAG_MAX_HISTORY_MESSAGES`.
3. Resposta fundamentada com marcadores `[n]`; `Citation` carrega número, fonte, versão, chunk,
   nome/tipo/localização, trecho e sinais de fonte antiga/removida.
4. `RetrievalMetadata` e `AnswerStatus` são persistidos na mensagem e renderizados no drawer de
   fontes; citações sobrevivem a reload.
5. Dados recuperados são tratados como **não confiáveis** (ver §8). Se o Weaviate falhar, a
   resposta segue sem citações e o status indica indisponibilidade/degradação.
6. `GroundedAnswer.invalidCitationNumbers` descarta marcadores órfãos e gera
   `rag.citation.invalid`.

Defaults: `RAG_TOP_K = 5`, `RAG_THRESHOLD = 0.35`, `RAG_MAX_CONTEXT_CHARS = 6000`,
`RAG_MAX_HISTORY_MESSAGES = 6`, `RAG_CITATIONS_ENABLED = false`. Metas como `≥ 90%` de fidelidade
e p95 `< 4 s` **não foram medidas** em ambiente real; a evaluation entregue é offline e
determinística (ver [OBSERVABILITY.md §4](./OBSERVABILITY.md#4-evaluation-offline)).

---

## 7. Entregáveis multimídia (spec 017)

- Intenção detectada no chat → validação de briefing; se faltar dado, o Expert pergunta e nenhum
  job é criado. Briefing até `2000` caracteres, arquivo até `20 MB`, até `3` tentativas.
- Job assíncrono com status `queued` → `generating` → `ready`/`failed`/`cancelled`; preview e
  download autenticado no chat; retry e cancelamento devolvem cota quando aplicável.
- Modelos: imagem `gpt-image-2`, vídeo `gemini-omni-1.2-flash` (saídas de `4/6/8 s` a `720p`).
  A chamada real ao Gemini depende de billing/API habilitados; a validação registrada usou
  providers fakeados/servidor local.
- Cota por `user_id`: `10` imagens e `2` vídeos por hora (janela `3600 s`). **Fila e cota são em
  memória** e não sobrevivem a restart; jobs não terminais com mais de `10 min` são marcados como
  `failed`/`PROVIDER_UNAVAILABLE`.
- `MediaAttachment.citation` anexa a citação `[n]` da última resposta ao entregável. A 016 trata
  a citação como parte da resposta textual/drawer; a precedência entre as duas representações
  segue como decisão de refinamento (§12).
- Arquivos gerados são persistidos como `bytea` no PostgreSQL — **não** em volume Docker.

---

## 8. Segurança de IA

- **Conteúdo não confiável:** arquivo, URL, mídia transcrita e histórico podem conter instruções.
  Elas são dados: não podem mudar persona, ferramentas, modelo ou permissões do Expert. A política
  SSRF complementa essa fronteira no acesso a URLs.
- **Prompt injection:** tratado no domínio das fatias 013–016; respostas sem correspondência viram
  `no_match`, e trechos recuperados nunca são copiados para logs ou spans.
- **Segredo e prompt:** nenhum valor de `.env`, chave, token, hash, system prompt, template de
  prompt ou resposta é registrado em documentação, log, span, dataset versionado ou relatório de
  QA. Use apenas nomes de variáveis, códigos de erro, IDs e pseudônimos.
- **Tracing:** endpoint local-only obrigatório quando `LANGSMITH_TRACING_ENABLED=true`; sanitização
  recursiva e pseudonimização HMAC não podem ser desligadas para "facilitar" investigação.
- **Isolamento:** por usuário autenticado; conversas agrupadas por `(userId, expertId)`, fontes e
  mídia pertencentes ao usuário. O download de mídia de outro usuário é negado.
- **Datasets:** sintéticos, sem PII/prompt de sistema/dados reais; ver
  [README de `eval/datasets`](../eval/datasets/README.md).
- Regras normativas em [RULES.md §5](./RULES.md#5-segurança-e-privacidade).

---

## 9. Configuração e flags

Fonte canônica: `apps/api/src/modules/shared/config/env.ts`. Use `.env.example` apenas como
referência de nomes; nunca versionar valores.

| Nome                              | Default                          | Intervalo / observação                                                            |
| --------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `EXPERT_PROMPT_MAX_LENGTH`        | `4000`                           | aceita até `100000`                                                               |
| `RAG_CITATIONS_ENABLED`           | `false`                          | liga recuperação e citações                                                       |
| `RAG_TOP_K`                       | `5`                              | `1`–`20`                                                                          |
| `RAG_THRESHOLD`                   | `0.35`                           | `0`–`1`                                                                           |
| `RAG_MAX_CONTEXT_CHARS`           | `6000`                           | até `100000`                                                                      |
| `RAG_MAX_HISTORY_MESSAGES`        | `6`                              | `0`–`50`                                                                          |
| `WEAVIATE_URL`                    | `http://127.0.0.1:8080`          | lido também nos módulos de fontes/citações                                        |
| `EMBEDDING_MODEL`                 | modelo de embedding da fatia 013 | mesmo modelo na consulta                                                          |
| `EMBEDDING_DIMENSIONS`            | `1536`                           | consistente com o vetor gravado                                                   |
| `WEAVIATE_DISTANCE`               | cosine                           | índice `KnowledgeChunk`                                                           |
| `KNOWLEDGE_MEDIA_ENABLED`         | `false`                          | web + API; cookie `knowledge_media_enabled`; token interno `SOURCE_MEDIA_ENABLED` |
| `MULTIMEDIA_DELIVERABLES_ENABLED` | `false`                          | web + API; cookie `multimedia_deliverables_enabled`                               |
| `MEDIA_IMAGE_MODEL_ID`            | `gpt-image-2`                    | configurável                                                                      |
| `MEDIA_VIDEO_MODEL_ID`            | `gemini-omni-1.2-flash`          | configurável                                                                      |
| `MEDIA_IMAGE_QUOTA_PER_HOUR`      | `10`                             | por `user_id`, em memória                                                         |
| `MEDIA_VIDEO_QUOTA_PER_HOUR`      | `2`                              | por `user_id`, em memória                                                         |
| `MEDIA_QUOTA_WINDOW_SECONDS`      | `3600`                           | janela da cota                                                                    |
| `MEDIA_MAX_FILE_BYTES`            | `20971520`                       | `20 MB`                                                                           |
| `LANGSMITH_TRACING_ENABLED`       | `false`                          | exige credencial local + salt quando ligada                                       |
| `OBS_TRACE_BATCH_SIZE`            | `32`                             | máximo `512`                                                                      |
| `OBS_TRACE_FLUSH_INTERVAL_MS`     | `1000`                           | máximo `60000`                                                                    |
| `OPENAI_API_BASE_URL`             | endpoint público da OpenAI       | configurável; valor real não documentado                                          |
| `GEMINI_API_BASE_URL`             | endpoint público do Gemini       | configurável; valor real não documentado                                          |

Constantes internas relevantes (não são variáveis de ambiente): `MAX_SOURCE_FILE_BYTES`
(`10 MB`), `MAX_FILES_PER_UPLOAD` (`5`), `MAX_SOURCE_URL_LENGTH` (`255`),
`MAX_URL_RESPONSE_BYTES` (`2 MB`), `URL_FETCH_TIMEOUT_MS` (`8000`), `MAX_URL_REDIRECTS` (`3`),
`URL_FETCH_RETRIES` (`1`), `MEDIA_BRIEFING_MAX_LENGTH` (`2000`) e `MAX_MEDIA_ATTEMPTS` (`3`).
O limiar default da evaluation offline é `0.8`, configurável por dataset.

---

## 10. Observabilidade e avaliação de modelos

- Logs de domínio com eventos `expert.selected`, `suggestion.clicked`, `prompt.submitted`,
  `response.completed/failed`, `source.*`, `media_generation.*`, `rag.*` e `obs.trace.*`.
- Spans locais (flag desligada por padrão) cobrem raiz de chat, recuperação e geração. Builders de
  metadados de mídia/fontes existem, mas ainda não são chamados nos fluxos reais.
- `bun run obs:eval` executa os quatro datasets sintéticos com scorer determinístico; faz gate
  local antes de alterar prompt/modelo. Códigos de saída `0`/`1`/`2`.
- Inventário, dashboards, runbook e limites em
  [OBSERVABILITY.md](./OBSERVABILITY.md).

---

## 11. Validações bloqueadas ou parciais

| Validação                                      | Situação                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Migrações e integração real com PostgreSQL     | parcial: validadas em worktrees com bancos isolados; na máquina atual o Docker/credenciais locais bloquearam `db:migrate` |
| LangSmith self-hosted, Studio e traces ao vivo | bloqueados por imagem Enterprise licenciada e daemon Docker indisponível                                                  |
| Geração real de vídeo via Gemini               | bloqueada por billing/API; validação com provider fakeado/servidor local                                                  |
| Metas `≥ 90%`, `≥ 85%` e p95 `< 4 s`           | não medidas em ambiente real                                                                                              |
| Fila/cota de mídia após restart                | não sobrevivem; sem persistência de fila                                                                                  |
| Helpers de span de mídia/fontes                | implementados e testados, sem chamada nos fluxos reais                                                                    |

---

## 12. Refinamentos recomendados das specs de IA

Estes ajustes **não mudam comportamento**: apenas eliminam contradições entre spec, plano e código.
Registre a execução com `refine-spec` (uma spec por vez).

1. **012:** mover a decisão "agrupar histórico por Expert" da aprovação do plano para a tabela de
   decisões; deixar claro que a 012 não tem flag, mas o conjunto de IA passou a ter.
2. **013:** registrar limites `10 MB`/`5 arquivos` como provisórios já adotados e retenção "até
   exclusão da fonte" como decisão executada.
3. **014:** transformar timeout `8 s` / `2 MB` / `3` redirecionamentos / `1` retry em decisão
   fechada; marcar `robots.txt` como explicitamente não implementado.
4. **015:** corrigir "sem migração" para `0004_knowledge_media.sql`; documentar as três Camadas de
   flag (`KNOWLEDGE_MEDIA_ENABLED`, cookie web, token interno `SOURCE_MEDIA_ENABLED`).
5. **016/017:** definir precedência entre `Citation` na resposta textual e
   `MediaAttachment.citation`, incluindo o que acontece com `[n]` quando o anexo é gerado.
6. **016:** declarar que métricas de qualidade/latência são metas 🧭 pendentes de medição, não
   critérios validados; descrever a fonte, o ambiente e o método de medição quando forem medidas.
7. **017:** trocar a menção genérica a Gemini pela versão fixada; explicitar `bytea`, volatilidade
   da fila/cota e política de limpeza de jobs órfãos.
8. **018:** padronizar o status para `done (local-first)` e separar critérios "não implementados",
   "implementados mas não validados ao vivo" e "bloqueados por licença/billing".
9. **Todas:** substituir requisitos não funcionais vagos por critérios mensuráveis com fonte de
   dado, janela e comportamento em caso de falha, conforme o Definition of Ready em
   [`.specs/README.md`](../.specs/README.md#definition-of-ready).
