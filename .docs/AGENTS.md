# AGENTS.md — Guia para agentes de código

> **Status:** ativo · **Atualizado em:** 2026-11-09
> **Público:** agentes de IA e pessoas que alteram este repositório.

Este é o **ponto de entrada** da documentação. Ele define como navegar pelos documentos,
o fluxo obrigatório de trabalho e o que nunca pode ser feito.

---

## 1. Contexto em 30 segundos

- **Produto:** plataforma de **Experts** — agentes de IA especializados por área/posição da
  empresa (CEO, CMO, CTO etc.).
- **Como funciona:** Experts consomem dados de **conectores externos** (Notion, Google Drive,
  Jira, PDF etc.) para responder perguntas e produzir análises.
- **Repositório:** monorepo **Turborepo** gerenciado com **Bun**.
- **Estado atual:** **fundação implementada** — `apps/web`, `apps/api`,
  `packages/ui` com Tailwind/shadcn, Supabase local, migrações, testes e observabilidade
  (LGTM). O produto e as features de negócio ainda **não estão implementados**. Veja
  [ARCHITECTURE.md](./ARCHITECTURE.md#2-estrutura-atual).

> **Regra de ouro:** não presuma que uma biblioteca, app, script ou pasta existe. Confirme no
> `package.json` e na árvore de diretórios antes de usar ou documentar.

> **Fonte de verdade:** o `README.md` da raiz descreve o setup da fundação; esta pasta contém as
> regras e a documentação técnica. `BUSINESS.md` é o documento de produto e ainda tem hipóteses.
> O README de `apps/web` continua sendo o do starter; não o use como fonte.

---

## 2. Ordem de leitura

| Momento                  | Documento                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| Antes de qualquer tarefa | [RULES.md](./RULES.md) e este arquivo                                     |
| Antes de codar           | [DEVELOPMENT.md](./DEVELOPMENT.md) + [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Antes de alterar UI      | [DESIGN.md](./DESIGN.md) + [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)         |
| Antes de finalizar       | [QA.md](./QA.md)                                                          |
| Para entender o produto  | [BUSINESS.md](./BUSINESS.md)                                              |

**Hierarquia em caso de conflito:** `RULES.md` > `AGENTS.md` > documentos técnicos
(`ARCHITECTURE`, `DEVELOPMENT`, `QA`, `DESIGN_SYSTEM`, `DESIGN`) > `BUSINESS.md`.

Se um documento divergir do código, **não escolha silenciosamente**: o código mostra o estado
atual; os documentos mostram a intenção. Registre a divergência no relatório final e atualize
o documento afetado na mesma tarefa.

---

## 3. Fluxo obrigatório de trabalho

1. **Entender**
   - Leia os documentos da seção 2 e o código diretamente envolvido.
   - Se faltar contexto de produto, consulte `BUSINESS.md`.
   - Se faltar contexto técnico, consulte `ARCHITECTURE.md`.
   - Se a tarefa vier de uma spec (`.specs/<numero>-<slug>.md`), leia-a por completo.
   - Se o pedido descrever um épico ou várias features, use a skill `breakdown-specs` para gerar
     o mapa e as specs em ordem de dependência.
   - Se a spec ainda não existir, use a skill `create-spec`.
   - Se a spec existir mas estiver incompleta, use a skill `refine-spec`.
   - Se a ideia ou a spec estiver vaga, use a skill `feature-concept`.
2. **Planejar**
   - Crie `.plans/<numero>-<slug>-plan.md` conforme [RULES.md](./RULES.md#1-planejamento-obrigatório).
   - Não implemente antes do plano, exceto nas mudanças triviais previstas em `RULES.md`.
   - Para executar uma spec existente de ponta a ponta, use a skill `implement-me`.
   - Para executar um range de specs aprovadas em paralelo com subagentes, use a skill
     `orchestrate-me`.
3. **Implementar**
   - Faça a menor mudança possível, seguindo [DEVELOPMENT.md](./DEVELOPMENT.md).
4. **Verificar**
   - Execute os comandos de [QA.md](./QA.md) e faça o QA manual.
5. **Reportar**
   - Entregue o relatório final no formato de [RULES.md](./RULES.md#8-relatório-final-obrigatório).
6. **Publicar**
   - Ao final de cada spec, execute o comando `commit-and-push`
     (`.agents/commands/commit-and-push.md`): analise o diff, crie o commit Conventional
     Commits com o trailer `Co-authored-by: OpenCode Agent <noreply@opencode.ai>` e faça o push.

---

## 4. Skills

Antes de começar, verifique se existe uma skill adequada ao domínio da tarefa:

- **Descoberta e requisitos:** `feature-concept` — obrigatória quando a ideia/spec estiver vaga.
- **Decomposição de escopo:** `breakdown-specs` — quebra um épico em várias specs pequenas,
  registra o mapa em `.plans` e cria as specs com `create-spec`.
- **Criação de spec:** `create-spec` — transforma um prompt ou ideia em spec refinada em
  `.specs`, seguindo o template canônico.
- **Refinamento de spec:** `refine-spec` — audita uma spec existente e fecha lacunas,
  contradições e critérios de aceite vagos.
- **Execução de spec:** `implement-me` — orquestra spec, plano, implementação e QA.
- **Execução paralela de specs:** `orchestrate-me` — orquestra um range de specs (ex.:
  `001-010`) com subagentes em background, um worktree por spec, ondas de dependência e
  integração por onda (merge + QA + push).
- **Refatoração arquitetural:** `refactor-vertical-slices` — audita as vertical slices da API,
  aplica o padrão de camadas com conceitos hexagonais, um use case por fluxo e um request
  handler por endpoint (1:1), com seis subagentes sequenciais (auditoria, plano, execução, QA,
  commit/push e PR).
- **UI/UX:** `frontend-design` e `web-design-guidelines` são obrigatórias **quando disponíveis**.
- **Banco de dados:** skill de PostgreSQL/Supabase.
- **Framework:** skill de Next.js, React ou NestJS, conforme o caso.
- **Conteúdo:** skill de copywriting ou SEO, quando houver texto público.

Regras:

- Se a skill existir no ambiente, **use-a**.
- Se não existir, siga os checklists de `DESIGN.md`, `DESIGN_SYSTEM.md` e `QA.md` e registre a
  ausência no relatório.
- **Nunca afirme** que usou uma skill que não foi carregada.
- Toda spec deve seguir o template `.specs/_template.md` e o Definition of Ready em
  `.specs/README.md`.

---

## 5. Regras não negociáveis

- Leia o arquivo antes de editá-lo.
- Não desabilite lint, tipagem ou testes para fazer a tarefa "passar".
- Não commite segredos, tokens ou arquivos `.env`.
- Não edite `node_modules`, `.next`, `.turbo`, `dist`, `coverage` ou artefatos gerados.
- Não adicione dependência sem justificar no plano e no relatório.
- Não misture refatoração ampla com feature ou correção.
- Atualize a documentação afetada **na mesma mudança**.
- Toda UI deve ser acessível, responsiva e **apenas light theme**.
- Código, identificadores, rotas, endpoints e textos de produto (UI e e-mails) em **inglês/en-US**;
  documentação interna (`.docs/`, `.specs/`, `.plans/` e ADRs) em **PT-BR**.
- Commits seguem **Conventional Commits**, são pequenos, descritivos e no imperativo (ex.:
  `feat: add expert card`); o hook `commit-msg` valida a mensagem com **commitlint**.

---

## 6. Mapa da documentação

| Arquivo                                         | Responsabilidade                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| [RULES.md](./RULES.md)                          | Regras obrigatórias de processo, escopo, segurança e entrega                 |
| [ARCHITECTURE.md](./ARCHITECTURE.md)            | Estrutura do monorepo, stack atual/alvo, camadas e fluxo de dados            |
| [BUSINESS.md](./BUSINESS.md)                    | Problema, proposta de valor, conceitos, Experts, conectores e MVP            |
| [DESIGN.md](./DESIGN.md)                        | Direção visual, paleta, tipografia, espaçamento e princípios                 |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)          | shadcn/ui, tokens, API de componentes, acessibilidade e governança           |
| [DEVELOPMENT.md](./DEVELOPMENT.md)              | Padrões de engenharia, arquitetura em camadas, front-end, testes e segurança |
| [QA.md](./QA.md)                                | Comandos reais, verificações, QA manual, DoD e lacunas conhecidas            |
| [`.specs/README.md`](../.specs/README.md)       | Convenções, status e Definition of Ready das specs                           |
| [`.specs/_template.md`](../.specs/_template.md) | Template canônico para criar e refinar specs                                 |
| [`.adrs/README.md`](../.adrs/README.md)         | Architecture Decision Records: contexto, decisão e consequências             |

---

## 7. Definição de pronto (resumo)

Uma tarefa só está concluída quando:

- [ ] O plano foi criado/atualizado.
- [ ] `bun run lint`, `bun run types:check`, `bun run test` e `bun run build` passam
      (ver [QA.md](./QA.md#2-comandos-existentes-hoje)).
- [ ] Testes foram adicionados/atualizados para toda mudança de comportamento.
- [ ] UI validada em desktop, tablet e mobile, com teclado e leitor de tela.
- [ ] Documentação afetada foi atualizada.
- [ ] Nenhum segredo foi commitado.
- [ ] A mensagem de commit segue Conventional Commits (validada pelo commitlint).
- [ ] Ao final de uma spec, `commit-and-push` foi executado (commit + push).
- [ ] O relatório final foi entregue.

Checklist completo em [QA.md](./QA.md#8-definition-of-done-dod).
