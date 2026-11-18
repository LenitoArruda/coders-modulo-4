# Orquestração — specs 012–018

> **Range:** 012-018
> **Criado em:** 2026-11-17
> **Branch base:** `feat/code-review-skill` @ `1412ae6`
> **Status:** in_progress

## 1. Specs do range

| Spec | Título                             | Status   | Worktree      | Branch     | Estado     | Observações                                                  |
| ---- | ---------------------------------- | -------- | ------------- | ---------- | ---------- | ------------------------------------------------------------ |
| 012  | Catálogo de Experts e chat         | done     | —             | —          | pulada     | entregue manualmente antes da orquestração; commit `1412ae6` |
| 013  | Fontes de conhecimento por arquivo | done     | `../spec-013` | `spec/013` | mesclada   | commit `92e4a5c`; merge `b8c99d8`; QA verde                  |
| 014  | Fontes de conhecimento por URL     | done     | `../spec-014` | `spec/014` | mesclada   | commit `2516a7c`; merge `b16f183`; gates verdes              |
| 015  | Fontes de conhecimento por mídia   | done     | `../spec-015` | `spec/015` | mesclada   | commit `3d29102`; merge `b9b4d89`; QA verde                  |
| 016  | Respostas com RAG e citações       | done     | `../spec-016` | `spec/016` | mesclada   | commit `c84aa5f`; merge `eee1cd5`; QA verde                  |
| 017  | Entregáveis multimídia             | approved | `../spec-017` | `spec/017` | executando | onda 3; HEAD `dd33577`; risco Gemini/Veo billing             |
| 018  | LangSmith local                    | done     | `../spec-018` | `spec/018` | mesclada   | commit `5e2ad77`; merge `ae91965`; QA verde                  |

Estados: `pendente | executando | mesclada | bloqueada | falhou | pulada`.

## 2. Ondas

| Onda | Specs         | Lançada em | Concluída em | Merge/push                                             |
| ---- | ------------- | ---------- | ------------ | ------------------------------------------------------ |
| 1    | 013           | 21:32      | 2026-11-18   | merge `b8c99d8`; push `b1d10c7`                        |
| 2    | 014, 015, 016 | 2026-11-18 | 2026-11-18   | merges `b16f183`, `b9b4d89`, `eee1cd5`; push `dd33577` |
| 3    | 017, 018      | 2026-11-18 | —            | merge `ae91965` (018); push pendente                   |

Ondas confirmadas pelo usuário em 2026-11-17. A onda 1 foi concluída e publicada com QA verde.
A onda 2 foi lançada em paralelo com worktrees independentes; a onda 3 segue após sua integração.

## 3. Grafo de dependências

