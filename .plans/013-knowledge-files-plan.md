# Plano — Fontes de conhecimento por arquivo (spec 013)

> Spec: `.specs/013-knowledge-files.md`
> Status: done
> Atualizado em: 2026-11-18

## 1. Contexto

A fatia 012 entrega Experts que respondem sem contexto próprio. Esta fatia introduz o contrato de
fonte (`Source`, `SourceVersion`, `Chunk`, `Document`) e o pipeline de ingestão de PDF/TXT/Markdown
com deduplicação por hash, chunks, embeddings e vetores no Weaviate local. O contrato será reutilizado
pelas fatias 3 a 7.

Pré-requisitos confirmados pelo orquestrador: Weaviate 1.40.5 em `127.0.0.1:8080` com vectorizer
interno desligado; modelo `text-embedding-3-small` (1536 dimensões, cosine) decidido e registrado na
spec e no `.env.example`; credenciais presentes no `.env` do worktree.

## 2. Objetivo e critérios de aceite

Mapear os dez critérios da spec para entregas verificáveis:

1. FAB e lista na home privada com nome, tipo, tamanho e status → UI + `GET /sources`.
2. Upload válido retorna `processing` e termina `ready` com chunks/vetores → caso de uso assíncrono.
3. Reenvio idêntico não cria versão/chunk/vetor e informa “Already connected” → dedup por hash.
4. Isolamento entre usuários → todas as consultas e vetores filtrados por `userId`.
5. Tipo inválido recusado com mensagem en-US que lista PDF, TXT e Markdown → validação na borda.
6. Mesmo nome normalizado + conteúdo diferente cria nova versão e marca a anterior como `isStale`.
7. Falha de embedding/vetor deixa a versão `failed`, nunca `ready`, e permite retry.
8. Dois envios simultâneos: uma versão válida, sem vetores duplicados → índice único + conversão de
   conflito.
9. Exclusão remove arquivo, versões, chunks e vetores; histórico de chat intacto → delete por usuário.
10. Logs e telemetria sem conteúdo, nome de arquivo ou hash → campos permitidos enumerados.

## 3. Escopo

### Dentro

- Slice `sources` na API (domain/application/infrastructure/interface) com três endpoints 1:1.
- Migração SQL `0003_knowledge_sources.sql` e teste de schema `003_knowledge_sources.test.sql`.
- Adaptadores: extrator PDF/TXT/MD (`pdf-parse`), embeddings (`@langchain/openai` já instalado),
  vetores (REST do Weaviate via `fetch`), repositório `pg`.
- FAB + painel de conexões na home privada, com estados vazio/carregando/erro/ready/duplicado.
- Server Actions no web e fake API de E2E atualizada com rotas de fontes.
- Atualização de `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/BUSINESS.md`, spec e plano.

### Fora

- URLs, mídia, RAG/citações, imagens/vídeos e LangSmith (fatias 3–7).
- OAuth, sincronização automática, pastas, permissões por documento e edição de chunks.
- Alterações em auth, catálogo de Experts, chat, `docker-compose.yml`, `.env.example`, plano de
  orquestração ou outras specs.
- Migrações destrutivas, reset de banco, push e merge.

## 4. Abordagem técnica

- **Contrato compartilhado:** tipos `Source`, `SourceVersion`, `Chunk`, `Document` no domínio da API;
  DTOs en-US na interface. Vetores carregam `userId`, `sourceId`, `sourceVersionId` e `chunkId`.
- **Deduplicação:** SHA-256 do conteúdo bruto, escopo `user_id`. Índice único parcial
  `(user_id, content_hash) where status <> 'failed'` impede duas versões válidas simultâneas;
  conflito vira “Already connected”. Versão `failed` é reaproveitada no retry.
- **Agrupamento:** `normalized_name` (minúsculas, sem acentos, espaços colapsados, extensão mantida)
  agrupa versões. Conteúdo diferente cria nova `SourceVersion`; a anterior vira `isCurrent = false`
  e é exibida como `isStale` no histórico (sinalização para a fatia 5).
