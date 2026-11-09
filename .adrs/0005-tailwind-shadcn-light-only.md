# ADR 0005 — Tailwind CSS + shadcn/ui, light-only, em `packages/ui`

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

Web e docs precisam de uma base visual consistente, acessível e reutilizável. O starter usava
CSS Modules isolados, o que duplicaria estilos e tokens entre aplicações. A direção visual do
produto é **light theme único**.

## Decisão

Adotar **Tailwind CSS 4.3.4 + shadcn/ui** em `packages/ui`, com tokens em
`src/styles/globals.css`, o helper `cn` em `src/lib/cn.ts` e o componente `Button`. O tema é
**light-only**; o dark mode do starter foi removido. Os componentes legados `button`, `card` e
`code` permanecem temporariamente para `apps/docs`.

## Consequências

### Positivas

- Fonte única de tokens e componentes.
- Consistência visual entre web e futuras telas.
- Componentes acessíveis e copiáveis, sem dependência de runtime de UI.
- Menos CSS específico por app.

### Negativas / trade-offs

- `packages/ui` passa a depender de Tailwind e de utilitários (`clsx`,
  `tailwind-merge`, `class-variance-authority`).
- Componentes legados coexistem até `apps/docs` ser resolvido.
- Sem dark mode por decisão de produto.

## Alternativas consideradas

| Alternativa              | Por que foi descartada                             |
| ------------------------ | -------------------------------------------------- |
| CSS Modules do starter   | Duplicação e baixa reutilização                    |
| MUI/Chakra               | Tema opinativo e peso maior para o design definido |
| Dark mode desde o início | Fora da direção visual e do escopo da fundação     |

## Referências

- [DESIGN.md](../.docs/DESIGN.md)
- [DESIGN_SYSTEM.md](../.docs/DESIGN_SYSTEM.md)
- [`packages/ui`](../packages/ui)
