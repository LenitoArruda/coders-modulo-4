# ADR 0010 — TypeScript `strict` no monorepo

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

Web, API e pacotes compartilhados trocam contratos e tipos. Configurações frouxas permitem
`any` implícito, nulos não tratados e erros que só aparecem em runtime, justamente nos fluxos
de ingestão e resposta que a fundação quer tornar confiáveis.

## Decisão

Usar **TypeScript 7.0.2** com `strict` habilitado na base compartilhada
(`packages/typescript-config/base.json`), estendida por `nextjs.json` e
`react-library.json`. É proibido usar `any`, `@ts-ignore` ou `eslint-disable` sem
justificativa explícita no código e no relatório.

## Consequências

### Positivas

- Erros de tipo detectados antes do runtime.
- Refatorações mais seguras entre apps e pacotes.
- Contratos explícitos para a futura `packages/shared`.

### Negativas / trade-offs

- Bibliotecas sem tipos exigem adaptadores ou declarações.
- Mais atrito em protótipos rápidos.
- `tsc` nativo (Go) ainda é recente e pode ter diferenças de comportamento.

## Alternativas consideradas

| Alternativa           | Por que foi descartada                         |
| --------------------- | ---------------------------------------------- |
| TypeScript sem strict | Deixa passar nulos e `any` implícito           |
| JavaScript            | Perde segurança de tipos no monorepo           |
| Strict apenas na API  | Deixa web e pacotes compartilhados vulneráveis |

## Referências

- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [`packages/typescript-config/base.json`](../packages/typescript-config/base.json)
