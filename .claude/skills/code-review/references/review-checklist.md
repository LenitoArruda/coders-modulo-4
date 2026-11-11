# Checklist de revisão

Os oito primeiros eixos são a prioridade do time. Os demais completam a revisão — **não se
limite** ao que está listado: se algo parecer errado, investigue e comente.

Em todos os eixos: confirme no código antes de afirmar; classifique severidade com honestidade
(`issue`/`blocking` só para o que realmente não pode entrar).

---

## 1. Padrões (`standards`, `architecture`)

- Segue `.docs/RULES.md`, `.docs/DEVELOPMENT.md` e os ADRs (`.adrs/`).
- **API (NestJS, vertical slices — ADR 0004/0015):** camadas `interface → application → domain`,
  `infrastructure` implementa portas; domínio não importa framework; aplicação não importa
  infraestrutura; interface não acessa banco/SDK direto; **um use case por fluxo e um request
  handler por endpoint (1:1)**.
- **Web (Next.js App Router):** fronteira Server/Client correta (`"use client"` só quando
  preciso), dados no servidor quando possível, rotas/arquivos conforme convenções do Next desta
  versão.
- TypeScript strict: sem `any`, `@ts-ignore`, `as` forçado, `!` não justificado.
- Nomenclatura/organização conforme `DEVELOPMENT.md` §6; código, identificadores, rotas e
  textos de produto em **en-US**; docs internas em PT-BR.
- Sem `eslint-disable`, `skip`/`only` em teste, `--no-verify` ou outros desvios de gate.
- Commits Conventional Commits; PR com escopo coeso (sem refatoração ampla misturada com
  feature/fix — `RULES.md` §2).
- Dependências novas justificadas; nada de dependência duplicada ou desnecessária.
- Documentação afetada atualizada na mesma mudança (`RULES.md` §4).

## 2. Performance (`performance`)

- **Web:** re-renders desnecessários, objetos/funções recriados em props de listas grandes,
  `useEffect` onde cálculo derivado bastaria, waterfalls de fetch sequencial evitável,
  `Suspense`/streaming, bundle (imports pesados no client, falta de `dynamic`), imagens
  (`next/image`, dimensões), fontes, cache/revalidação.
- **API/DB:** N+1, queries sem índice/filtro/paginação, `SELECT *`, trabalho em loop com `await`
  sequencial que poderia ser paralelo, falta de limites/timeouts, payloads grandes, operações
  síncronas pesadas no event loop.
- Complexidade algorítmica em caminhos quentes; memória (listas ilimitadas, leaks de listeners/
  timers/subscriptions).
- Não peça micro-otimização sem evidência de caminho quente — use `suggestion
(non-blocking, performance)`.

## 3. Bugs e funcionalidade (`bug`, `security`)

- O código faz o que o PR/spec promete? Critérios de aceite atendidos?
- Casos de borda: `null`/`undefined`, listas vazias, strings vazias, limites, concorrência,
  fusos/datas, números/dinheiro, off-by-one.
- Fluxos de erro: erros engolidos, `catch` vazio, mensagens vazando detalhes internos, estados
  de loading/erro/vazio ausentes na UI, retries/idempotência.
- Corridas e estado: setState após unmount, stale closures, dupla submissão, cache inválido.
- Contrato de API: breaking change em rota/DTO/evento sem versionamento ou migração; validação
  de entrada (DTO/zod) e de saída.
- **Segurança:** authN/authZ em todo endpoint novo, injeção (SQL/NoSQL/comando), XSS
  (`dangerouslySetInnerHTML`), CSRF/cookies (`httpOnly`, `secure`, `sameSite`), segredos no
  código/logs/`.env` commitado, PII em logs, upload/URL (SSRF), rate limiting, hash de senha
  conforme ADR 0014, RLS/policies do Supabase.
- Migrações: reversíveis/seguras, sem lock longo, sem perda de dados, RLS habilitado.

## 4. Legibilidade (`readability`)

- Nomes que revelam intenção; funções pequenas e com uma responsabilidade; aninhamento raso
  (early return); sem números/strings mágicos; sem código morto/comentado/`console.log`.
- Comentários explicam o _porquê_, não repetem o _o quê_.
- Duplicação que merece extração (e abstração prematura que não merece).
- Complexidade desnecessária: ternários aninhados, reduce ilegível, tipos excessivamente
  clever.
- Consistência com o código vizinho.

## 5. Componentes acessíveis (`a11y`)

- Reuso de componentes do design system (`packages/ui`, shadcn) em vez de reimplementar;
  primitivos Radix mantêm foco/ARIA corretos.
