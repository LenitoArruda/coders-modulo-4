# Plano — Respostas com recuperação e citações (spec 016)

> Spec: `.specs/016-rag-citations.md`
> Status: done
> Atualizado em: 2026-11-18

## 1. Contexto

A fatia 012 entrega chat com Experts e a 013 entrega fontes, chunks e vetores, mas o modelo ainda
responde sem consultar o conhecimento conectado. Esta fatia conecta as duas partes: recuperação
vetorial filtrada por usuário, prompt aterrado, citações `[n]` validadas, painel da fonte e
metadados persistentes no histórico.

O trabalho acontece somente no worktree `spec-016`, sem push, merge, reset ou migração descendente.
As fatias 014, 015, 017 e 018 não são alteradas. Nenhuma spec dessas fatias é editada.

## 2. Decisões fechadas neste plano

| Tema                 | Decisão                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature flag         | `RAG_CITATIONS_ENABLED`, padrão `false`. Desligada, o chat é idêntico à fatia 012.                                                                                         |
| Recuperação          | `topK = 5`, limiar de similaridade `0.35` (certainty do Weaviate), ambos configuráveis.                                                                                    |
| Orçamento            | Até 6 mensagens recentes e 6.000 caracteres de contexto recuperado por resposta.                                                                                           |
| Formato              | `[n]` inline, com painel lateral (drawer) e fechamento por `Esc`.                                                                                                          |
| Ordem                | Citações seguem a ordem de relevância da recuperação; marcadores fora de `[1..k]` são removidos.                                                                           |
| Versão antiga        | `isStale` é calculado na recuperação e recalculado ao ler o histórico.                                                                                                     |
| Fonte removida       | `sourceRemoved` é recalculado ao ler o histórico; o texto permanece e o botão é desabilitado com "Source removed".                                                         |
| Falha do vetorial    | Degradação graciosa: resposta básica sem citações, aviso en-US e botão "Retry search". Nunca inventa citação.                                                              |
| Falha do modelo      | Continua `503 MODEL_UNAVAILABLE`, sem detalhes técnicos e sem persistência parcial.                                                                                        |
| Isolamento           | Todo filtro de vetor, fonte e mensagem usa o `user_id` autenticado; não há workspace.                                                                                      |
| Contrato dos vetores | Reusa apenas `KnowledgeChunk` com `userId`, `sourceId`, `sourceVersionId`, `chunkId`, `chunkIndex`, `content`; tipos novos de fonte são tolerados sem alterar a slice 013. |
| Segredo              | A chave de embedding permanece apenas no servidor, via `OPENAI_API_KEY`; nada é enviado ao cliente, log ou telemetria.                                                     |

## 3. Escopo

### Dentro

- Novo slice `citations` na API com domínio, portas, casos de uso e adaptadores próprios.
- Integração no fluxo de envio de mensagens e na leitura do histórico, preservando o modo fatia 012.
- Embedding da pergunta, busca REST/GraphQL no Weaviate, dedupe, limiar e top-k.
- Prompt com histórico recente, trechos como dados não confiáveis e instrução de citação.
- Persistência de `citations`, `retrieval` e `answer_status` em `messages`.
- Tipos, renderização inline, painel lateral, avisos de fonte antiga/removida e retry no web.
- Migração aditiva `0004_rag_citations.sql` e teste SQL `004_rag_citations.test.sql`.
- Testes unitários, integração, SQL, web, E2E e QA completo.
- Atualização de `.docs/ARCHITECTURE.md`, `.docs/QA.md`, spec 016 e este plano.

### Fora

- Reranking, busca híbrida, filtros por tipo na UI e citações em mídia gerada.
- Alterações nas fatias 014, 015, 017 e 018.
- Reescrita dos adaptadores da fatia 013; nenhuma porta existente é modificada.
- Envio de prompt, trecho, chave ou hash para logs/telemetria.
- Push, merge, reset, down-migration ou alteração da branch principal.

