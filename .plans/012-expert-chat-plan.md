# Plano — Catálogo de Experts e chat (spec 012)

> **Spec:** `.specs/012-expert-chat.md` · **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 1)
> **Status:** done · **Criado em:** 2026-11-17 · **Atualizado em:** 2026-11-17
> **Idioma:** documentação em PT-BR; código, rotas, endpoints e textos de produto em en-US.

## 1. Contexto e problema

A fundação (specs 001–011) entrega auth, sessão, home privada, design system light-only e
observabilidade, mas `/app` ainda é um placeholder. A spec 012 pede a primeira feature de produto:
nove Experts selecionáveis no footer, sugestões clicáveis, chat em persona e histórico isolado por
usuário, com `gpt-4o-mini` como única chamada externa.

O usuário aprovou o épico e autorizou a execução desta fatia ("pode mandar bala"). A spec está
marcada como `implementing`; as decisões abertas que eram bloqueantes são fechadas na seção 3.

## 2. Objetivo e critérios de aceite

Entregar a vertical slice completa com: catálogo de nove Experts, endpoint autenticado de catálogo,
conversa por Expert persistida no PostgreSQL, envio de prompt via LangChain.js/LangGraph com
`gpt-4o-mini`, UI em `/app` com footer (select + textarea + botão), sugestões clicáveis, estados de
loading/vazio/erro, perfil com logout preservado e telemetria sem conteúdo de prompt/resposta.

Os critérios de aceite a serem verificados são os oito itens da seção 14 da spec 012, mais:

- `bun run lint`, `bun run types:check`, `bun run test`, `bun run build` e `bun run test:e2e` verdes;
- `bun run db:migrate` e `bun run db:test` com PostgreSQL local ativo;
- regressão das suítes de auth, roteamento e landing.

## 3. Decisões de execução (fechamento das questões abertas da spec)

| Tema                          | Decisão adotada                                                                                                                                                                     | Origem                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Escopo dos seis novos Experts | Aceitar papel, tom e sugestões propostos na spec 012, em en-US.                                                                                                                     | Aprovação do épico             |
| Customer Hero                 | Manter a interpretação "voz do cliente, experiência, escalonamento e histórias de sucesso".                                                                                         | Aprovação do épico             |
| Histórico                     | Uma conversa por `(user_id, expert_id)`, com `unique`; trocar de Expert troca o transcript. É a proposta da spec.                                                                   | Aprovação do épico             |
| Limite de prompt              | `EXPERT_PROMPT_MAX_LENGTH`, padrão 4000 caracteres, validado na API e no textarea.                                                                                                  | Padrão configurável da spec    |
| Retenção                      | Sem expiração nesta fatia; política de retenção fica para a spec 018. Histórico é apagado apenas com o usuário (cascade).                                                           | Aprovação do épico             |
| Metas de latência/custo       | Sem meta numérica nesta fatia; telemetria registra duração e desfecho para decidir depois.                                                                                          | Spec 012, seção 4              |
| Fonte única do catálogo       | API é a dona do catálogo; web consome `GET /api/v1/experts` no servidor. Não duplicar em `packages/ui` nem em `apps/web`.                                                           | Regra DRY / DEVELOPMENT        |
| LangSmith                     | Nesta fatia ficam LangChain.js + LangGraph locais no processo da API e telemetria OTel → LGTM. Studio/CLI/evaluations Locais com Docker entram na spec 018, conforme mapa aprovado. | Mapa do épico, decisão fechada |
| Chave do modelo               | `OPENAI_API_KEY` opcional no boot; ausência gera erro acionável `503` apenas ao enviar prompt. Testes usam porta fake, sem chamada externa.                                         | Isolamento de testes / QA      |
| Transporte web → API          | Server Actions existentes em `/app` chamam `fetchApiWithSession`; nenhum token chega ao cliente.                                                                                    | Convenção do projeto           |

## 4. Escopo

### Dentro

- Migration `0002_expert_conversations.sql` + teste SQL `002_expert_conversations.test.sql`.
- Módulo API `experts`: domínio (catálogo, tipos, erros), aplicação (use cases + portas),
  infraestrutura (repositório Postgres, adapter LangGraph/ChatOpenAI), interface (request handlers).
- Módulo API `conversations`: mesmo padrão de camadas, reutilizando `SessionGuard`, `@CurrentUser()`
  e o contrato global de erros.
