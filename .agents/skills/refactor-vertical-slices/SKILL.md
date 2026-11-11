---
name: refactor-vertical-slices
description: Audita e refatora as vertical slices da API para o padrão arquitetural do projeto — camadas interface → application → domain, com infrastructure implementando portas (conceitos de arquitetura hexagonal), um use case por fluxo e um request handler por endpoint em relação 1:1. Orquestra seis subagentes em sequência — auditoria de não conformidades, plano de refatoração, execução, gates de qualidade, commit/push e abertura de PR. Use sempre que o usuário pedir para "refatorar slices", "auditar vertical slices", "padronizar a arquitetura da API", "quebrar controllers em request handlers", "um use case por fluxo", "aplicar arquitetura hexagonal", "corrigir camadas", "migrar controllers para request handlers" ou apontar módulos/slices fora do padrão.
user-invocable: true
metadata:
  argument-hint: "[all | <slice>[,<slice>]] [--audit-only | --plan-only]"
---

# Refactor Vertical Slices

Você é o **orquestrador** de uma refatoração arquitetural. Não faça a auditoria, o plano nem a
refatoração com as próprias mãos: cada uma das seis fases é executada por um **subagente
separado**, em sequência, porque cada fase consome o artefato da anterior. Seu trabalho é
resolver o escopo, proteger o repositório, escrever briefings completos, validar os artefatos e
entregar o relatório final.

A separação em agentes existe por um motivo prático: quem audita não deve ser quem planeja, e
quem planeja não deve ser quem executa. Contextos independentes reduzem o viés de "defender" a
própria análise e fazem o QA encontrar o que o executor não viu.

## Quando usar

- A API tem slices fora do padrão de camadas (`interface`, `application`, `domain`,
  `infrastructure`).
- Um controller concentra vários endpoints e precisa virar request handlers.
- Um use case atende vários fluxos e precisa ser dividido.
- Há dependência invertida: domínio importando framework, aplicação importando infraestrutura,
  interface acessando banco/SDK.
- O usuário pediu explicitamente para "refatorar as slices", "padronizar a arquitetura" ou
  "aplicar request handler 1:1 com use case".

## Quando não usar

- Implementar uma feature nova: use `create-spec` + `implement-me`.
- Refatorar UI/Next.js: a arquitetura em camadas descrita aqui é da API NestJS.
- Adicionar um endpoint novo a uma slice já conforme: implemente seguindo o padrão existente.
- Fazer renomeação cosmética sem mudança de responsabilidade.
- O repositório está com gates vermelhos antes de começar: conserte a base primeiro.

## Escopo

O alvo é `apps/api/src/modules/<slice>/`. Descubra as slices dinamicamente; não hardcode a lista.
`modules/shared` é código transversal e fica fora do escopo por padrão — audite-o apenas se o
usuário pedir e trate como "shared", não como slice de domínio.

Uma execução pode cobrir uma slice (`auth`), uma lista (`auth,hello`) ou todas (`all`). O padrão
é `all`. O escopo não pode ser ampliado durante a execução sem confirmação do usuário.

## Arquitetura alvo (resumo)

```text
interface ──► application ──► domain
                   ▲
             infrastructure (implementa portas)
```

| Camada           | Contém                                                                  | Não pode                                      |
| ---------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `domain`         | Entidades, value objects, invariantes, políticas, erros de domínio      | Framework, banco, HTTP, SDK, `@nestjs/*`      |
| `application`    | Um use case por fluxo, portas, serviços internos compartilhados         | Adaptador concreto, HTTP, `@Controller`       |
| `infrastructure` | Adaptadores que implementam portas: Supabase, SDKs, filas, HTTP clients | Regra de negócio, controller, `HttpException` |
| `interface`      | Um request handler por endpoint, guards, decorators, rate limiters      | Regra de negócio, repositório, banco, SDK     |

Estrutura alvo de uma slice:

```text
apps/api/src/modules/<slice>/
├── domain/
├── application/
│   ├── ports/
│   └── <flow>.use-case.ts
├── infrastructure/
│   └── <vendor>-<x>.adapter.ts | supabase-<x>.repository.ts
├── interface/
│   ├── request-handlers/
│   │   └── <flow>.request-handler.ts
│   ├── <flow>.integration.spec.ts
│   └── guards/ | decorators/ | rate-limiters/ (quando existirem)
└── <slice>.module.ts
```

