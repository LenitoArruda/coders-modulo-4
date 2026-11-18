# Plano — Documentação, observabilidade e especificações de IA

> **Status:** concluído (documentação; sem mudança de runtime) · **Criado em:** 2026-11-18
> **Tipo:** melhoria de documentação (sem mudança de comportamento de runtime)

---

## 1. Contexto e problema

As specs 000–018 estão implementadas e integradas, mas os documentos de entrada e algumas
afirmações isoladas ainda descrevem o estado da fundação (specs 000–003):

- `README.md` diz que o produto "não implementa ainda funcionalidades" e lista apenas rotas de
  auth, sem cobrir Experts, fontes, RAG, citações, multimídia, LangSmith local ou avaliação.
- `.docs/AGENTS.md` afirma que fontes, RAG, citações e entregáveis não estão implementados e seu
  mapa não inclui `OBSERVABILITY.md`.
- `.docs/ARCHITECTURE.md` e `.docs/BUSINESS.md` têm resumos executivos que contradizem seções
  detalhadas e specs `done`.
- `.docs/QA.md` ainda registra "produto não implementado" como lacuna conhecida.
- Não existe um documento único de IA/LLM/RAG, nem um README para `eval/datasets/`.
- O inventário de `observability/` (dashboards, coletor Postgres, gerador, built-ins) não está
  explicado em nenhum lugar.
- A ausência de ADRs para decisões de IA/RAG/observabilidade deixa o "porquê" apenas em planos.

## 2. Objetivo e critérios de aceite

1. ✅ **AC-1** — `README.md` reflita o estado atual (specs 000–018), com stack, comandos, portas,
   variáveis (apenas nomes/defaults públicos) e índice documental completos.
2. ✅ **AC-2** — `.docs/AGENTS.md`, `.docs/RULES.md`, `.docs/DEVELOPMENT.md`, `.docs/ARCHITECTURE.md`,
   `.docs/BUSINESS.md` e `.docs/QA.md` não contradigam o código nem as specs `done`; todas as
   datas de atualização foram revisadas para 2026-11-18.
3. ✅ **AC-3** — `.docs/AI.md` detalha a implementação de IA: catálogo de Experts, chat, fontes
   (arquivo/URL/mídia), recuperação e citações, entregáveis multimídia, modelos, flags, contratos,
   segurança, avaliação, observabilidade e decisões abertas.
4. ✅ **AC-4** — `.docs/OBSERVABILITY.md` foi ampliado com inventário de arquivos, pipeline de
   telemetria, contrato de span, dashboards, runbook e limites conhecidos, sem revelar valores
   sensíveis.
5. ✅ **AC-5** — `eval/datasets/README.md` documenta esquema, proveniência sintética e execução da
   CLI `obs:eval`.
6. ✅ **AC-6** — nenhum valor de `.env`, token, chave, URL sensível, hash, trecho de prompt ou
   conteúdo de arquivo sensível foi lido para exibição, reproduzido ou versionado.
7. ✅ **AC-7** — links internos relativos entre documentos validados e `git diff --check` executado
   (detalhes na §10).

## 3. Escopo

### Dentro

- Reescrita/atualização dos documentos listados em AC-1 a AC-5.
- Correção de afirmações desatualizadas e datas.
- Criação de índice navegável spec → plano → documento → evidência de QA.
- ADRs para decisões já consolidadas em código (somente se necessário para preservar racional).

### Fora

- Mudanças de comportamento em runtime, prompts, modelos, infraestrutura ou configuração.
- Leitura ou reprodução de conteúdo de prompts de IA.
- Alteração de `.env`, credenciais ou arquivos de terceiros em `.agents/skills/**`.
- Push remoto sem pedido explícito.

## 4. Abordagem técnica

1. Mapear documentação, observabilidade e código de IA com subagentes de exploração.
2. Consolidar inventário e divergências neste plano.
3. Editar documentos com `write`/`edit`, priorizando precisão sobre volume.
4. Validar links e consistência; rodar `git diff --check`.
5. Entregar relatório final no formato de `.docs/RULES.md §8`.

## 5. Arquivos e áreas previstos

- `README.md`
- `.docs/AGENTS.md`
- `.docs/RULES.md`
- `.docs/DEVELOPMENT.md`
- `.docs/ARCHITECTURE.md`
- `.docs/BUSINESS.md`
- `.docs/QA.md`
- `.docs/OBSERVABILITY.md`
- `.docs/AI.md` (novo)
- `eval/datasets/README.md` (novo)
- `.adrs/` (ADRs novos, se necessário)
- `.specs/README.md` (índice navegável)

## 6. Riscos e mitigação

| Risco                                                      | Mitigação                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Documentar comportamento que mudou entre specs sem validar | Conferir código/specs antes de afirmar; marcar incerteza como decisão aberta |
| Expor informação sensível                                  | Não abrir `.env`; não ler prompts; revisar diff antes de commit              |
| Duplicar conteúdo entre docs                               | Documento dono por assunto; outros apenas linkam                             |
| ADRs duplicando `ARCHITECTURE.md §6`                       | Criar ADR só para decisão com trade-off relevante; atualizar índice          |

## 7. Plano de testes

- `git diff --check`
- Verificação manual de links relativos nos arquivos alterados.
- Conferência manual de que nenhum trecho de `.env`/prompt/token aparece no diff.
- Revisão cruzada: cada afirmativa de estado comparada com spec `done` ou código.

## 8. QA manual

