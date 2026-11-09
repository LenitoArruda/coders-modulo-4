# ADR 0006 — Supabase local via CLI com PostgreSQL 15

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A fundação precisa de banco, autenticação e storage locais sem exigir instalação global e sem
depender de um projeto remoto. O ambiente deve ser reproduzível em Windows, macOS e Linux, com
migrações versionadas e descartáveis.

## Decisão

Usar a **CLI do Supabase 3.0.0** como devDependency, executada com `bun x supabase`. O projeto
fica configurado em `supabase/config.toml`, com migrações em `supabase/migrations/`. O
PostgreSQL local usa a versão **15** como workaround de ambiente. O **Supabase Analytics** fica
desabilitado porque o coletor `vector` exige a Docker API em `host.docker.internal:2375`, porta
não exposta por padrão no Docker Desktop; a observabilidade da aplicação usa o LGTM (ADR 0007).

## Consequências

### Positivas

- Ambiente local reproduzível sem instalação global.
- Migrações versionadas e aplicáveis do zero.
- Banco descartável, sem dados reais.
- A CLI é atualizada junto com o projeto.

### Negativas / trade-offs

- Docker é pré-requisito obrigatório.
- PostgreSQL 15 local pode divergir da versão de produção; a decisão de produção está em
  aberto.
- Analytics do Supabase indisponível no ambiente local.

## Alternativas consideradas

| Alternativa                     | Por que foi descartada                            |
| ------------------------------- | ------------------------------------------------- |
| PostgreSQL puro em Compose      | Perde Auth, Storage e o fluxo oficial do Supabase |
| Supabase remoto desde o início  | Exige credenciais e não é descartável             |
| CLI global instalada na máquina | Menos reproduzível e exige setup manual           |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#7-decisões-em-aberto)
- [`supabase/config.toml`](../supabase/config.toml)
- [`scripts/infra.mjs`](../scripts/infra.mjs)
