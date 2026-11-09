# Plano — Fundação

> Spec: `.specs/000-foundation.md`
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto

O repositório ainda é o starter do Turborepo: `apps/web` e `apps/docs` em Next.js,
`packages/ui`, `eslint-config` e `typescript-config`. Não existem API, banco local, testes,
observabilidade nem scripts de correção; `bun run lint` falha por resolução do preset Babel.
Todas as features seguintes dependem desta base.

## 2. Objetivo e critérios de aceite

Entregar a fundação descrita em `.specs/000-foundation.md` §14. Mapa de rastreabilidade:

| Critério da spec                                                 | Passo(s) do plano |
| ---------------------------------------------------------------- | ----------------- |
| `bun run dev` sobe web (3000), docs (3001) e API (3333)          | 6, 10             |
| `GET /` da API responde `200` com `{ "message": "Hello World" }` | 6                 |
| `/` do web tem um `<h1>` de hello world                          | 4, 5              |
| `bun run lint` passa                                             | 2, 9              |
| `bun run code:fix` sai com código 0                              | 2, 9              |
| `bun run types:check` passa                                      | 2, 9              |
| `bun run build` compila                                          | 9                 |
| `bun run test` executa e passa                                   | 7, 9              |
| `bun run test:e2e` executa e passa                               | 8, 9              |
| `infra:up` sobe LGTM + Supabase e Grafana em 3010                | 5, 10             |
| `bunx supabase start` sem instalação global                      | 5, 10             |
| `db:migrate` aplica migrações e sai com 0                        | 5, 10             |
| `infra:down` para e é idempotente                                | 5, 10             |
| Log, métrica e trace da API no Grafana em ≤ 30 s                 | 6, 5, 10          |
| `.env` ausente/inválido falha o boot sem vazar segredos          | 6, 7              |
| CORS aceita `http://localhost:3000` e bloqueia outra origem      | 6, 7              |
| Sem `any`, `@ts-ignore` ou `eslint-disable` sem justificativa    | 9                 |
| Comandos da doc existem ou estão marcados como planejados        | 11                |
| `.docs` reflete o estado real                                    | 11                |
| `/` responsiva em 360/768/1280 px, teclado e contraste AA        | 4, 8, 10          |
| Sem `.env`, segredos ou artefatos no diff                        | 12                |

## 3. Escopo

### Dentro

- `apps/api` NestJS com hello world, camadas + vertical slice, env validado, CORS, logs
  estruturados e OpenTelemetry.
- `apps/web` hello world em Next.js com Tailwind CSS e shadcn/ui, light-only.
- `packages/ui` com tokens, `cn`, primitivo `Button` e exports atualizados.
- Scripts `code:fix`, `types:check`, `test`, `test:watch`, `test:e2e`, `infra:up`, `infra:down`,
  `db:migrate`.
- Vitest + Supertest na API; Playwright no web; Lefthook + lint-staged.
- Supabase CLI como devDependency, `supabase/config.toml` e migração inicial.
- `docker-compose.yml` com LGTM + OTel Collector e provisionamento do Grafana.
- `.env.example`, validação de env e atualização de `.docs` + README.

### Fora

- Features de produto, autenticação de usuário final, multi-tenancy/RLS, deploy e CI.
- OXLint/OXFmt, `packages/shared`, date-fns, TanStack e bcrypt.
- Redesign de produto, telas além do hello world e reescrita de `apps/docs`.

## 4. Abordagem técnica

- **Monorepo:** manter Bun + Turborepo. Cada pacote expõe `lint`, `types:check`, `build` e,
  quando aplicável, `test`. A raiz orquestra via Turbo.
- **Lint:** manter ESLint + Prettier. Corrigir a resolução do preset Babel com caminho absoluto
  via `createRequire(import.meta.url)` e habilitar decorators legacy para a API. Não migrar para
  typescript-eslint nesta entrega (a versão atual não declara suporte a TypeScript 7).
- **API:** NestJS 12, TypeScript compilado com `tsc` (CommonJS), sem `@nestjs/cli`. Estrutura
  `modules/hello/{domain,application,interface}` e `modules/shared/{config,logging,observability}`.
  DI explícita com `@Inject` para não depender de `emitDecoratorMetadata` no Vitest.
- **Env:** validador próprio, sem biblioteca extra. Falha no boot com lista de chaves
  ausentes/inválidas, sem imprimir valores.
- **Observabilidade:** `@opentelemetry/sdk-node` com exporters OTLP gRPC para traces, métricas e
  logs; `HttpInstrumentation` para spans; histograma de latência e log JSON por requisição com
  `requestId`. O Collector recebe OTLP e exporta para Tempo, Prometheus e Loki (LGTM).