- **Arquivo original:** `bytea` na tabela `source_files`, por versão. Evita diretório compartilhado,
  garante exclusão atômica com a fonte e não exige nova variável de ambiente (`.env.example` é do
  orquestrador).
- **Processamento assíncrono:** `POST /sources` grava versão `processing` e responde `202`; o
  processamento roda em segundo plano no mesmo processo. Falha é persistida como `failed` com
  mensagem acionável, sem detalhes internos.
- **Weaviate:** collection `KnowledgeChunk`, vectorizer `none`, `distance = cosine`, 1536 dimensões.
  Adapter REST via `fetch` (porta HTTP 8080 é a única exposta no Compose; o cliente oficial v3
  exigiria gRPC 50051). `ensureCollection` é idempotente; escrita e remoção usam REST/GraphQL.
- **Embeddings:** `OpenAIEmbeddings` (`@langchain/openai`, já instalado) com
  `model = text-embedding-3-small` e `dimensions = 1536`; chave apenas no servidor, lida de
  `OPENAI_API_KEY` via `loadEnv`. Ausência de chave gera falha acionável no envio, não no boot.
- **Limites:** constantes de domínio `MAX_SOURCE_FILE_BYTES` (10 MB) e `MAX_FILES_PER_UPLOAD` (5)
  com valores padrão provisórios; a decisão aberta do solicitante segue como follow-up. A UI limita
  a quantidade e o tipo no seletor; a API valida novamente na borda.
- **Observabilidade:** `log()` com `operation`, `outcome`, `durationMs`, `chunkCount`, `userId` e
  IDs opacos. Nunca nome de arquivo, hash, trecho de conteúdo ou chave.

## 5. Arquivos e áreas afetadas

- `apps/api/src/modules/sources/**` (novo slice completo).
- `apps/api/src/app.module.ts`, `apps/api/src/test/setup-env.ts`, `apps/api/src/test/fakes/**`.
- `apps/api/package.json` e `bun.lock` (multer, @types/multer, pdf-parse).
- `db/migrations/0003_knowledge_sources.sql`, `db/tests/003_knowledge_sources.test.sql`.
- `apps/web/app/app/page.tsx`, `apps/web/app/app/source-actions.ts`,
  `apps/web/app/app/_components/knowledge-sources.tsx`, `apps/web/lib/knowledge/types.ts`,
  `apps/web/next.config.js` (bodySizeLimit).
