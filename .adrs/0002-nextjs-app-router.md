# ADR 0002 — Next.js App Router no front-end

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A interface principal precisa de renderização no servidor, bom desempenho, SEO e integração com
React. O starter do Turborepo já fornecia `apps/web` e `apps/docs` em Next.js, e a fundação não
deve introduzir retrabalho de stack.

## Decisão

Manter **Next.js 16.3.8 com App Router e React 19.2.8** em `apps/web`. `apps/docs` permanece
como aplicação Next.js separada na porta 3001, ainda não customizada.

## Consequências

### Positivas

- Server Components, streaming e rotas por convenção.
- SEO e renderização no servidor sem infraestrutura adicional.
- Alinhamento com o starter e com a documentação existente.
- `apps/web` pode consumir `packages/ui` diretamente.

### Negativas / trade-offs

- Exige disciplina na fronteira server/client (`"use client"`).
- O modelo de rotas e cache do Next muda com frequência.
- `apps/docs` segue como starter até uma decisão de produto.

## Alternativas consideradas

| Alternativa        | Por que foi descartada                             |
| ------------------ | -------------------------------------------------- |
| React + Vite (SPA) | Perde SSR/SEO e exigiria refazer a documentação    |
| Remix              | Migração sem ganho claro para a fundação           |
| Pages Router       | App Router é o padrão atual e já estava no starter |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#3-stack)
- [`.specs/000-foundation.md`](../.specs/000-foundation.md) §15