```text
012 (done)
├── 013 (mesclada)
│   ├── 014 (mesclada)
│   ├── 015 (mesclada) ──► 017 (pendente)
│   └── 016 (mesclada) ──► 018 (pendente)
└── 017 (pendente)
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
- 2026-11-18 — [013] subagente relançado (`ses_e1179fbf3ffecrF6VpXnZfhplX`) e concluído com
  `RESULTADO: ok`; commit `92e4a5c` na branch `spec/013`.
- 2026-11-18 — [013] merge `--no-ff` na principal (`b8c99d8`). Migration `0003_knowledge_sources.sql`
  aplicada; `db:test` 3/3 verde.
- 2026-11-18 — QA de integração: `lint` 3/3, `types:check` 3/3, `test` API 64/421 + web 11/137,
  `build` 2/2. E2E estabilizado com `40e941b` (timeout de expect 30 s e timeout do teste de
  sessão única 90 s): 136/136 verde.
- 2026-11-18 — onda 1 publicada: `a9b3ebb..b1d10c7` (push principal) e `b1d10c7..453db9c`
  (atualização do log). Worktree `../spec-013` e branch `spec/013` removidos.
- 2026-11-18 — onda 2 lançada: worktrees `../spec-014`, `../spec-015`, `../spec-016` criados do
  HEAD `453db9c` com `.env` copiado; subagentes `ses_e112519c6ffeIgSGazd3F9AZTB` (014),
  `ses_e112519c3ffeaOPBw7st7yYVhF` (015) e `ses_e112519bdffe8Lv4f1WPGrZLWx` (016) em background.
- 2026-11-18 — [014] `RESULTADO: ok`; commits `2516a7c` e `1a510c3`; merge `b16f183`. Gates na
  principal: `lint` 3/3, `types:check` 3/3, `test` API 66/442 + web 11/147, `build` 2/2. E2E da
  fatia passou no worktree (11 cenários novos); E2E consolidado na principal fica para o fim da onda.
- 2026-11-18 — [015] `RESULTADO: ok`; commits `3d29102` e `f15f276`. `db:migrate`/`db:test`,
  lint, tipos, testes e build verdes no worktree; E2E 146/146 em portas isoladas 3015/3435.
- 2026-11-18 — [015] merge `b9b4d89` após combinar 11 conflitos aditivos entre 014 e 015 em API,
  web e documentação; nenhuma funcionalidade foi descartada.
- 2026-11-18 — correção de integração `02e8320`: `durationSeconds: null` nas fontes URL e
  `FakeWebPageFetcher` no teste da 015, eliminando as duas quebras de tipo do merge.
- 2026-11-18 — QA consolidado 014+015 na principal: `lint` 3/3, `types:check` 3/3, `test` API
  69/463 + web 12/152, `build` 2/2, `test:e2e` 157/157. `db:migrate` na principal segue bloqueado
  porque o Docker não está disponível (5433 recusa conexão); a 015 validou as 4 migrações no
  worktree com banco isolado.
- 2026-11-18 — progresso 014+015 publicado: `859de4c..c561cb8` com a credencial `LenitoArruda`.
  Worktrees `spec-014` e `spec-015` removidos (via espelhamento com pasta vazia, por caminhos
  longos no Windows) e branches `spec/014`/`spec/015` excluídas.
- 2026-11-18 — [016] `RESULTADO: ok`; commit `c84aa5f`. A migration da fatia foi renomeada de
  `0004_rag_citations.sql` para `0005_rag_citations.sql` (e o teste para `005_...`) porque a 015 já
  havia ocupado `0004` na principal; refs em spec, plano e docs atualizadas.
- 2026-11-18 — [016] merge `eee1cd5` após conflitos aditivos em `.docs/ARCHITECTURE.md` e
  `.docs/QA.md`. Nenhum código da slice `sources` foi alterado.
- 2026-11-18 — QA final da onda 2 na principal: `lint` 3/3, `types:check` 3/3, `test` API 74/483
  - web 12/156, `build` 2/2, `test:e2e` 163/163. `db:migrate`/`db:test` continuam bloqueados na
    principal: Docker fora e a porta 5432 recusou as credenciais do `.env`; as migrações da 015 e
    016 foram validadas nos worktrees com bancos isolados.
- 2026-11-18 — onda 2 publicada: `c561cb8..dd33577` com a credencial `LenitoArruda`; worktree
  `spec-016` e branch `spec/016` removidos. Todas as specs 014–016 estão integradas e publicadas.
- 2026-11-18 — onda 3 lançada: worktrees `../spec-017` e `../spec-018` criados do HEAD `dd33577`
  com `.env` copiado; subagentes `ses_e10b14beeffeAMP0vDnQLKMDTp` (017) e
  `ses_e10b14bedffet87IcR6BiNC2B9` (018) em background, com portas E2E isoladas 3017/3437 e
  3018/3438.
- 2026-11-18 — [018] `RESULTADO: ok`; commit `5e2ad77`, merge `ae91965` sem conflitos. Nova slice
  `observability` local-first, flag desligada por default, evaluation offline e 4 datasets; sem
  migration e sem nova dependência.
- 2026-11-18 — [018] QA na principal: `lint` 3/3, `types:check` 3/3, `test` API 87/593 + web
  12/156, `build` 2/2, `obs:eval` 4/4, `test:e2e` 163/163. Studio/traces ao vivo não validados:
  imagem LangSmith self-hosted é Enterprise/licenciada e o Docker não está disponível.

## 5. Resultado consolidado

| Spec | Resultado  | Commit da spec | Merge     | QA    | Bloqueios          |
| ---- | ---------- | -------------- | --------- | ----- | ------------------ |
| 012  | pulada     | `1412ae6`      | —         | verde | —                  |
| 013  | ok         | `92e4a5c`      | `b8c99d8` | verde | —                  |
| 014  | ok         | `2516a7c`      | `b16f183` | verde | —                  |
| 015  | ok         | `3d29102`      | `b9b4d89` | verde | —                  |
| 016  | ok         | `c84aa5f`      | `eee1cd5` | verde | —                  |
| 017  | executando | —              | —         | —     | onda 3; Gemini/Veo |
| 018  | ok         | `5e2ad77`      | `ae91965` | verde | —                  |

## 6. Retomada

018 integrada com QA verde; falta 017. Para retomar: aguardar o `RESULTADO` de 017, integrá-la com
`merge --no-ff`, rodar QA completo na principal, publicar a onda e remover os worktrees `spec-017`
e `spec-018`. Riscos: geração de vídeo da 017 via Gemini/Veo pode exigir billing ativado; o
`db:migrate` da principal depende de Docker, indisponível no momento.