- `apps/web/e2e/support/fake-api-server.ts`, `apps/web/e2e/knowledge-sources.spec.ts`.
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/BUSINESS.md`, `.specs/013-knowledge-files.md`,
  este plano.

## 6. Passos de implementação

- [x] 6.1 Validar DoR/contexto e criar este plano; mudar spec e plano para `implementing`.
- [x] 6.2 Instalar `multer`, `@types/multer` e `pdf-parse` com versões fixadas; justificar no relatório.
- [x] 6.3 Domínio: tipos, política de arquivo/hash/chunks e erros + testes unitários.
- [x] 6.4 Migração 0003 + teste SQL; rodar apenas `bun run db:migrate`.
- [x] 6.5 Portas e repositório `pg` com isolamento e `withDbSpan`; testes com mock de pool.
- [x] 6.6 Adaptadores: extrator, embeddings, vetores REST + testes com fakes/servidor HTTP local.
- [x] 6.7 Casos de uso: conectar (dedup/versionar/assíncrono), listar, excluir, processar + testes.
- [x] 6.8 Request handlers e módulo DI + testes de integração (Supertest, guard fake).
- [x] 6.9 Web: tipos, Server Actions, FAB/painel e integração na home + testes de actions.
- [x] 6.10 E2E: rotas de fontes na fake API e especificação Playwright.
- [x] 6.11 Documentação afetada e atualização dos critérios de aceite na spec.
- [x] 6.12 QA completo (lint, tipos, testes, build, E2E) e commit local na `spec/013`.

Cada critério de aceite é coberto por ao menos um teste listado no plano de testes (§8) e por um
passo de QA manual (§9).

## 7. Riscos e mitigação

| Risco                                 | Mitigação                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Dados sensíveis em documentos         | Nada de conteúdo/nome/hash em logs; isolamento por `userId` no DB e no vetor. |
| Duplicação sob concorrência           | Índice único parcial + tratamento de `23505` como “Already connected”.        |
| Vetor órfão após exclusão             | Vetores removidos antes dos registros; falha mantém a fonte para retry.       |
| Extração silenciosa vazia             | Texto vazio/não decodificável gera `failed`, nunca `ready`.                   |
| Weaviate sem gRPC exposto             | Adapter usa apenas REST/GraphQL na porta 8080.                                |
| Limites ainda sem dono                | Constantes centralizadas no domínio e follow-up registrado na spec/relatório. |
| Build/E2E com limite do Server Action | `serverActions.bodySizeLimit` alinhado ao limite da API.                      |

## 8. Plano de testes

- Unitário (Vitest/API): hash estável, validação de tipo/tamanho, normalização de nome, chunking,
  decisão de dedup, versionamento, falha e retry, exclusão isolada, logs sem PII.
- Integração (Vitest + Supertest/API): upload novo/duplicado/inválido, concorrência, listagem e
  exclusão com fakes de repositório/extrator/embedding/vetor; adapter Weaviate contra servidor HTTP
  local que simula REST/GraphQL.
- Banco (`bun run db:test`): constraints, índice único, `isStale` e cascata de exclusão.
- Web (Vitest): actions mapeiam erros e enviam multipart sem token ao cliente.
- E2E (Playwright): FAB, envio de TXT/MD/PDF, status, reenvio sem duplicação, tipo inválido,
  exclusão, 360/768/1280 px, teclado e foco visível.
- Regressão: suítes de auth, navegação e chat permanecem verdes.

## 9. QA manual

1. Abrir `/app` com sessão: FAB visível e lista vazia com orientação.
2. Enviar `.txt`: status `processing` → `ready`, chunks e vetores gravados.
3. Reenviar o mesmo arquivo: “Already connected”, sem nova versão.
4. Enviar `.md` e `.pdf` com o mesmo nome base e conteúdo diferente: nova versão, anterior antiga.
5. Enviar `.exe`: mensagem en-US com PDF, TXT e Markdown.
6. Excluir fonte: lista atualizada, vetores removidos, histórico de chat preservado.
7. Inspecionar logs do API e do coletor: sem conteúdo, nome de arquivo, hash ou chave.
8. Verificar 360/768/1280 px e navegação por teclado com foco visível.

## 10. Rollout e rollback

- Sem feature flag: FAB passa a existir na home privada; chat segue intacto.
- Rollback: esconder FAB e desregistrar o módulo `SourcesModule`; tabelas e vetores permanecem.
- Migração é aditiva; nenhuma migração down é executada nesta fatia.

## 11. Evidências e pendências

- `bun run lint`, `bun run types:check`, `bun run test`, `bun run build` e `bun run test:e2e`: ver
  `.docs/QA.md` (seção de evidências da spec 013) para contagens e resultados.
- `bun run db:migrate` foi executado uma vez e falhou com `ECONNREFUSED 127.0.0.1:5433`; o schema
  `0003_knowledge_sources.sql` não foi confirmado no PostgreSQL local. `bun run db:test` não foi
  autorizado nesta entrega e não foi executado.
- A integração real com Weaviate/OpenAI foi validada por adaptadores com servidor HTTP local e
  fakes; não houve chamada com o `OPENAI_API_KEY` do ambiente durante os testes.
- Seguem em aberto, sem bloqueio para esta fatia: limites definitivos de envio, retenção e metas
  numéricas de latência/custo (decisões do solicitante registradas na spec).
