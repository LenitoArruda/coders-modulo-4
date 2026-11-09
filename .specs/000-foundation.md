# Fundação — Spec

> **Status:** done
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Plano:** `.plans/000-foundation-plan.md`

## 1. Contexto e problema

O repositório é o starter do Turborepo: existem `apps/web` e `apps/docs` em Next.js,
`packages/ui`, `eslint-config` e `typescript-config`. Ainda não existem API, banco local,
testes, infraestrutura de observabilidade nem comandos de correção automática; além disso,
`bun run lint` está quebrado por um problema de resolução do preset Babel (ver `QA.md` §2).

Sem essa base, qualquer feature da plataforma de Experts esbarra em ausência de API para
regras de negócio, ausência de banco e migrações, ausência de rede de segurança para
regressões e ambiente local não reproduzível. O custo de não resolver é retrabalho em todas
as features seguintes e um Definition of Done que não pode ser cumprido.

Por que agora: esta é a primeira entrega do módulo; todas as demais dependem dela.

## 2. Usuários e jobs

| Usuário                      | Job                                                                     | Frequência     |
| ---------------------------- | ----------------------------------------------------------------------- | -------------- |
| Desenvolvedor(a) de backend  | Subir a API, o banco e a observabilidade localmente e aplicar migrações | Diária         |
| Desenvolvedor(a) de frontend | Subir o app e consumir a API local                                      | Diária         |
| Desenvolvedor(a) / CI        | Rodar lint, tipos, testes e build de forma reproduzível                 | A cada mudança |

Permissões: ambiente estritamente local, sem usuários finais e sem dados reais. Nenhum acesso
a produção é criado ou exigido nesta entrega.

## 3. Resultado esperado

Uma pessoa consegue clonar o repositório, instalar as dependências e, seguindo a documentação,
subir web + API + infraestrutura local; acessar `GET /` da API e `/` do app; e rodar lint,
tipos, testes e build com sucesso. A documentação passa a refletir o estado real do projeto,
sem comandos inexistentes ou stack planejada descrita como se já existisse.

## 4. Métricas de sucesso

| Métrica                                                     | Linha de base hoje   | Meta                                    |
| ----------------------------------------------------------- | -------------------- | --------------------------------------- |
| Apps de API                                                 | 0                    | 1 (`apps/api`)                          |
| Suítes de teste executáveis                                 | 0                    | Unitário, integração de API e E2E smoke |
| `bun run lint`                                              | Falha (preset Babel) | Passa em todos os pacotes               |
| Serviços de infra local                                     | 0                    | LGTM + Supabase local                   |
| Setup em máquina limpa seguindo a doc                       | Não existe           | ≤ 15 min                                |
| Pipeline local (`code:fix`, `types:check`, `test`, `build`) | Não existe           | ≤ 5 min                                 |
| Comandos citados na doc que não existem                     | Vários               | 0                                       |

## 5. Escopo

### Dentro

- Criar `apps/api` em NestJS, seguindo a arquitetura em camadas e vertical slices de
  `ARCHITECTURE.md` e `DEVELOPMENT.md`, com endpoint hello world.
- Manter `apps/web` em Next.js (não criar app React + Vite) e entregar a página `/` com hello
  world.
- Instalar e configurar Tailwind CSS e shadcn/ui na base compartilhada, com tema **light-only**,
  tokens de `DESIGN_SYSTEM.md` e remoção do dark mode do starter.
- Migrar/limpar os componentes de exemplo e dependências do starter que deixarem de ser usados.
- Padronizar lint e formatação em ESLint + Prettier; corrigir o bloqueio atual do lint.
- Adicionar os comandos `code:fix`, `types:check`, `test`, `test:watch`, `test:e2e`,
  `infra:up`, `infra:down` e `db:migrate`.
- Instalar Vitest (unitário/integração), Supertest (API) e Playwright (E2E smoke).
- Instalar Lefthook + lint-staged para hooks de pré-commit.
- Disponibilizar Supabase local via CLI como devDependency (sem exigir instalação global) e
  criar ao menos uma migração inicial aplicável.
- Criar `docker-compose.yml` com a stack LGTM (Loki, Grafana, Tempo, Mimir) e um OTel
  Collector como ponto de entrada de telemetria.
- Instrumentar a API com OpenTelemetry para logs estruturados, métricas e traces.
- Criar `.env.example` e validar variáveis de ambiente no boot da API.
- Atualizar `.docs` e o README para refletir comandos, portas, stack, infraestrutura e status
  reais (`✅ implementado` / `🧭 planejado`), removendo afirmações que conflitem com o novo
  estado.

### Fora

- Features de produto: Experts, conectores, ingestão, autenticação de usuário final,
  multi-tenancy e RLS.