1. Abrir `README.md` e conferir que não há mais "fundação/não implementa produto".
2. Abrir `.docs/AI.md` e conferir cobertura das specs 012–018.
3. Abrir `.docs/OBSERVABILITY.md` e conferir inventário de `observability/`.
4. Rodar `git diff --check`; conferir `git status`.
5. Revisar diff completo procurando segredos/prompts.

---

## 9. Evidências e pendências

### 9.1 Mapeamento de documentação (concluído)

- 19 specs (`000`–`018`), todas `done` (018 com ressalva local-first); 19 planos de spec, 4 planos
  de breakdown/orquestração e 13 planos de processo; 16 ADRs antes desta mudança (`0001`–`0016`).
- `.docs/` tem 9 arquivos; faltam `AI.md` e README de `eval/datasets/`.
- Divergências confirmadas: `README.md` e `.docs/AGENTS.md` descrevem fundação/spec 012;
  `ARCHITECTURE.md §5/§6/§2`, `BUSINESS.md §8.2`, `QA.md §10` (linhas 545/550),
  `RULES.md`/`DEVELOPMENT.md` com data 2026-11-09; `.adrs/README.md` para em 0016.
- Convenção: PT-BR em docs, en-US em código/produto; specs 1–15 seções; ADR 4 dígitos;
  legendas ✅/🧭/🔍; fonte de verdade `RULES.md` > `AGENTS.md` > técnicas > `BUSINESS.md`.

### 9.2 Mapeamento de observabilidade (concluído)

- Dois sistemas independentes: OTel nativo (NodeSDK + HttpInstrumentation + logs/métricas OTLP,
  spans manuais `withDbSpan`) e spans customizados tipo LangSmith (spec 018, flag desligada
  por padrão, sink HTTP local-only com sanitização e pseudonimização HMAC).
- `requestId` HTTP, `traceId` OTel e `traceId` LangSmith **não** são unificados.
- Dashboards gerados por `observability/gen-dashboard.mjs` (10 rows, 51 painéis, 64 queries);
  filtro `postgresql_database_name="postgres"` fixo diverge do `${POSTGRES_DB}` do Compose;
  métricas `otelcol_*`/algumas `postgresql_*` não têm scraping declarado; não há alertas
  provisionados, nem painéis de chat/RAG/custo/mídia/fila.
- `createMediaSpanMetadata()` e `createSourceSpanMetadata()` existem e são testados, mas não
  são chamados nos fluxos reais.
- `HttpTraceSink` usa array sem limite (doc dizia "fila limitada"); o campo correto é
  `estimatedCostUsd` (doc dizia `estimatedCost`).
- Path HTTP logado sem normalização (risco de cardinalidade); custo/ingestão não são métricas OTel.

### 9.3 Mapeamento de IA/specs (concluído)

- `012`–`018` estão `done`; `018` registra ressalva local-first (Studio, traces ao vivo e stack
  licenciada bloqueados). Contratos públicos confirmados: `Citation`, `RetrievalMetadata`,
  `AnswerStatus`, `MediaAttachment`, `MediaStatus`, `MediaErrorCode` e `{ code, message,
fieldErrors? }`.
- Defaults confirmados em `env.ts`: `EXPERT_PROMPT_MAX_LENGTH=4000`, `RAG_CITATIONS_ENABLED=false`,
  `RAG_TOP_K=5`, `RAG_THRESHOLD=0.35`, `RAG_MAX_CONTEXT_CHARS=6000`,
  `RAG_MAX_HISTORY_MESSAGES=6`, `KNOWLEDGE_MEDIA_ENABLED=false`,
  `MULTIMEDIA_DELIVERABLES_ENABLED=false`, cota `10` imagens/`2` vídeos por hora e limiar default
  de evaluation `0.8`. `WEAVIATE_URL`/`EMBEDDING_DIMENSIONS` são lidos diretamente nos módulos.
- Flags web por cookie: `knowledge_media_enabled` e `multimedia_deliverables_enabled`; token interno
  `SOURCE_MEDIA_ENABLED`. Prefixo global `/api/v1`.
- Divergências mapeadas e registradas em `.docs/AI.md §12`: 012 mantém decisão de agrupamento como
  aberta na spec; 013 já adotou `10 MB`/`5 arquivos` e retenção até exclusão; 014 fixou timeout
  `8 s`, `2 MB`, `3` redirects e `1` retry; 015 diz "sem migração" mas existe `0004`; 016/017 têm
  precedência de citação a definir; 017 cita Gemini genérico, usa `bytea` e fila/cota voláteis;
  018 mistura critérios `BLOQUEADO`/`PARCIAL` sob status `done`.
- Validações bloqueadas/parciais documentadas: migrações em Docker local, LangSmith licenciado,
  vídeo Gemini com billing, metas `≥ 90%`/`≥ 85%`/p95 `< 4 s` não medidas.
- Resultado: `.docs/AI.md`, `eval/datasets/README.md`, índice em `.specs/README.md` e ADRs
  `0017`–`0020` criados; nenhuma spec canônica reescrita.

## 10. Resultado da verificação

- `git diff --check`: sem erros de whitespace (avisos de LF/CRLF são esperados no Windows).
- Links relativos dos arquivos alterados verificados por script: arquivos existentes e âncoras
  conferidas contra os títulos de destino.
- Varredura do diff: sem `.env`, chave, token, hash, URL sensível, prompt, resposta ou PII.
- `git status` no momento da verificação: 10 arquivos modificados, 7 novos. A publicação em
  commit/push foi feita em etapa separada, mediante pedido explícito.
- Não foram executados `lint`/`types:check`/`test`/`build`: a mudança é exclusivamente documental
  e nenhum arquivo de runtime foi tocado.
