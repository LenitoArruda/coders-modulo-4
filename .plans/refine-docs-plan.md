# Plano — Refino da documentação (`.docs`)

## Contexto

O repositório é um monorepo Turborepo recém-criado (commit inicial do starter). A pasta
`.docs` concentra o contexto de produto, arquitetura, design e processo, mas os documentos
atuais estão incompletos, com erros de escrita e, em alguns pontos, contradizem o código
(comandos inexistentes, stack planejada descrita como se já existisse).

## Objetivo

Tornar a documentação **assertiva, coerente e eficiente** para agentes de código e pessoas,
separando explicitamente o que existe hoje do que está planejado.

## Escopo

- Reescrever os 8 arquivos de `.docs`:
  - `AGENTS.md`, `RULES.md`, `ARCHITECTURE.md`, `BUSINESS.md`,
    `DESIGN.md`, `DESIGN_SYSTEM.md`, `DEVELOPMENT.md`, `QA.md`.
- Corrigir comandos, links, typos e contradições.
- Registrar este plano em `.plans/refine-docs-plan.md`.

## Fora de escopo

- Alterar código de `apps/` ou `packages/`.
- Instalar dependências (Tailwind, shadcn, Vitest, Playwright etc.).
- Implementar CI, testes ou novos apps.

## Abordagem

1. Inventariar o estado real (`package.json`, `turbo.json`, árvore de diretórios).
2. Definir uma hierarquia de fontes de verdade e um ponto de entrada (`AGENTS.md`).
3. Reescrever cada documento com: propósito, status, regras acionáveis e links cruzados.
4. Marcar claramente `✅ implementado` vs `🧭 planejado` na stack.
5. Validar que todo comando citado existe ou está marcado como planejado.

## Critérios de aceite

- Nenhum documento contradiz outro.
- Todo comando em `QA.md` existe no `package.json` ou está na seção "planejado".
- `ARCHITECTURE.md` reflete apps/packages e versões reais.
- Documentos de UI deixam claro que shadcn/Tailwind ainda não estão instalados.
- Regras de planejamento e relatório final permanecem obrigatórias.

## Riscos

- Documentar stack alvo como se fosse atual → mitigado com legendas de status.
- Prescrever ferramentas ainda não aprovadas → decisões em aberto ficam explícitas.
- Docs longos demais → uso de tabelas e seções curtas.