- Endpoints autenticados: `GET /api/v1/experts`, `GET /api/v1/conversations?expertId=...`,
  `POST /api/v1/conversations/messages`.
- UI: substituir o placeholder de `apps/web/app/app/page.tsx` pelo chat, com footer de composição,
  sugestões clicáveis e histórico por Expert; header/perfil/logout intactos.
- Atualização de `.docs/BUSINESS.md` e `.docs/ARCHITECTURE.md` na mesma entrega.
- Testes unitários, integração (Supertest), E2E (Playwright) e teste SQL.

### Fora

- Conexões (upload, URL, mídia), botão flutuante, RAG, citações, geração de imagem/vídeo,
  avaliação/evaluations LangSmith, Kubernetes, workspace/multi-tenancy, edição de Experts.
- Refatoração ampla de auth, landing, design system ou scripts existentes.

## 5. Abordagem técnica

### 5.1 API

- **Domínio** `experts`: `expert-catalog.ts` com os nove registros imutáveis na ordem exigida
  (CTO, CMO, Sales, Customer Success, Customer Hero, CEO, CFO, COO, CPO), cada um com
  `id`, `name`, `role`, `scope`, `tone` e pelo menos três `suggestions` em en-US. Nenhuma
  sugestão depende de fontes conectadas (já reescritas na spec).
- **Aplicação**: `list-experts.use-case.ts`, `get-conversation.use-case.ts` e
  `send-message.use-case.ts`. Portas abstratas `ConversationRepositoryPort` e
  `ExpertResponderPort`. Validação de prompt vazio/após trim e limite configurável antes de
  qualquer chamada ao modelo. Mensagem do usuário e resposta gravadas na mesma ordem, com
  IDs estáveis; falha do modelo não grava resposta parcial.
- **Infraestrutura**: `postgres-conversations.repository.ts` usa `pg` parametrizado e `withDbSpan`
  (SELECT/INSERT em `conversations` e `messages`); `langgraph-expert.responder.ts` usa
  `ChatOpenAI` + `StateGraph` do `@langchain/langgraph` com um nó `respond`. O `SystemMessage`
  carrega papel/escopo/tom do Expert e regra de "fora de escopo → explicar limitação"; o prompt
  do usuário entra como `HumanMessage`, tratado como dado. Parâmetros `temperature` e `maxTokens`
  conservadores. Nenhum prompt/resposta em log ou span.
- **Interface**: um `*RequestHandler` por endpoint, `@UseGuards(SessionGuard)` e `@CurrentUser()`.
  Erros de domínio traduzidos: `VALIDATION_ERROR` (400 + `fieldErrors`), `UNKNOWN_EXPERT` (404),
  `MODEL_UNAVAILABLE` (503, mensagem acionável em en-US), demais casos pelo filtro global.
- **Telemetria**: `log("info", "expert.chat", {...})` com `event`, `expertId`, `conversationId`,
  `messageId`, `durationMs`, `outcome`; eventos `expert.selected`, `suggestion.clicked`,
  `prompt.submitted`, `response.completed`, `response.failed`. `suggestion.clicked` é emitido
  pelo web via action e repassado à API somente como identificador do Expert (sem texto).
- **Config**: `Env` ganha `openaiApiKey` (opcional) e `promptMaxLength` (padrão 4000), ambos
  documentados em `.env.example`. `setup-env.ts` já define o mínimo para testes.

### 5.2 Web (Next.js 16)

- `app/app/page.tsx` continua Server Component: `requireSessionUser()` e leitura do catálogo +
  conversa inicial do primeiro Expert via `fetchApiWithSession`, passando dados serializáveis para
  um Client Component `expert-chat.tsx`.
- `app/app/_components/expert-chat.tsx` (`"use client"`) mantém estado de Expert selecionado,
  mensagens, prompt, pendência e erro. `select`, `textarea`, botão "Send" e sugestões são botões
  nativos com `aria-*`; respostas em `aria-live="polite"`; erro em `role="alert"`.
- `app/app/chat-actions.ts` (`"use server"`): `loadConversationAction(expertId)` e
  `sendPromptAction(expertId, prompt, source?)`, ambas com `fetchApiWithSession`; nada de token no
  cliente. O action de envio valida prompt vazio também no cliente para feedback imediato.
