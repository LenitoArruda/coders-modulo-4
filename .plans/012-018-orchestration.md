# Orquestração — specs 012–018

> **Range:** 012-018
> **Criado em:** 2026-11-17
> **Branch base:** `feat/code-review-skill` @ `1412ae6`
> **Status:** partial

## 1. Specs do range

| Spec | Título                             | Status   | Worktree      | Branch     | Estado     | Observações                                                  |
| ---- | ---------------------------------- | -------- | ------------- | ---------- | ---------- | ------------------------------------------------------------ |
| 012  | Catálogo de Experts e chat         | done     | —             | —          | pulada     | entregue manualmente antes da orquestração; commit `1412ae6` |
| 013  | Fontes de conhecimento por arquivo | approved | `../spec-013` | `spec/013` | executando | relançada após desbloqueio (`a9b3ebb`); chaves no `.env`     |
| 014  | Fontes de conhecimento por URL     | approved | —             | —          | bloqueada  | removida da fila: depende de 013                             |
| 015  | Fontes de conhecimento por mídia   | approved | —             | —          | bloqueada  | removida da fila: depende de 013                             |
| 016  | Respostas com RAG e citações       | approved | —             | —          | bloqueada  | removida da fila: depende de 013                             |
| 017  | Entregáveis multimídia             | approved | —             | —          | bloqueada  | não lançada: credenciais de imagem/vídeo e decisões abertas  |
| 018  | LangSmith local                    | approved | —             | —          | bloqueada  | removida da fila: depende de 016                             |

Estados: `pendente | executando | mesclada | bloqueada | falhou | pulada`.

## 2. Ondas

| Onda | Specs         | Lançada em | Concluída em | Merge/push |
| ---- | ------------- | ---------- | ------------ | ---------- |
| 1    | 013           | 21:32      | —            | —          |
| 2    | 014, 015, 016 | —          | —            | —          |
| 3    | 017, 018      | —          | —            | —          |

Ondas confirmadas pelo usuário em 2026-11-17. Ondas 2 e 3 **não foram lançadas**: a onda 1
terminou bloqueada e suas dependentes transitivas saíram da fila.

## 3. Grafo de dependências

```text
012 (done)
├── 013 (bloqueada)
│   ├── 014 (bloqueada)
│   ├── 015 (bloqueada) ──► 017 (bloqueada)
│   └── 016 (bloqueada) ──► 018 (bloqueada)
└── 017 (bloqueada)
```

Detalhamento:

- 013 depende de 012 (done).
- 014 depende de 013.
- 015 depende de 013.
- 016 depende de 012 e 013.
- 017 depende de 012 e usa 015 quando há referência de mídia.
- 018 depende de 012 e 016.

## 4. Log de progresso

- 21:31 — range resolvido: 012 `done` (pulada), 013–018 `approved`.
- 21:31 — prontidão validada: specs aprovadas, árvore limpa, infra local no ar.
- 21:31 — ondas confirmadas pelo usuário; arquivo de orquestração criado.
- 21:32 — [013] worktree `../coders-modulo-4-spec-013` criado em `spec/013` a partir de `12f3ebe`,
  com `.env` copiado; subagente `ses_e13ed9085ffeMT4lx8Fh8rCqBf` lançado em background.
- 21:36 — [013] `RESULTADO: bloqueado`. Nenhum commit. Subagente parou antes do plano por três
  pré-requisitos: Weaviate fora do Compose/sem imagem local/porta 8080 sem resposta;
  `OPENAI_API_KEY` ausente no `.env` e no ambiente; decisão aberta bloqueante sobre o modelo de
  embedding (dono Engenharia), que define dimensionalidade, distância e schema da collection.
- 21:36 — sem retry automático (regra da skill). 014, 015, 016 e 018 removidas da fila por
  dependência transitiva de 013; 017 não lançada por compartilhar a ausência de credenciais
  externas e ter decisões abertas próprias. Worktree `spec/013` mantido para continuação.
- 2026-11-18 — usuário forneceu credenciais (`OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`)
  e decidiu o embedding (`text-embedding-3-small`, 1536 dims, cosine). Orquestrador registrou a
  decisão na spec, adicionou Weaviate 1.40.5 ao Compose (`a9b3ebb`), subiu a infra (`:8080` → 200)
  e recriou o worktree `../spec-013` a partir de `a9b3ebb` com `.env` atualizado.
- 2026-11-18 — [013] subagente relançado.

## 5. Resultado consolidado

| Spec | Resultado | Commit da spec | Merge | QA    | Bloqueios                                                       |
| ---- | --------- | -------------- | ----- | ----- | --------------------------------------------------------------- |
| 012  | pulada    | `1412ae6`      | —     | verde | —                                                               |
| 013  | bloqueada | —              | —     | —     | Weaviate ausente; `OPENAI_API_KEY` ausente; modelo de embedding |
| 014  | bloqueada | —              | —     | —     | depende de 013                                                  |
| 015  | bloqueada | —              | —     | —     | depende de 013                                                  |
| 016  | bloqueada | —              | —     | —     | depende de 013                                                  |
| 017  | bloqueada | —              | —     | —     | credenciais de imagem/vídeo; decisões abertas                   |
| 018  | bloqueada | —              | —     | —     | depende de 016                                                  |

## 6. Retomada

Para retomar: (a) decidir e documentar o modelo de embedding (modelo, dimensões, métrica de
distância); (b) disponibilizar `OPENAI_API_KEY` no ambiente da API e, para a 017, credencial Gemini;
(c) adicionar o serviço Weaviate ao `docker-compose.yml` e subi-lo na infra compartilhada; (d)
relançar `orchestrate-me 013-018` (ou `implement-me` individual). O worktree `spec/013` e a branch
foram preservados; a spec permanece `approved` na principal.