Use `references/target-pattern.md` como fonte detalhada de exemplos, nomes e receita de migração.

## Contrato não negociável

Estas regras definem o que é "conforme". Violá-las é blocker de auditoria e de QA.

1. **Um request handler por endpoint.** Cada classe em `interface/request-handlers/` declara
   exatamente **um** método com decorator de rota (`@Get`, `@Post`, `@Put`, `@Patch`,
   `@Delete`). Vários handlers podem compartilhar o mesmo prefixo `@Controller("auth")`; isso
   não os transforma em um controller multi-endpoint.
2. **Relação 1:1 entre request handler e use case de entrada.** O handler injeta exatamente
   **um** `*UseCase`. Rate limiter, guard, logger e mapper de erro são colaboradores
   transversais e não contam como use cases.
3. **Um use case por fluxo/intenção.** Se um use case serve endpoints diferentes ou mistura
   fluxos não relacionados, divida. Um use case pode compor um **serviço interno** da aplicação
   (ex.: `CreateSessionUseCase` usado por confirmação e sign-in), mas não deve chamar outro use
   case de endpoint.
4. **Nenhum `*.controller.ts` multi-endpoint permanece no escopo.** Controller com um endpoint
   só é finding menor de nomenclatura; com dois ou mais é blocker.
5. **Dependências apontam para dentro.** `domain` não importa framework/SDK/HTTP; `application`
   não importa `infrastructure/` nem adaptador concreto; `interface` não acessa repositório,
   banco ou SDK diretamente.
6. **Portas ficam em `application/ports/`** (ou no domínio, quando a porta é do domínio) e são
   classes abstratas, seguindo a convenção do projeto. Adaptadores ficam em `infrastructure/` e
   são ligados no módulo da slice.
7. **Erros de domínio não viram HTTP no domínio nem na aplicação.** O handler (ou um mapper da
   interface) traduz para o contrato `{ code, message, fieldErrors? }`.
8. **Comportamento preservado.** A refatoração não muda rotas, métodos, status, corpos, headers,
   cookies, rate limits, guards, códigos de erro, e-mails ou efeitos colaterais. Testes de
   integração existentes são a rede de segurança; não os enfraqueça para "passar".
9. **Sem dependências novas, sem `any`, `@ts-ignore` ou `eslint-disable`.** Se algo parecer
   exigir isso, pare e reporte.
10. **Sem big bang.** Execute em ondas pequenas; cada passo precisa ser verificável isoladamente.

## Artefatos

Crie os artefatos em `.plans/` com o escopo normalizado (ex.: `api-auth`, `api-all`):

| Artefato                             | Autor        | Conteúdo                                                      |
| ------------------------------------ | ------------ | ------------------------------------------------------------- |
| `.plans/refactor-<escopo>-audit.md`  | Agente 1     | Achados com evidência, severidade e contrato de comportamento |
| `.plans/refactor-<escopo>-plan.md`   | Agente 2     | Plano em ondas, passos, riscos, testes e QA                   |
| `.plans/refactor-<escopo>-qa.md`     | Agente 4     | Gates executados, reauditoria e evidências                    |
| `.plans/refactor-<escopo>-pr.md`     | Agente 6     | Corpo do PR                                                   |
| `.plans/refactor-<escopo>-report.md` | Orquestrador | Relatório final consolidado                                   |

Os artefatos são duráveis de propósito: um subagente com contexto novo precisa conseguir continuar
lendo o arquivo, sem depender do resumo do orquestrador. Eles entram no commit.

---

## Fase 0 — Escopo, segurança e baseline (orquestrador)

1. **Parseie o argumento.**
   - Vazio ou `all` → todas as slices em `apps/api/src/modules`, exceto `shared`.
   - `<slice>` ou `<slice>,<slice>` → apenas as listadas.
   - `--audit-only` → pare depois da Fase 1.
   - `--plan-only` → pare depois da Fase 2.
   - Slice inexistente → pare e liste as disponíveis. Não invente.
2. **Leia o contexto obrigatório:** `.docs/AGENTS.md`, `.docs/ARCHITECTURE.md` (§4),
   `.docs/DEVELOPMENT.md` (§2 e §3), `.docs/QA.md` e `.docs/RULES.md`.
3. **Verifique o working tree:** `git status --short --branch`. Se houver mudanças não
   commitadas, pare e peça para commitar ou stashedar. Refatoração arquitetural não pode se
   misturar com trabalho alheio. Se o usuário pedir explicitamente para incluir as mudanças,
   registre a exceção no relatório.