- Header com avatar, nome/e-mail e "Sign out" permanece em `app/app/layout.tsx`.

### 5.3 Design (plano de duas passagens, conforme `frontend-design`)

A direção já está fixada por `DESIGN.md`/`DESIGN_SYSTEM.md` — paleta pastel-azul, Geist, tokens
light-only — então a identidade vem do conteúdo e da hierarquia, não de novas cores.

- **Cor (tokens existentes):** `primary #1D4F7A` para a única ação primária e foco; `surface
#F3F8FB` para o fundo privado; `card #FFFFFF` para o transcript; `secondary #CFE8EF` para
  monograma do Expert; `border #D3E2EC`; texto `#171717`/`#52525B`. Nenhum hex novo.
- **Tipografia:** Geist Sans; títulos em `text-2xl`/`text-3xl`, corpo `text-sm`/`text-base`,
  no máximo três pesos; sem caixa alta decorativa, sem numeral de etapa repeating.
- **Layout (desktop):** coluna única contida em `max-w-6xl`; cabeçalho "Work with an Expert" com
  papel/escopo do Expert ativo; transcript em card com rolagem vertical; footer fixo ao fim do
  conteúdo com `Expert` (select), `Message` (textarea) e `Send`. No mobile, transcript e footer
  empilhados, footer alcançável sem rolagem horizontal.
- **Princípios:** uma ação primária por tela; sugestões parecem perguntas reais (não chips
  decorativos); vazio convida a primeira pergunta; erro diz o que aconteceu e como tentar de novo.

```text
┌───────────────────────────────────────────────┐
│ header: brand · Home · [AL] Ada · Sign out    │
├───────────────────────────────────────────────┤
│ Work with an Expert                           │
│ CTO Expert — Technology, architecture…        │
│ Suggested questions                           │
│  [ Review our architecture… ]  [ … ]          │
│ ┌─ transcript ───────────────────────────────┐ │
│ │ You: …                                    │ │
│ │ CTO Expert: …                             │ │
│ └────────────────────────────────────────────┘ │
│ ── footer ───────────────────────────────────  │
│ Expert [ CTO Expert ▾ ]                        │
│ Message [______________________] [ Send ]      │
└───────────────────────────────────────────────┘
```

Revisão contra osDefaults do frontend-design: não usar creme/serif/terracota, não usar
`01/02/03`, não usar gradientes, não colocar eyebrow em caixa alta, não usar "→" em CTA. O layout
é uma ferramenta de trabalho calma, não um dashboard de métricas.

### 5.4 Banco de dados

- `conversations(id uuid pk, user_id uuid → users on delete cascade, expert_id text,
created_at, updated_at, constraint expert_id_check …, unique (user_id, expert_id))`.
- `messages(id uuid pk, conversation_id uuid → conversations on delete cascade, role text
check ('user','expert'), content text not null, created_at timestamptz, constraint content
length 1..16000)`, índice `(conversation_id, created_at, id)`.
- RLS habilitado nas duas tabelas, sem policies; nenhum papel novo e nenhum grant.
- Bloco de rollback manual comentado, seguindo `0001_auth_schema.sql`.

### 5.5 E2E

`apps/web/e2e/support/fake-api-server.ts` ganha rotas de catálogo, conversa e envio, com estado em
memória por token de sessão. O cenário de falha usa um prompt que contém `fail` para devolver
`503 MODEL_UNAVAILABLE`, permitindo validar erro e retry sem chave externa.

## 6. Arquivos e áreas previstos

**Criar (API)**

- `apps/api/src/modules/experts/**` (module, domínio, aplicação, infraestrutura, interface, specs).
- `apps/api/src/modules/conversations/**` (module, domínio, aplicação, infraestrutura, interface, specs).
- `apps/api/src/test/fakes/in-memory-conversations.repository.ts`,
  `apps/api/src/test/fakes/fake-expert-responder.ts`.
- `db/migrations/0002_expert_conversations.sql`, `db/tests/002_expert_conversations.test.sql`.

**Alterar (API/config)**

- `apps/api/src/app.module.ts`, `apps/api/src/modules/shared/config/env.ts`,
  `apps/api/src/test/setup-env.ts`, `apps/api/package.json`, `.env.example`.

**Criar (web)**