- **Front-end:** Next.js App Router, Tailwind CSS 4 e shadcn/ui. Tokens em
  `packages/ui/src/styles/globals.css`, `components.json` no pacote `ui`, primitivo `Button`.
  Remover CSS Modules e dark mode do web.
- **Banco:** Supabase CLI 3 como devDependency. `supabase start` gerencia os containers;
  `db:migrate` usa `bun x supabase migration up --local`.
- **Infra:** Docker Compose com a imagem all-in-one `grafana/otel-lgtm` (Grafana, OTel Collector,
  Loki, Tempo e Prometheus), sem arquivos de configuração separados. `scripts/infra.mjs` (Node,
  sem sintaxe POSIX) orquestra Compose e Supabase e trata idempotência/erros.
- **Testes:** Vitest na API (unitário + integração com Supertest), Playwright no web (smoke).
- **Hooks:** Lefthook chama `lint-staged` no pré-commit.

## 5. Arquivos e áreas afetadas

```text
.
├── .env.example
├── docker-compose.yml
├── lefthook.yml
├── package.json
├── turbo.json
├── README.md
├── scripts/
│   └── infra.mjs
├── supabase/
│   ├── config.toml
│   └── migrations/20261105000000_initial.sql
├── apps/api/
│   ├── package.json
│   ├── eslint.config.mjs
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── vitest.config.mts
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── app-setup.ts
│       ├── modules/hello/{domain,application,interface}
│       ├── modules/shared/{config,logging,observability}
│       └── test/
├── apps/web/
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── playwright.config.ts
│   ├── e2e/home.spec.ts
│   └── app/{layout.tsx,page.tsx}
├── packages/ui/
│   ├── package.json
│   ├── components.json
│   └── src/
│       ├── components/ui/button.tsx
│       ├── lib/cn.ts
│       └── styles/globals.css
└── .docs/{AGENTS,RULES,ARCHITECTURE,DEVELOPMENT,QA,DESIGN,DESIGN_SYSTEM}.md
```

## 6. Passos de implementação

- [x] 1. Registrar a aprovação da spec e criar este plano.
- [x] 2. Ajustar scripts raiz/Turbo (`code:fix`, `types:check`, `test`, `test:watch`,
      `test:e2e`, `infra:up`, `infra:down`, `db:migrate`), renomear `check-types` e corrigir o
      lint compartilhado.
- [x] 3. Instalar Tailwind CSS, shadcn/ui, `cn`, `cva` e Radix Slot no `packages/ui`;
      criar tokens light-only e o primitivo `Button`. Lucide fica configurado no
      `components.json` e é instalado quando o primeiro ícone real for necessário.
- [x] 4. Reescrever a home do `apps/web` com Tailwind/shadcn, remover dark mode, CSS Modules e
      assets não usados; atualizar layout/metadata.
- [x] 5. Criar Supabase local (`config.toml` + migração), Compose com o LGTM all-in-one
      (Grafana, Collector, Loki, Tempo e Prometheus) e `scripts/infra.mjs`.
- [x] 6. Criar `apps/api` NestJS com hello world, validação de env, CORS, logs JSON e
      instrumentação OpenTelemetry.
- [x] 7. Configurar Vitest + Supertest e escrever testes de caso de uso, env e integração HTTP.
- [x] 8. Configurar Playwright e escrever o smoke da home.
- [x] 9. Configurar Lefthook + lint-staged e rodar a verificação estática completa
      (`code:fix`, `lint`, `types:check`, `test`, `build`).
- [x] 10. Executar QA de infraestrutura: `infra:up`, `db:migrate`, telemetria no Grafana,
      `infra:down` e idempotência; executar `test:e2e`.
- [x] 11. Atualizar README e `.docs` com comandos, portas, stack e status reais.
- [x] 12. Fechar spec/plano e entregar o relatório final.

## 7. Riscos e mitigação

| Risco                                              | Mitigação                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| OpenTelemetry sob Bun não instrumentar `node:http` | Testar cedo; se necessário, rodar a API com `tsx`/Node no dev e manter Bun no restante |
| `typescript-eslint` incompatível com TypeScript 7  | Manter ESLint + Babel parser, corrigindo a resolução do preset                         |
| Imagens LGTM/Supabase pesadas                      | Fixar versões, documentar primeira execução e validar com `--wait`                     |
| Configuração do LGTM divergir da versão da imagem  | Fixar tags, validar com `docker compose config` e logs dos containers                  |
| Playwright sem navegador instalado                 | Documentar `bun x playwright install chromium` e executar no QA                        |
| Portas ocupadas no ambiente                        | Mensagens acionáveis no `infra.mjs` e na doc                                           |
| CORS divergente entre teste e runtime              | Centralizar `configureApp()` usado por `main.ts` e testes                              |

