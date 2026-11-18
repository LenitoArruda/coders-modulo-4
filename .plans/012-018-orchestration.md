# Orquestração — specs 012–018

> **Range:** 012-018
> **Criado em:** 2026-11-17
> **Branch base:** `feat/code-review-skill` @ `1412ae6`
> **Status:** running

## 1. Specs do range

| Spec | Título                             | Status   | Worktree                      | Branch     | Estado   | Observações                                                  |
| ---- | ---------------------------------- | -------- | ----------------------------- | ---------- | -------- | ------------------------------------------------------------ |
| 012  | Catálogo de Experts e chat         | done     | —                             | —          | pulada   | entregue manualmente antes da orquestração; commit `1412ae6` |
| 013  | Fontes de conhecimento por arquivo | approved | `../coders-modulo-4-spec-013` | `spec/013` | pendente | —                                                            |
| 014  | Fontes de conhecimento por URL     | approved | `../coders-modulo-4-spec-014` | `spec/014` | pendente | —                                                            |
| 015  | Fontes de conhecimento por mídia   | approved | `../coders-modulo-4-spec-015` | `spec/015` | pendente | —                                                            |
| 016  | Respostas com RAG e citações       | approved | `../coders-modulo-4-spec-016` | `spec/016` | pendente | —                                                            |
| 017  | Entregáveis multimídia             | approved | `../coders-modulo-4-spec-017` | `spec/017` | pendente | —                                                            |
| 018  | LangSmith local                    | approved | `../coders-modulo-4-spec-018` | `spec/018` | pendente | —                                                            |

Estados: `pendente | executando | mesclada | bloqueada | falhou | pulada`.

## 2. Ondas

| Onda | Specs         | Lançada em | Concluída em | Merge/push |
| ---- | ------------- | ---------- | ------------ | ---------- |
| 1    | 013           | —          | —            | —          |
| 2    | 014, 015, 016 | —          | —            | —          |
| 3    | 017, 018      | —          | —            | —          |

Ondas confirmadas pelo usuário em 2026-11-17.

## 3. Grafo de dependências

```text
012 (done)
├── 013
│   ├── 014
│   ├── 015 ──► 017 (referência de mídia, opcional)
│   └── 016 ──► 018
└── 017 (depende de 012; usa 015 quando há mídia)
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

## 5. Resultado consolidado

| Spec | Resultado | Commit da spec | Merge | QA    | Bloqueios |
| ---- | --------- | -------------- | ----- | ----- | --------- |
| 012  | pulada    | `1412ae6`      | —     | verde | —         |
| 013  | pendente  | —              | —     | —     | —         |
| 014  | pendente  | —              | —     | —     | —         |
| 015  | pendente  | —              | —     | —     | —         |
| 016  | pendente  | —              | —     | —     | —         |
| 017  | pendente  | —              | —     | —     | —         |
| 018  | pendente  | —              | —     | —     | —         |