- Deploy (Vercel, Railway, Fly, Render etc.) e pipeline de CI.
- Migração para OXLint/OXFmt.
- Criar `packages/shared` antes de existir um contrato real compartilhado entre web e API; ele
  permanece 🧭 planejado.
- Bibliotecas sem uso imediato nesta entrega: date-fns, TanStack Table, TanStack Charts e
  bcrypt.
- Dark mode, redesign de produto ou novas telas além do hello world.
- Remoção ou reescrita de `apps/docs`; ele permanece como está nesta entrega.
- Dados reais, PII ou integrações externas.

## 6. Fluxos

### Fluxo principal — ambiente local do zero

1. A pessoa instala os pré-requisitos (Bun, Node.js e Docker), clona o repositório e executa
   `bun install`.
2. Copia `.env.example` para `.env` e preenche apenas os valores locais necessários.
3. Executa `bun run infra:up`: sobem o LGTM e o Supabase local; o Grafana fica acessível.
4. Executa `bun run db:migrate`: as migrações pendentes são aplicadas no banco local.
5. Executa `bun run dev`: sobem web (3000), docs (3001) e API (3333).
6. Abre `http://localhost:3333/` e recebe o JSON de hello world; abre
   `http://localhost:3000/` e vê o título de hello world.
7. Executa `bun run code:fix`, `bun run types:check`, `bun run test` e `bun run build`, todos
   com sucesso.
8. Abre o Grafana e confirma que logs, métricas e traces da API chegaram.

### Fluxos alternativos e de exceção

- Docker não está instalado ou não está rodando: `infra:up` falha com mensagem acionável e
  código de saída diferente de zero.
- Porta necessária já está em uso: o comando falha indicando a porta e como liberá-la.
- `.env` ausente ou inválido: a API falha no boot com mensagem clara, sem expor segredos.
- Supabase local já está rodando: `infra:up` é idempotente e não recria o ambiente.
- Não há migrações pendentes: `db:migrate` sai com código 0 sem alterar dados.
- `infra:down` com serviços já parados: é idempotente e sai com código 0.
- Lint, tipos, testes ou build falham: o comando sai diferente de zero e o pipeline para.
- Web fora da origem permitida tenta chamar a API: a requisição é bloqueada pelo CORS.

## 7. Regras e casos de borda

- Todos os scripts funcionam em Windows, macOS e Linux; nenhum depende de sintaxe exclusiva de
  shell POSIX.
- `infra:up`, `infra:down` e `db:migrate` são idempotentes.
- Nenhum comando exige ferramenta global além de Bun, Node.js e Docker; a CLI do Supabase é
  devDependency e executada via `bunx`.
- Portas fixas e documentadas: web `3000`, docs `3001`, API `3333`, Grafana `3010`, OTLP
  gRPC `4317` e OTLP HTTP `4318`. As portas padrão do Supabase CLI são mantidas.
- A página `/` do web usa um único `<h1>` com o texto de hello world e segue o tema light-only.
- É proibido `any`, `@ts-ignore` ou `eslint-disable` sem justificativa explícita.
- Nenhum segredo, token ou `.env` é versionado.
- A documentação só cita comando que existe no `package.json` ou que está marcado como
  planejado.

## 8. Dados e contratos

- `GET http://localhost:3333/` responde `200` com `Content-Type: application/json` e corpo
  `{ "message": "Hello World" }`.
- `GET http://localhost:3000/` responde HTML com um `<h1>` contendo o texto de hello world.
- Variáveis de ambiente previstas em `.env.example` (sem valores reais): porta da API, origem
  permitida do web, URL e chaves do Supabase local e endpoint OTLP do collector.
- A chave de service role do Supabase é exclusiva do servidor e nunca é exposta ao client.
- O banco local é descartável, sem dados reais e com migrações versionadas em `supabase/`.
- Telemetria: logs estruturados em JSON com nível e `requestId`; métricas e traces exportados
  para o OTel Collector e consultáveis no Grafana.
- Não há retenção de dados de usuário nesta entrega.

## 9. Permissões e segurança

- Ambiente local; não há autenticação de usuário final nesta entrega.
- A única rota da API é pública e sem dados sensíveis; o CORS aceita apenas a origem definida
  para o web local.
- Segredos vivem apenas em `.env`; `.env.example` documenta as chaves sem valores reais.
- As variáveis de ambiente são validadas no boot e a API não inicia com configuração inválida.
- Logs não registram tokens, chaves, PII ou payloads sensíveis.
- Nenhuma credencial de produção é necessária ou criada.

## 10. Requisitos não funcionais

- Setup completo em máquina limpa seguindo a doc: ≤ 15 min, desconsiderando o download inicial
  de imagens Docker.