- `apps/web/app/app/_components/expert-chat.tsx`, `apps/web/app/app/chat-actions.ts`,
  `apps/web/lib/expert-chat/types.ts` (contratos compartilhados cliente/servidor),
  `apps/web/e2e/expert-chat.spec.ts`.

**Alterar (web)**

- `apps/web/app/app/page.tsx`, `apps/web/e2e/support/fake-api-server.ts`.

**Documentação**

- `.specs/012-expert-chat.md` (status e aprovação), `.plans/012-expert-platform-breakdown.md`
  (status da fatia), `.docs/BUSINESS.md`, `.docs/ARCHITECTURE.md`, `.docs/QA.md` quando um
  comando/estado novo precisar ser documentado, `.docs/DESIGN_SYSTEM.md` se surgir primitivo novo.

## 7. Riscos e mitigação

| Risco                                             | Mitigação                                                                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APIs do LangGraph/LangChain mudarem entre versões | Instalar versões fixadas, ler os `.d.ts`/docs do pacote instalado antes de escrever o adapter e isolar tudo atrás de `ExpertResponderPort`.                                                                             |
| Chave OpenAI ausente derrubar boot ou testes      | `OPENAI_API_KEY` opcional; erro 503 somente no envio; fake responder nos testes.                                                                                                                                        |
| Prompt injection alterar persona                  | SystemMessage imutável por Expert; prompt do usuário apenas como HumanMessage; testes cobrem essa separação.                                                                                                            |
| Histórico vazar entre usuários                    | Filtro obrigatório por `user_id` em toda query;índice composto; testes de integração com dois usuários; RLS sem policies.                                                                                               |
| UI quebrar em 360 px                              | Composer em coluna única no mobile, `min-w-0`, `break-words`,textarea redimensionável verticalmente; E2E mede scroll horizontal.                                                                                        |
| Commit misturar trabalho pré-existente do usuário | Antes do `commit-and-push`, revisar `git status` e separar as alterações já presentes em `.docs/ARCHITECTURE.md`, `apps/web/app/auth/sign-in/page.tsx` e `packages/ui/src/styles/globals.css`; nunca usar `git add -f`. |

## 8. Plano de testes e QA manual

1. **Unitário (Vitest API):** catálogo com 9 entradas em ordem fixa, 3+ sugestões por Expert,
   `getExpertById`, validação de prompt vazio/limite, use case de envio com fake responder e
   repositório em memória, separação System/Human message, persistência e isolamento por usuário.
2. **Integração (Supertest):** 401 sem Bearer nos três endpoints; 200 de catálogo; 404 para
   Expert desconhecido; 400 para prompt vazio; 200 de conversa vazia; envio com fake responder
   gravando duas mensagens; segundo usuário não vê o histórico do primeiro; 503 sem expor detalhes.
3. **SQL (`bun run db:test`):** tabelas/colunas, `unique(user_id, expert_id)`, cascade,
   `role` check, limite de conteúdo, índice, RLS sem policies, papel sem grant não lê.
4. **Web (Vitest):** actions mapeiam erro 400/503 para mensagens amigáveis e não expõem token.
5. **E2E (Playwright):** selecionar cada um dos nove Experts e ver nome/papel/sugestões; clicar em
   sugestão e receber resposta; digitar prompt e enviar; prompt vazio bloqueado; recarregar e ver
   histórico; trocar de Expert e ver transcript diferente; forçar 503 e fazer retry; sign out e
   conferir que a home volta ao sign-in; 360/768/1280 px sem rolagem horizontal, foco visível e
   contraste.
6. **QA manual:** com `bun run dev` e API real com `OPENAI_API_KEY` válida (quando disponível),
   percorrer os mesmos fluxos no Chromium; conferir no Grafana/LGTM que os eventos de chat aparecem
   sem conteúdo de prompt; validar que `.env` não foi versionado.
7. **Gates:** `bun run code:fix` (quando aplicável) → `lint` → `types:check` → `test` → `build` →
   `db:migrate`/`db:test` → `test:e2e` → QA manual → relatório → `commit-and-push`.

## 9. Histórico

- 2026-11-17 — plano criado após aprovação do épico e da spec 012, com decisões dos itens abertos
  registradas e escopo limitado à fatia 1.
- 2026-11-17 — fatia entregue: API (catálogo + conversas com LangGraph), migração e teste SQL,
  UI de chat com Server Actions, fake API e E2E, docs atualizados. Testes verdes; status `done`.