4. **Resolva a branch.**
   - Detecte a branch base: `git symbolic-ref refs/remotes/origin/HEAD --short` (remova
     `origin/`); se falhar, tente `main` e depois `master`.
   - Se estiver na branch base, crie `refactor/<escopo>` (ex.: `refactor/api-auth`).
   - Se estiver em outra branch, **pergunte** se a refatoração deve partir do HEAD atual ou de
     `origin/<base>`. Não troque de base silenciosamente.
   - Nunca trabalhe direto na branch base.
5. **Rode o baseline** na branch de trabalho:
   `bun run lint`, `bun run types:check`, `bun run test`, `bun run build`.
   Registre os resultados no cabeçalho da auditoria. Se qualquer gate falhar, **pare**: não é
   possível provar que a refatoração preservou o comportamento sobre uma base vermelha.
   Não rode `test:e2e` para refatoração exclusiva da API; rode se houver mudança no web.
6. **Crie o cabeçalho da auditoria** em `.plans/refactor-<escopo>-audit.md` com escopo, branch,
   base, data e tabela de baseline. O Agente 1 completa o restante.

## Fase 1 — Agente 1: Auditor de não conformidades

Objetivo: encontrar **todos** os pontos que não seguem o padrão, com evidência suficiente para
alguém corrigir sem adivinhar.

Briefing: use o **Template A** de `references/subagent-briefings.md`. Entregue ao subagente o
escopo, o caminho da auditoria, o baseline e a referência `references/audit-checklist.md`.

O auditor deve:

- Ler os documentos do projeto e o checklist.
- Enumerar cada slice do escopo, cada camada e cada arquivo relevante.
- Inventariar **todos** os endpoints e seus contratos observáveis: método, caminho completo,
  guards, validação, status, corpo, headers, cookies, rate limits, códigos de erro e efeitos
  colaterais. Esse inventário é o "golden master" da refatoração.
- Produzir achados no formato:
  `ID | slice | camada | severidade | regra violada | arquivo:linha | evidência | mudança exigida | risco`.
- Classificar severidade:
  - **blocker**: viola 1:1, direção de dependência, contrato de comportamento ou deixa endpoint
    sem teste/cobertura de integração.
  - **major**: lógica na camada errada, porta/adaptador mal posicionado, domínio impuro, camada
    ausente.
  - **minor**: nomenclatura, localização de arquivo, sufixo inconsistente, organização de teste.
- Listar isenções e casos ambíguos com justificativa (ex.: `shared`, fakes de teste, helpers
  puros).
- **Não** propor o plano passo a passo; isso é do Agente 2.
- Terminar com `AUDIT_RESULT: ok` ou `AUDIT_RESULT: blocked`, contagem de achados por severidade
  e os caminhos dos artefatos.

Validação do orquestrador antes de avançar:

- Toda slice do escopo tem linha na tabela.
- Todo achado tem `arquivo:linha` e evidência concreta; achado sem evidência volta para o auditor.
- O inventário de comportamento cobre todos os endpoints (confira a contagem de rotas).
- Se não houver nenhum achado, pare e reporte "slice já conforme"; não invente refatoração.
- Se houver apenas minors, confirme com o usuário se vale refatorar; o padrão é seguir se o
  pedido foi "padronizar tudo".

## Fase 2 — Agente 2: Planejador da refatoração

Objetivo: transformar os achados em um plano executável, em ondas, sem mudar comportamento.

Briefing: use o **Template B** de `references/subagent-briefings.md`. O subagente lê a auditoria
completa e `references/target-pattern.md`.

O plano deve seguir `.docs/RULES.md#1-planejamento-obrigatório` e conter:

1. Contexto, objetivo e critérios de aceite.
2. Escopo dentro/fora, ligado aos IDs de achado.
3. Abordagem técnica e ondas sugeridas:
   - **Onda 1:** movimentos estruturais e extração de portas/adaptadores sem mudar comportamento.
   - **Onda 2:** divisão de use cases por fluxo.
   - **Onda 3:** divisão de controllers em request handlers e ligação no módulo.
   - **Onda 4:** limpeza, nomenclatura, testes e documentação.
     A ordem pode mudar se houver dependência; justifique.
4. Passos pequenos, cada um com: ID do achado, arquivos, mudança, teste/comando de verificação e
   critério de conclusão.