## 8. Plano de testes

- **Unitário (Vitest):** `GetHelloUseCase` retorna a mensagem; `loadEnv` aceita config válida e
  rejeita ausente/inválida sem expor valores.
- **Integração (Vitest + Supertest):** `GET /` → `200`, `application/json`,
  `{ "message": "Hello World" }`; CORS aceita a origem configurada e não devolve
  `access-control-allow-origin` para outra.
- **E2E (Playwright):** `/` responde, tem um único `<h1>` com "Olá, mundo" e não gera rolagem
  horizontal em 360 px, 768 px e 1280 px.
- **Manual:** setup, `infra:up`, `db:migrate`, `dev`, `infra:down`, Grafana e telemetria.
- **Sem meta numérica de cobertura** nesta entrega.

## 9. QA manual

1. Ação: copiar `.env.example` para `.env` e preencher as chaves locais.
   Esperado: API inicia; `.env` ausente/inválido falha com mensagem clara.
2. Ação: `bun run infra:up`.
   Esperado: Compose e Supabase sobem; Grafana responde em `http://localhost:3010`.
3. Ação: `bun run db:migrate` duas vezes.
   Esperado: aplica na primeira e sai com 0 na segunda, sem alterar dados.
4. Ação: `bun run dev` e acessar `http://localhost:3333/` e `http://localhost:3000/`.
   Esperado: JSON `{ "message": "Hello World" }` e `<h1>` "Olá, mundo".
5. Ação: abrir Grafana e consultar logs, métricas e traces da API após uma requisição.
   Esperado: dados visíveis em até 30 s.
6. Ação: navegar por teclado em 360/768/1280 px.
   Esperado: foco visível, sem rolagem horizontal, contraste AA.
7. Ação: `bun run infra:down` duas vezes.
   Esperado: ambas saem com 0.

## 10. Rollout e rollback

- Entrega local, sem feature flag e sem dados reais.
- Rollback: reverter o commit/PR e executar `bun run infra:down`.
- Nenhuma migração destrutiva; o banco local é descartável.
- README e `.docs` são atualizados na mesma entrega.

---

## 11. Resultado da execução

**Status:** concluído em 2026-11-09.

Evidências de QA:

- `bun run code:fix` sai com `0`.
- `bun run lint`, `bun run types:check`, `bun run test`, `bun run build` e `bun run test:e2e`
  passam. A suíte da API tem 3 arquivos/8 testes e o smoke E2E tem 5 testes.
- `bun run dev`: web em `3000` (`<h1>Olá, mundo`), docs em `3001` e API em `3333`
  (`{"message":"Hello World"}`).
- `bun run infra:up` e `bun run infra:down` são idempotentes; `bun run db:migrate` aplica na
  primeira execução e retorna `applied: []` na segunda.
- Grafana em `http://localhost:3010` exibe métricas Prometheus, logs no Loki e traces no Tempo
  com `service_name="coders-modulo-4-api"`.
- CORS aceita `http://localhost:3000` e não devolve `access-control-allow-origin` para outra
  origem.

Desvios em relação ao plano inicial:

1. **LGTM all-in-one:** a imagem `grafana/otel-lgtm:0.39.0` já inclui Collector, Loki, Tempo e
   Prometheus; não foram necessários os arquivos em `infra/`. O `docker-compose.yml` mantém
   apenas o serviço `lgtm`.
2. **Supabase Analytics desabilitado:** o coletor `vector` exige Docker API em
   `host.docker.internal:2375`, porta não exposta por padrão no Docker Desktop. A telemetria da
   aplicação é feita pelo LGTM.
3. **PostgreSQL 15:** adotado como workaround de ambiente em `supabase/config.toml`.
4. **Logs OTel:** emitidos via `logs` de `@opentelemetry/api` 1.10 para compartilhar o provider
   global do `NodeSDK`. O pacote `@opentelemetry/api-logs` foi removido.
5. **Config do Vitest:** `vitest.config.mts` (em vez de `.ts`) para compatibilidade com o
   carregamento ESM.
6. **Componentes legados:** `button`, `card` e `code` permanecem em `packages/ui` por uso em
   `apps/docs`; o novo primitivo é `components/ui/button.tsx`.
7. **Sem commit:** a entrega ficou no working tree, conforme instrução do usuário.
