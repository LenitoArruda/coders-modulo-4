# ADR 0003 — API NestJS separada do front-end

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

Regras de negócio, ingestão de conectores, orquestração de agentes e autenticação não devem
ficar acopladas ao front-end. O Next.js atende bem à interface, mas concentrar domínio e
integrações nele dificultaria testes, deploy e evolução independente.

## Decisão

Criar `apps/api` com **NestJS 12.3.3** na porta **3333**, separada de `apps/web`. A API valida
variáveis de ambiente no boot, aplica CORS restrito a `WEB_ORIGIN` e expõe o endpoint hello
world. `apps/web` conversa com a API por HTTP.

## Consequências

### Positivas

- Domínio isolado do framework de UI.
- Deploy e escala independentes do front-end.
- Testes de API com Supertest e contrato HTTP explícito.
- Base natural para ingestão, filas e telemetria.

### Negativas / trade-offs

- Mais um serviço para operar e monitorar.
- Exige contratos e tratamento de erros entre web e API.
- A portabilidade de NestJS para serverless ainda não foi validada.

## Alternativas consideradas

| Alternativa                           | Por que foi descartada                                    |
| ------------------------------------- | --------------------------------------------------------- |
| Route Handlers/Server Actions no Next | Mistura domínio com UI e limita reuso por outros clientes |
| Funções serverless isoladas           | Orquestração e testes ficam fragmentados                  |
| Monolito no app web                   | Acoplamento e deploy único para domínios distintos        |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#4-arquitetura-da-api-e-do-monorepo)
- [`.specs/000-foundation.md`](../.specs/000-foundation.md) §15