5. Checklist de contrato de comportamento derivado da auditoria: cada endpoint e seu contrato
   devem permanecer idênticos.
6. Plano de testes: unitários de use case/handler, integração de endpoint e reauditoria.
7. Riscos e mitigação; condições de parada.
8. Documentação: atualizar `ARCHITECTURE.md`, `DEVELOPMENT.md` e `QA.md`; criar ADR se o padrão de
   request handler ainda não estiver formalizado.
9. Rollout/rollback (branch, commit, PR; rollback por revert).

Regras:

- Todo achado **blocker** e **major** precisa estar mapeado para pelo menos um passo.
- Nenhum passo pode alterar comportamento; se precisar, separe em outra entrega.
- Não proponha renomear rotas públicas, mudar status ou "melhorar" mensagens.
- Termine com `PLAN_RESULT: ok` e contagem de passos/ondas.

Validação do orquestrador:

- Cobertura completa dos blockers/majors.
- Passos verificáveis e ordenados; sem "refatorar tudo" genérico.
- Checklist de comportamento presente.
- Se o plano crescer demais, divida em ondas e confirme com o usuário antes de executar.

## Fase 3 — Agente 3: Executor do plano

Objetivo: aplicar o plano exatamente como aprovado, preservando comportamento.

Briefing: use o **Template C** de `references/subagent-briefings.md`. O subagente lê o plano, a
auditoria e `references/target-pattern.md`.

Regras de execução:

- Trabalhe apenas na branch e no escopo definidos. Não toque em outras slices, planos, specs ou
  configurações não previstas.
- Execute os passos na ordem. Marque o checkbox no plano ao concluir cada um.
- Faça a menor mudança que atende ao passo e rode a verificação direcionada antes de seguir
  (`bunx turbo test --filter=api --only`, `bunx turbo types:check --filter=api --only` ou o
  teste específico).
- Preserve o contrato de comportamento. Se um teste falhar porque o comportamento mudou, **pare**
  e reporte; não ajuste o teste para aceitar a mudança.
- Ao dividir um controller, mova o corpo do método sem reescrever regra de negócio; mantenha
  decorators, guards, `@HttpCode`, `@Res({ passthrough: true })` e o mapeamento de erros.
- Registre cada handler no `<slice>.module.ts` antes de remover o controller antigo. Rode a
  integração da slice e só então apague o arquivo antigo.
- Ao dividir um use case, mova a intenção para a nova classe e mantenha os colaboradores
  compartilhados como serviços internos da aplicação.
- Ao extrair porta/adaptador, a aplicação passa a depender só da porta; o módulo liga a porta ao
  adaptador concreto.
- Atualize os testes: handlers novos podem ser cobertos por testes de integração; use cases
  divididos ganham unitários. Não remova asserções.
- Atualize a documentação prevista no plano (incluindo o ADR, se for a primeira execução).
- **Não faça commit, push ou PR nesta fase.** O commit é do Agente 5.
- Se o plano se revelar inválido, pare e reporte com evidência; não invente um novo escopo.

Saída: `EXECUTION_RESULT: ok` ou `EXECUTION_RESULT: blocked`, com passos concluídos, arquivos
alterados, testes rodados e pendências.

Validação do orquestrador:

- Todos os passos do plano marcados ou justificados.
- `git status` mostra mudanças apenas no escopo + artefatos + docs previstos.
- `git log` não tem commit novo (o executor não commitou).
- Se bloqueado, pare e reporte; não avance para o QA.

## Fase 4 — Agente 4: QA e reauditoria

Objetivo: provar que os gates passam e que o padrão foi realmente aplicado, sem confiar no
executor.

Briefing: use o **Template D** de `references/subagent-briefings.md`. O subagente lê
`.docs/QA.md`, a auditoria, o plano e `references/audit-checklist.md`.

O QA deve:

1. Rodar, nesta ordem, na raiz: `bun run lint`, `bun run types:check`, `bun run test`,
   `bun run build`. Rode `bun run test:e2e` apenas se houver mudança no web.
2. Se o lint falhar por formatação, pode rodar `bun run code:fix` **apenas** para correções
   automáticas de estilo, registrar o diff e rodar todos os gates de novo. Não altere lógica.
3. Reauditar as slices do escopo contra `references/audit-checklist.md` e comparar com a
   auditoria original: todo blocker/major foi resolvido? Sobrou algum `*.controller.ts`
   multi-endpoint? Algum handler injeta mais de um use case? Alguma dependência aponta para fora?