## 4. Arquitetura

- **Domínio (`citations/domain`):** tipos `Citation`, `RetrievalResult`, `GroundingContext`,
  `CitationLocation`; funções puras para dedupe, construção do trecho de prompt, validação e
  sanitização das citações.
- **Aplicação (`citations/application`):** portas `QueryEmbeddingPort`, `KnowledgeRetrievalPort`,
  `CitationSourceMetadataPort`; casos de uso `RetrieveContextUseCase`, `ComposeCitedAnswerUseCase`
  e `RefreshCitationsUseCase`.
- **Infraestrutura (`citations/infrastructure`):** embedding da pergunta com
  `text-embedding-3-small`, busca no Weaviate via REST/GraphQL e metadados das fontes via `pg`.
- **Integração com conversas:** `SendMessageUseCase` recebe dependências opcionais e só executa o
  pipeline quando a flag está ligada; `GetConversationUseCase` atualiza o estado das citações ao
  carregar o histórico. O endpoint continua `POST /api/v1/conversations/messages`.
- **Web:** os campos novos são opcionais em `ChatMessage`; um componente puro separa o texto e
  transforma `[n]` em botões acessíveis, e o chat controla o painel lateral com `Esc`.

## 5. Arquivos afetados

### API

- `apps/api/src/modules/citations/**` (novo slice completo).
- `apps/api/src/modules/citations/citations.tokens.ts`.
- `apps/api/src/modules/conversations/domain/conversation.ts`, `domain/conversation.errors.ts`.
- `apps/api/src/modules/conversations/application/ports/expert-responder.port.ts`,
  `application/ports/conversations-repository.port.ts`,
  `application/send-message.use-case.ts`, `application/get-conversation.use-case.ts`.
- `apps/api/src/modules/conversations/infrastructure/langgraph-expert.responder.ts`,
  `infrastructure/postgres-conversations.repository.ts`.
- `apps/api/src/modules/conversations/conversations.module.ts`, `conversations.tokens.ts`.
- `apps/api/src/app.module.ts`.
- `apps/api/src/modules/shared/config/env.ts`.
- `apps/api/src/test/fakes/fake-expert-responder.ts`,
  `apps/api/src/test/fakes/in-memory-conversations.repository.ts`, `src/test/setup-env.ts`.

### Web

- `apps/web/lib/expert-chat/types.ts`, `apps/web/lib/expert-chat/citations.ts` (novo),
  `apps/web/lib/expert-chat/citations.spec.ts` (novo).
- `apps/web/app/app/_components/expert-chat.tsx`,
  `apps/web/app/app/_components/citation-panel.tsx` (novo),
  `apps/web/app/app/_components/cited-content.tsx` (novo).
- `apps/web/e2e/support/fake-api-server.ts`, `apps/web/e2e/rag-citations.spec.ts` (novo).

### Banco e documentação

