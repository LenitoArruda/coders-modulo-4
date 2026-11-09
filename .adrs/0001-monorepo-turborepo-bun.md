# ADR 0001 — Monorepo com Turborepo e Bun

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O produto precisa de um app web, um site de documentação, uma API e pacotes compartilhados de
UI, lint e tipagem. Manter repositórios separados exigiria versionar e publicar cada pacote,
duplicar configurações e coordenar mudanças entre web e API. O time é pequeno e a fundação
precisa ser reproduzível em uma única máquina.

## Decisão

Adotar um monorepo **Turborepo 2.11.10** gerenciado com **Bun 1.4.4**, com workspaces em
`apps/*` e `packages/*`. As tarefas `lint`, `types:check`, `test`, `test:e2e`, `build` e `dev`
são orquestradas pelo Turbo a partir da raiz, com cache local e execução paralela.

## Consequências

### Positivas

- Uma única instalação e um único lockfile para todo o projeto.
- Código e configurações compartilhados (`packages/ui`, `eslint-config`,
  `typescript-config`).
- Cache e paralelismo reduzem o custo dos gates de QA.
- Mudanças entre web, API e pacotes ficam atômicas no mesmo commit.

### Negativas / trade-offs

- O projeto fica acoplado ao Bun e ao Turborepo.
- Fronteiras entre pacotes exigem disciplina para não criar dependências circulares.
- O cache precisa de `inputs`/`outputs` corretos para não mascarar mudanças.

## Alternativas consideradas

| Alternativa                   | Por que foi descartada                               |
| ----------------------------- | ---------------------------------------------------- |
| Repositórios separados        | Coordenação e publicação de pacotes adicionam atrito |
| npm/pnpm workspaces sem Turbo | Perde cache e orquestração de tarefas                |
| Nx                            | Mais configuração do que a fundação precisa          |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#6-decisões-arquiteturais)
- [`turbo.json`](../turbo.json)
- [`package.json`](../package.json)
