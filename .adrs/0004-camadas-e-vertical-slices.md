# ADR 0004 — Arquitetura em camadas com vertical slices

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A plataforma crescerá por domínios (`experts`, `connectors`, `documents`, `conversations`). Uma
organização apenas por tipo técnico (controllers, services, repositories) espalha a lógica de
cada domínio e aumenta o acoplamento. A fundação precisa de um formato que permita evoluir cada
domínio sem reestruturar a API.

## Decisão

Organizar `apps/api` em **vertical slices** por domínio, cada um com as camadas
`domain`, `application`, `infrastructure` e `interface`, com dependências apontando para
dentro:

```text
interface → application → domain
                 ↑
          infrastructure (implementa portas)
```

`modules/shared` contém apenas código transversal (config, logging, observabilidade, erros).
Não são permitidas dependências circulares entre módulos.

## Consequências

### Positivas

- Domínio isolado de framework, banco e HTTP.
- Casos de uso testáveis sem I/O.
- Evolução independente por domínio.
- Fronteiras explícitas para futuras integrações e filas.

### Negativas / trade-offs

- Mais arquivos e boilerplate do que um MVC simples.
- Exige disciplina para não vazar detalhes de infraestrutura para o domínio.
- A estrutura ainda é validada apenas pelo módulo `hello`.

## Alternativas consideradas

| Alternativa            | Por que foi descartada                               |
| ---------------------- | ---------------------------------------------------- |
| MVC por camada técnica | Espalha o domínio e dificulta mudanças localizadas   |
| Módulo único           | Não escala para múltiplos domínios                   |
| Hexagonal/DDD completo | Cerimônia excessiva para o tamanho atual da fundação |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#41-camadas)
- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [`apps/api/src/modules`](../apps/api/src/modules)