- Pipeline local (`code:fix`, `types:check`, `test`, `build`): ≤ 5 min.
- `GET /` da API responde em ≤ 200 ms no ambiente local.
- Infraestrutura sobe em ≤ 3 min depois de as imagens estarem em cache.
- Scripts idempotentes e multiplataforma.
- Página hello world acessível por teclado, com foco visível, contraste AA e layout funcional em
  360 px, 768 px e 1280 px, sem rolagem horizontal.
- Logs, métricas e traces visíveis no Grafana em até 30 s após uma requisição à API.
- Custo adicional: zero, além do ambiente local.

## 11. Dependências e riscos

| Dependência ou risco                | Impacto                                      | Mitigação                                           | Dono       |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------- | ---------- |
| Docker instalado e em execução      | Sem ele, Supabase e LGTM não sobem           | Verificar no `infra:up` e falhar com mensagem clara | Engenharia |
| CLI do Supabase                     | Necessária para `supabase start` e migrações | Declarar como devDependency e executar via `bunx`   | Engenharia |
| Portas ocupadas                     | Comandos falham no boot                      | Documentar portas e mensagens de erro acionáveis    | Engenharia |
| Imagens LGTM pesadas                | Setup lento na primeira execução             | Fixar versões e documentar requisitos de máquina    | Engenharia |
| Bug atual do lint (preset Babel)    | Bloqueia o DoD                               | Corrigir a resolução do preset nesta entrega        | Engenharia |
| Compatibilidade com Windows         | Scripts quebram em sintaxe POSIX             | Usar scripts cross-platform e validar no Windows    | Engenharia |
| Migração de stack do front-end      | Retrabalho de docs e código                  | Decisão mantida: continuar em Next.js               | Engenharia |
| `apps/docs` sem definição de futuro | Pode gerar trabalho descartável              | Manter como está e decidir fora desta entrega       | Produto    |

## 12. Rollout e migração

- Entrega local, sem feature flag e sem dados de produção.
- `apps/web` e `apps/docs` continuam funcionando durante e após a mudança.
- Não há migração destrutiva; as migrações do Supabase são versionadas e aplicáveis do zero.
- Rollback: reverter o commit/PR e derrubar a infra local com `infra:down`; nenhum dado real é
  perdido.
- Comunicação: atualizar README e `.docs` na mesma entrega, incluindo comandos, portas e
  status da stack.

## 13. Estratégia de teste

- **Unitário (Vitest):** caso de uso/serviço do hello world e validação de configuração de
  ambiente, sem I/O.
- **Integração (Supertest + Vitest):** `GET /` retorna `200`, `Content-Type` correto e o corpo
  esperado; CORS aceita a origem permitida e rejeita outra.
- **E2E (Playwright):** abre `/` no web e valida o `<h1>` de hello world; smoke do fluxo
  principal.
- **Manual:** setup completo em máquina limpa, `infra:up`, `db:migrate`, `infra:down`, acesso ao
  Grafana e conferência de logs/métricas/traces.
- **Dados de teste:** nenhum dado sensível; ambiente local descartável.
- Não há meta numérica de cobertura nesta entrega; os testes devem cobrir o caminho feliz e as
  falhas de configuração previstas.

## 14. Critérios de aceite

- [x] Dado o ambiente local preparado (dependências instaladas e `.env` válido), quando executo
      `bun run dev`, então web (3000), docs (3001) e API (3333) sobem sem erro.
- [x] Dada a API rodando, quando faço `GET /`, então recebo `200` com
      `{ "message": "Hello World" }`.
- [x] Dado o app rodando, quando abro `/`, então vejo um `<h1>` com o texto de hello world.
- [x] Dado o repositório, quando executo `bun run lint`, então a checagem passa em todos os
      apps e pacotes.
- [x] Dado o repositório, quando executo `bun run code:fix`, então lint e formatação são
      corrigidos e o comando sai com código 0.
- [x] Dado o repositório, quando executo `bun run types:check`, então a checagem de tipos passa
      em todos os apps e pacotes.
- [x] Dado o repositório, quando executo `bun run build`, então todos os apps e pacotes
      compilam.
- [x] Dado o repositório, quando executo `bun run test`, então os testes unitários e de
      integração da API executam e passam.
- [x] Dado o repositório, quando executo `bun run test:e2e`, então o smoke E2E do web executa e
      passa.
- [x] Dado Docker em execução, quando executo `bun run infra:up`, então o LGTM e o Supabase
      local sobem e o Grafana responde em `http://localhost:3010`.
- [x] Dado o Supabase local parado, quando executo `bunx supabase start`, então o ambiente local
      sobe sem exigir instalação global da CLI.