4. Verificar o contrato de comportamento: rotas, métodos, status, corpos, headers, cookies, rate
   limits, guards e códigos de erro continuam iguais. Use `git diff`, os testes de integração e,
   quando necessário, o inventário da auditoria.
5. Procurar sinais de teste enfraquecido: asserções removidas, `skip`, `todo`, `expect` genérico
   ou teste deletado sem substituição.
6. Procurar `any`, `@ts-ignore`, `eslint-disable`, dependência nova, segredo ou artefato gerado
   no diff.
7. Escrever `.plans/refactor-<escopo>-qa.md` com: comandos e resultados, reauditoria por slice,
   checklist de comportamento, QA manual reproduzível, riscos residuais e evidências.
8. Terminar com `QA_RESULT: ok` ou `QA_RESULT: blocked`.

Validação do orquestrador:

- `QA_RESULT: ok` é pré-requisito para a Fase 5.
- Se bloqueado, envie o relatório de QA de volta à sessão do executor (ou a um novo executor) para
  corrigir, no máximo **2 ciclos**. Depois de cada correção, rode um **novo** QA. Não commite
  gates vermelhos.
- Se o QA encontrar mudança de comportamento, pare e peça decisão ao usuário.

## Fase 5 — Agente 5: Commit e push

Objetivo: publicar a refatoração em um commit limpo, somente depois do QA verde.

Briefing: use o **Template E** de `references/subagent-briefings.md`. O subagente lê e executa
`.agents/commands/commit-and-push.md` exatamente.

Regras:

- Analise o diff completo; não commite segredos, artefatos gerados ou mudanças fora do escopo.
- Mensagem Conventional Commits, no imperativo e em inglês. Sugestão:
  `refactor(api): align vertical slices with request handler pattern`.
  Para uma slice: `refactor(auth): split controller into request handlers`.
- Inclua código, testes, docs, ADR e artefatos de `.plans/refactor-<escopo>-*.md`.
- Use o trailer `Co-authored-by: OpenCode Agent <noreply@opencode.ai>`.
- Não use `--no-verify`, `--force` ou `--force-with-lease`.
- Faça `git push` (ou `git push -u origin <branch>` se não houver upstream).
- Termine com `COMMIT_RESULT: ok` + hash curto + branch + remote, ou `COMMIT_RESULT: blocked`.

Validação do orquestrador: hash existe, branch correta, push concluído. Se falhar, pare e reporte;
não abra PR.

## Fase 6 — Agente 6: Abertura do PR

Objetivo: abrir um PR revisável, com contexto suficiente para quem não participou da refatoração.

Briefing: use o **Template F** de `references/subagent-briefings.md`. O subagente lê
`references/pr-template.md`, o relatório de QA e os artefatos.

Regras:

- Detecte owner/repo e a branch base (`main`/`master`). Use a branch atual como head.
- Se já existir PR para a branch (`gh pr view --json url`), não crie outro: reporte o URL.
- Crie o corpo em `.plans/refactor-<escopo>-pr.md` a partir do template e rode:
  `gh pr create --base <base> --head <branch> --title "<titulo>" --body-file .plans/refactor-<escopo>-pr.md`.
- Título sugerido: `refactor(api): align vertical slices with request handler pattern`.
- O corpo deve conter: resumo, achados resolvidos (com IDs), mudanças por camada, evidência de
  preservação de comportamento, gates executados, riscos/follow-ups e links dos artefatos.
- Se `gh` não estiver instalado ou autenticado, **não falhe em silêncio**: entregue o link de
  comparação `https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1` e marque
  `PR_RESULT: blocked`.
- Termine com `PR_RESULT: ok` + URL, ou `PR_RESULT: blocked` + motivo/link.

Validação do orquestrador: URL do PR existe (ou link de comparação entregue). Não faça merge.

---

## Relatório final (orquestrador)

Entregue no formato de `.docs/RULES.md#8`, nesta ordem:

1. **Decisões arquiteturais** — o padrão aplicado, ondas, trade-offs e exceções.
2. **QA manual** — passos reproduzíveis, esperado e resultado.
3. **Arquivos modificados** — criados, alterados e removidos, agrupados por camada.
4. **Bibliotecas instaladas** — nome, versão e motivo; ou "nenhuma".
5. **Racionais** — por que a refatoração foi feita assim.

Inclua também:

- Escopo, branch, hash do commit e URL do PR.
- Tabela antes/depois por slice: achados por severidade, resolvidos, adiados.
- Gates: comando, resultado e evidência.
- Contrato de comportamento: confirmação de que rotas/status/corpos/headers não mudaram.
- Bloqueios, lacunas e follow-ups (com dono e critério de retomada).

Escreva o consolidado em `.plans/refactor-<escopo>-report.md`.

## Tratamento de falhas

- **Subagente bloqueado ou incompleto:** retome a mesma sessão com um follow-up específico
  (máximo 2 tentativas por fase). Se continuar bloqueado, pare e reporte.
- **QA vermelho:** devolva o relatório ao executor, corrija e rode um novo QA. Máximo 2 ciclos.
  Se persistir, pare; não commite.
- **Comportamento alterado:** pare imediatamente. Não "conserte" o teste para aceitar a mudança.
- **Conflito de merge/rebase:** pare e peça decisão; nunca use `--ours`/`--theirs` às cegas.
- **Ambiente sem subagentes:** execute as seis fases inline, mantendo os mesmos artefatos e
  contratos, e registre a degradação no relatório. O valor do fluxo está na separação de
  responsabilidades, não apenas na ferramenta.
- **Usuário pede para pular fase:** explique o risco e registre a exceção; nunca pule o QA antes
  do commit.

## Guardrails

- Não altere regra de negócio, contrato público ou comportamento nesta skill.
- Não adicione dependências.
- Não edite `node_modules`, `.next`, `.turbo`, `dist`, `coverage`, `test-results` ou
  `playwright-report`.
- Não commite `.env`, segredos, tokens ou credenciais.
- Não use `any`, `@ts-ignore` ou `eslint-disable` para fazer o gate passar.
- Não remova ou enfraqueça testes para "resolver" falha.
- Não faça refatoração fora do escopo aprovado.
- Não faça merge do PR; a skill termina na abertura.
- Não reescreva histórico compartilhado.
- Atualize a documentação afetada na mesma mudança.

## Anti-padrões

- Renomear `AuthController` para `AuthRequestHandler` e manter sete endpoints na mesma classe.
- Criar um handler por endpoint, mas injetar o mesmo "service" que contém todos os fluxos.
- Dividir use case por operação técnica (`CreateSessionUseCase`) em vez de por intenção de
  endpoint (`SignUpUseCase`, `SignInUseCase`).
- Colocar `HttpException`, `Request`, `Response` ou status code dentro de use case.
- Colocar `@Controller` ou `@UseGuards` na camada de aplicação.
- Importar `infrastructure/` de dentro de `application/`.
- Acessar Supabase/repositório direto do request handler.
- Criar porta em `infrastructure/` ou adaptador em `application/`.
- Refatorar todas as slices em um único passo, sem testes intermediários.
- Abrir PR antes do QA verde.
- Commitar artefatos de build ou mudanças alheias.

## Definition of Done

- [ ] Escopo resolvido; slices inexistentes tratadas com o usuário.
- [ ] Working tree limpo no início e branch dedicada `refactor/<escopo>`.
- [ ] Baseline registrado; gates verdes antes de começar.
- [ ] Auditoria completa em `.plans/refactor-<escopo>-audit.md`, com contrato de comportamento.
- [ ] Plano em `.plans/refactor-<escopo>-plan.md` cobrindo todos os blockers/majors.
- [ ] Plano executado em ondas; nenhum `*.controller.ts` multi-endpoint no escopo.
- [ ] Cada endpoint com um request handler próprio e um use case de entrada 1:1.
- [ ] Dependências apontam para dentro; portas/adaptadores no lugar.
- [ ] `bun run lint`, `bun run types:check`, `bun run test` e `bun run build` verdes.
- [ ] Reauditoria sem blockers/majors; comportamento preservado e comprovado.
- [ ] Documentação arquitetural e ADR atualizados.
- [ ] Commit Conventional Commits + push.
- [ ] PR aberto (ou link de comparação entregue) com corpo completo.
- [ ] Relatório final em `.plans/refactor-<escopo>-report.md` e no formato de `RULES.md`.

## Referências

- `references/target-pattern.md` — árvore alvo, exemplos NestJS, nomes e receita de migração.
- `references/audit-checklist.md` — checklist de auditoria, severidades e formato de achado.
- `references/subagent-briefings.md` — os seis briefings e os contratos de saída.
- `references/pr-template.md` — corpo do PR.
