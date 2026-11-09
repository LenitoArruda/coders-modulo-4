# ADR 0008 — Testes com Vitest, Supertest e Playwright

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A fundação precisa de uma rede de segurança para regressões antes das features de produto. Os
testes devem cobrir regras isoladas, o contrato HTTP da API e o fluxo principal no navegador,
com comandos únicos na raiz do monorepo.

## Decisão

Adotar três níveis:

- **Vitest 5.1.0** para testes unitários e de integração.
- **Supertest 7.3.1** para exercitar a API por HTTP.
- **Playwright 1.65.0 (Chromium)** para o smoke E2E do web.

Os comandos são `bun run test`, `bun run test:watch` e `bun run test:e2e`. Não há meta numérica
de cobertura nesta entrega; os testes cobrem o caminho feliz e as falhas de configuração
previstas.

## Consequências

### Positivas

- Feedback rápido para domínio e casos de uso.
- Contrato HTTP validado de ponta a ponta na API.
- Smoke E2E garante que a página principal continua acessível.
- Comandos consistentes via Turbo.

### Negativas / trade-offs

- Playwright exige download do Chromium na primeira execução.
- Testes E2E são mais lentos e sensíveis ao ambiente.
- Sem meta de cobertura, lacunas precisam ser avaliadas caso a caso.

## Alternativas consideradas

| Alternativa             | Por que foi descartada                          |
| ----------------------- | ----------------------------------------------- |
| Jest                    | Configuração extra e integração pior com ESM/TS |
| Cypress                 | Mais pesado para um smoke E2E                   |
| Apenas testes unitários | Não valida o contrato HTTP nem o navegador      |

## Referências

- [QA.md](../.docs/QA.md)
- [`apps/api/vitest.config.mts`](../apps/api/vitest.config.mts)
- [`apps/web/playwright.config.ts`](../apps/web/playwright.config.ts)