- Elemento semântico certo (`button` vs `div onClick`, `a` vs `button`, `nav`, `main`, `ul`).
- API do componente: `ref`/props repassadas, `aria-*` expostos, `disabled` vs `aria-disabled`,
  variantes tipadas, sem estilos que quebrem foco.
- Composição consistente com `DESIGN_SYSTEM.md` (tokens, `cn`, variantes `cva`); **apenas light
  theme**.

## 6. i18n (`i18n`)

- Primeiro verifique se o projeto tem biblioteca/catálogo de i18n (`package.json`, pastas
  `messages`/`locales`/`i18n`). **Não presuma.**
  - **Com i18n:** nenhuma string visível ao usuário hardcoded no JSX/alertas/toasts/erros;
    chaves existentes em todos os locales; plurais/gênero via ICU, não concatenação.
  - **Sem i18n (estado atual: produto em en-US):** textos em en-US consistentes e centralizados
    o suficiente para extrair depois; sem concatenação de frases (`"Hello " + name + "!"`);
    nada de português misturado em texto de produto.
- Datas, números, moeda e listas com `Intl`/APIs de locale, não formatação manual.
- Sem layout que quebre com texto mais longo (largura fixa, truncamento sem `title`); considere
  RTL quando aplicável.
- Mensagens de erro da API estáveis (código) separadas do texto exibido.

## 7. QA — testes (`tests`)

- Toda mudança de comportamento tem teste novo/atualizado (`QA.md`, `DEVELOPMENT.md` §8).
- Camada adequada (ADR 0008):
  - **Unitário (Vitest):** regras de domínio/use cases/utilitários/componentes isolados.
  - **Integração (Vitest + Supertest):** endpoints, handlers, repositórios, validação.
  - **E2E (Playwright):** fluxos críticos de usuário; seletores por role/label, sem `sleep`.
- Testes verificam comportamento, não implementação; cobrem caminho feliz, erro e bordas;
  determinísticos (sem dependência de relógio/rede/ordem), mocks no limite correto.
- Sem `.skip`, `.only`, snapshots gigantes sem revisão, asserts vazios, testes que passam sem
  executar o código novo.
- Bug fix traz teste de regressão.
- Testes de banco (`supabase test db`) para migrações/policies quando aplicável.

## 8. A11y (`a11y`)

- **Teclado:** tudo operável por Tab/Enter/Space/Esc/setas; ordem de foco lógica; foco visível;
  sem armadilha de foco; foco gerenciado em dialogs/menus/rotas (retorna ao gatilho).
- **Leitor de tela:** nome acessível em todo controle (`label`, `aria-label`,
  `aria-labelledby`); `alt` em imagens (vazio se decorativa); headings em ordem; landmarks;
  estados/mudanças anunciados (`aria-live`, `role="alert"`, `aria-expanded`, `aria-invalid`,
  `aria-describedby` em erros de formulário).
- **Visual:** contraste ≥ 4.5:1 (texto) / 3:1 (UI grande e componentes); informação não
  transmitida só por cor; alvo de toque ≥ 24×24 (ideal 44×44); respeita `prefers-reduced-motion`;
  zoom 200% e reflow sem perda.
- **Formulários:** labels visíveis, `autocomplete`, `type`/`inputMode` corretos, erros
  associados ao campo e descritos em texto.
- Responsividade validada (mobile/tablet/desktop) conforme `QA.md` §5.1.

---

## Outros eixos (não se limite)

- **Tratamento de erros e resiliência** (`bug`): erros tipados, propagação correta, timeouts,
  fallback, mensagens úteis sem vazar internals.
- **Observabilidade** (`observability`, ADR 0007): logs estruturados sem PII/segredos, spans e
  métricas nos fluxos novos, correlação de requisições.
- **Banco de dados** (`db`): índices, constraints, tipos, migrações versionadas, RLS, seeds.
- **Configuração e infra:** variáveis de ambiente documentadas em `.env.example`, sem segredos,
  `docker-compose`/CI coerentes.
- **Compatibilidade:** breaking changes, feature flags, rollback seguro.
- **Documentação** (`docs`): README/ADR/docs afetados; JSDoc só onde agrega.
- **Higiene do PR:** título/descrição claros, escopo coeso, arquivos gerados/lockfile coerentes,
  nada de artefatos (`dist`, `.next`, `.turbo`, `coverage`) ou `.env` no diff.
- **Aderência à spec/plano** (`.specs/`, `.plans/`): nada faltando, nada além do pedido.
