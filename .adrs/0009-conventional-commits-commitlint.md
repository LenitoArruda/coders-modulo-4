# ADR 0009 — Conventional Commits com commitlint e hooks Git

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O histórico era manual e sem validação, o que permite mensagens inconsistentes e dificulta
leitura, changelog e automação futura. O fluxo de agentes também precisa de um formato
previsível para commits gerados automaticamente.

## Decisão

Adotar **Conventional Commits** em inglês, no imperativo:

```text
<tipo>(<escopo opcional>): <resumo>
```

A validação usa **commitlint 21.2.4** com `@commitlint/config-conventional`, executado pelo
hook `commit-msg` do Lefthook. O hook `pre-commit` roda `lint-staged` (ADR 0011). Commits
criados pelo fluxo de agentes incluem o trailer
`Co-authored-by: OpenCode Agent <noreply@opencode.ai>`. O commit inicial do starter permanece fora do
padrão como exceção histórica e não deve ser reescrito.

## Consequências

### Positivas

- Histórico consistente e legível.
- Mensagens inválidas são bloqueadas antes de entrar no repositório.
- Base para changelog e versionamento automáticos no futuro.
- Agentes seguem um formato único e validável.

### Negativas / trade-offs

- Exige instalar os hooks (`bun install` executa `lefthook install`).
- Mensagens fora do padrão são rejeitadas, inclusive em correções urgentes.
- O commit inicial existente é uma exceção documentada.

## Alternativas consideradas

| Alternativa    | Por que foi descartada                      |
| -------------- | ------------------------------------------- |
| Commits livres | Histórico inconsistente e sem validação     |
| Husky          | Lefthook já estava adotado no projeto       |
| Sem hooks      | A validação dependeria de disciplina manual |

## Referências

- [`commitlint.config.mjs`](../commitlint.config.mjs)
- [`lefthook.yml`](../lefthook.yml)
- [`.docs/AGENTS.md`](../.docs/AGENTS.md)
