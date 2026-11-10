# Orquestração — specs 002–008

> **Range:** 002-008
> **Criado em:** 2026-11-09
> **Branch base:** main @ f10aef4
> **Status:** running

## 1. Specs do range

| Spec | Título               | Status   | Worktree                      | Branch   | Estado   | Observações               |
| ---- | -------------------- | -------- | ----------------------------- | -------- | -------- | ------------------------- |
| 002  | Auth session         | approved | `../coders-modulo-4-spec-002` | spec/002 | pendente | onda 1                    |
| 003  | Auth routes          | approved | —                             | —        | pendente | onda 2                    |
| 004  | Auth sign-up         | approved | —                             | —        | pendente | onda 3                    |
| 005  | Auth confirm account | approved | —                             | —        | pendente | onda 4 (paralela com 007) |
| 006  | Auth sign-in         | approved | —                             | —        | pendente | onda 5                    |
| 007  | Auth forgot password | approved | —                             | —        | pendente | onda 4 (paralela com 005) |
| 008  | Auth reset password  | approved | —                             | —        | pendente | onda 6                    |

Estados: `pendente | executando | mesclada | bloqueada | falhou | pulada`.

Nota: a dependência `001-auth-schema` está fora do range e foi concluída (`done`) antes do
lançamento da onda 1 — migração aplicada, 32 testes pgTAP passando, commit `f10aef4`.

## 2. Ondas

| Onda | Specs    | Lançada em | Concluída em | Merge/push |
| ---- | -------- | ---------- | ------------ | ---------- |
| 1    | 002      | —          | —            | —          |
| 2    | 003      | —          | —            | —          |
| 3    | 004      | —          | —            | —          |
| 4    | 005, 007 | —          | —            | —          |
| 5    | 006      | —          | —            | —          |
| 6    | 008      | —          | —            | —          |

## 3. Grafo de dependências

```text
001 (done) → 002 → 003 → 004 → 005 → 006 → 008
                     └────→ 007 ────────→ 008
```

## 4. Log de progresso

- (a preencher a cada evento)

## 5. Resultado consolidado

| Spec | Resultado | Commit da spec | Merge | QA  | Bloqueios |
| ---- | --------- | -------------- | ----- | --- | --------- |