- `db/migrations/0004_rag_citations.sql`, `db/tests/004_rag_citations.test.sql`, `.env.example`.
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.specs/016-rag-citations.md`, este plano.

## 6. Passos

- [x] 6.1 Validar DoR, fechar decisões abertas e criar este plano; spec e plano atualizados ao final para `done`.
- [x] 6.2 Domínio e portas de citações + testes puros de dedupe/validação/prompt.
- [x] 6.3 Adaptadores de embedding, Weaviate e metadados + testes com servidor HTTP local/fakes.
- [x] 6.4 Casos de uso de recuperação, composição e atualização do histórico + testes.
- [x] 6.5 Migração 0004 e teste SQL; executar `db:migrate` e `db:test`.
- [x] 6.6 Integrar envio e leitura de conversas, erro 503 e DI; testes unitários/integração.
- [x] 6.7 Tipos, utilitário e componentes web + testes Vitest.
- [x] 6.8 Fake API e E2E de citações, painel, `Esc`, persistência, fonte antiga/removida e retry.
- [x] 6.9 Documentação, critérios de aceite e plano atualizados.
- [x] 6.10 QA completo e commit local em `spec/016`.

## 7. Riscos e mitigação

| Risco                          | Mitigação                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Citação inventada pelo modelo  | Sanitização contra o conjunto injetado; marcadores inválidos removidos.         |
| Injeção via documento          | Trechos colocados como dados em bloco delimitado; regras do sistema reforçadas. |
| Custo/latência                 | Top-k, limiar, histórico e contexto com limites centrais configuráveis.         |
| Weaviate fora do ar            | Exceção convertida em estado `unavailable`, resposta básica e retry na UI.      |
| Fonte excluída após a resposta | Metadados recalculados na leitura; link desabilitado sem recriar a fonte.       |
| Vazamento de segredo/conteúdo  | Chave apenas no servidor; logs com IDs, duração e desfecho, nunca conteúdo.     |
| Conflito com fatias paralelas  | Nenhum arquivo de 014/015/017/018 é tocado; slice 013 reusado sem alteração.    |

## 8. Plano de testes

- **Unitário API:** dedupe por `chunkId`, ordenação por score, limiar, prompt com contexto,
  sanitização de `[n]`, fallback `no_match`, degradação `unavailable`, isolamento por usuário,
  recálculo de `isStale`/`sourceRemoved`.
- **Integração API:** envio com flag on/off, persistência e leitura de citações, falha do modelo
  sem escrita, erro legível sem detalhes técnicos.
- **SQL:** colunas JSONB, índice/constraint e leitura de mensagens antigas sem campos novos.
- **Web:** divisão do texto em segmentos e mapeamento de marcadores para citações válidas/removidas.
- **E2E:** citar e abrir painel, fechar com `Esc`, recarregar e manter citações, fonte antiga,
  fonte removida, sem fonte relevante e retry quando o vetorial falha.
- **Regressão:** suíte completa de chat, fontes, auth e navegação.

## 9. Rollout e rollback

- Flag desligada por padrão; ligar com `RAG_CITATIONS_ENABLED=true`.
- Rollback: desligar a flag. Histórico com citações continua legível; novas mensagens voltam ao
  modo fatia 012.
- Migração é aditiva e não destrutiva; nenhuma migração down é executada.

## 10. Evidências e pendências

### QA final

| Comando               | Resultado                                                       |
| --------------------- | --------------------------------------------------------------- |
| `bun run db:migrate`  | ok — 4 migrações aplicadas                                      |
| `bun run db:test`     | ok — 4 arquivos SQL passaram                                    |
| `bun run lint`        | ok — 3 tarefas Turbo                                            |
| `bun run types:check` | ok — 3 tarefas Turbo                                            |
| `bun run test`        | ok — API 69 arquivos / 441 testes; web 12 arquivos / 141 testes |
| `bun run build`       | ok — 2 tarefas Turbo, build de produção                         |
| `bun run test:e2e`    | ok — 142 testes aprovados em ~3,3 min (6 cenários de citações)  |

Escolhas implementadas: flag desligada por padrão; `topK = 5`, limiar `0.35`, histórico de 6
mensagens e contexto de 6.000 caracteres; painel lateral com `Esc`; `isStale`/`sourceRemoved`
recalculados na leitura; falha do vetorial degrada sem citações; falha do modelo mantém
`503 MODEL_UNAVAILABLE` sem escrita parcial; nenhum arquivo de 014/015/017/018 foi alterado.

Commit local em `spec/016`: registrado no relatório final (Conventional Commits, sem push).

Pendências: avaliação humana da precisão e medição de p95 com OpenAI/Weaviate reais, além da
decisão de habilitar a flag em produção. Nenhum push, merge, reset ou down-migration foi feito;
nenhuma chave, token ou valor de `.env` foi lido ou registrado.