- [x] Dada a infraestrutura no ar, quando executo `bun run db:migrate`, então as migrações
      pendentes são aplicadas no banco local e o comando sai com código 0.
- [x] Dada a infraestrutura no ar, quando executo `bun run infra:down`, então os serviços param
      e o comando sai com código 0.
- [x] Dada a infraestrutura já parada, quando executo `bun run infra:down` novamente, então o
      comando continua saindo com código 0.
- [x] Dada a API rodando, quando faço uma requisição a `GET /`, então um log estruturado é
      emitido e a métrica/trace correspondente aparece no Grafana em até 30 s.
- [x] Dado um `.env` ausente ou inválido, quando inicio a API, então o boot falha com mensagem
      clara e sem expor segredos.
- [x] Dado o web em `http://localhost:3000`, quando ele chama a API, então a requisição é
      aceita; a partir de outra origem, é bloqueada.
- [x] Dado o código-fonte, quando procuro `any`, `@ts-ignore` ou `eslint-disable` sem
      justificativa, então não encontro ocorrências.
- [x] Dado o repositório, quando procuro comandos citados na documentação, então todos existem
      no `package.json` ou estão marcados como planejados.
- [x] Dado o final da entrega, quando leio `.docs`, então os status `✅ implementado` e
      `🧭 planejado` refletem o estado real e não há contradição com o código.
- [x] Dada a página `/`, quando testo em 360 px, 768 px e 1280 px e apenas com teclado, então
      não há rolagem horizontal, o foco é visível e o contraste atende AA.
- [x] Dado o diff final, quando procuro `.env`, segredos ou artefatos gerados, então não há
      arquivos indevidos versionados.

## 15. Decisões e questões abertas

| Tema                | Decisão ou pergunta                                                                                                                    | Impacto                                                                           | Dono       | Status                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ----------------------- |
| Front-end           | Manter Next.js em `apps/web`; não criar `apps/app` com React + Vite                                                                    | Evita retrabalho e mantém `ARCHITECTURE`, `DEVELOPMENT` e `DESIGN_SYSTEM` válidos | Engenharia | fechada (2026-11-05)    |
| Comandos            | Adotar `code:fix` e `types:check`; renomear `check-types` e atualizar `QA.md`/`AGENTS.md`                                              | Padroniza scripts e documentação                                                  | Engenharia | fechada (2026-11-05)    |
| Lint/format         | Manter ESLint + Prettier; OXLint/OXFmt fica fora desta entrega                                                                         | Menor risco e corrige o bloqueio atual                                            | Engenharia | fechada (2026-11-05)    |
| Bibliotecas         | Instalar apenas o necessário para a fundação (NestJS, Supabase, Tailwind, shadcn, Vitest, Playwright, Supertest, Lefthook/lint-staged) | Aplica YAGNI e reduz superfície de manutenção                                     | Engenharia | fechada (2026-11-05)    |
| Infra local         | Docker Compose para o LGTM; Supabase gerenciado pela CLI; `infra:up/down` orquestram ambos                                             | Evita containers duplicados e segue o fluxo oficial                               | Engenharia | fechada (2026-11-05)    |
| Observabilidade     | LGTM + API instrumentada com OpenTelemetry (logs, métricas e traces)                                                                   | Atende ao requisito de observabilidade desde o dia 0                              | Engenharia | fechada (2026-11-05)    |
| `packages/shared`   | Não criar nesta entrega; aguardar um contrato real compartilhado entre web e API                                                       | Evita pacote vazio e retrabalho                                                   | Engenharia | fechada (2026-11-05)    |
| Porta da API        | `3333`                                                                                                                                 | Evita conflito com web (3000) e docs (3001)                                       | Engenharia | fechada (2026-11-05)    |
| `apps/docs`         | Manter como está nesta entrega; decidir depois se vira documentação pública ou é removido                                              | Afeta `dev`, `build` e a árvore do monorepo                                       | Produto    | aberta (não bloqueante) |
| Deploy da API       | Não definido; fora desta entrega                                                                                                       | Define infraestrutura futura                                                      | Engenharia | aberta (não bloqueante) |
| Multi-tenancy e RLS | Fora desta entrega; definir antes das features de produto                                                                              | Impacta modelo de dados e segurança                                               | Produto    | aberta (não bloqueante) |
| Cobertura de testes | Sem meta numérica nesta entrega; cobrir caminho feliz e falhas de configuração                                                         | Mantém a fundação enxuta                                                          | Engenharia | fechada (2026-11-05)    |

> **Nota para o plano:** versões, arquivos, configurações e passos de implementação pertencem a
> `.plans/000-foundation-plan.md`. Esta spec descreve o quê, o porquê e os resultados
> verificáveis.
