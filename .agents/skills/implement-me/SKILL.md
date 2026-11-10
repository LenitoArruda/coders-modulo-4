---
name: implement-me
description: Executa uma spec de ponta a ponta. Localiza a spec pelo nome ou caminho, lê AGENTS.md e os documentos do projeto, usa `refine-spec` (e `feature-concept` quando a ideia estiver vaga) para fechar lacunas, cria o plano em .plans/<numero>-<slug>-plan.md e implementa com QA e relatório final. Use sempre que o usuário disser "implement-me", "implementa a spec", "execute a spec", "rodar spec", "implementar feature a partir da spec" ou passar o nome/caminho de uma spec.
user-invocable: true
metadata:
  argument-hint: <spec-name|path>
---

# Implement Me

Execute uma spec **de ponta a ponta**, com contexto, plano, implementação, verificação e
relatório. Você é o responsável por transformar a spec em código funcionando — não apenas por
sugerir mudanças.

## Entrada

Aceite um dos formatos:

- Nome: `001-expert-onboarding` ou `expert-onboarding`
- Caminho: `.specs/001-expert-onboarding.md`
- Referência: "implementa a spec de onboarding de experts"

Se nenhum argumento for informado, pergunte qual spec executar. Não escolha uma spec por conta
própria.

---

## Fluxo obrigatório

### Fase 0 — Resolver a spec

1. Se o argumento for um caminho existente, use-o.
2. Caso contrário, procure em `.specs/<numero>-<slug>.md`.
3. Se o argumento não tiver número, procure `.specs/*-<slug>.md` e confirme se houver
   exatamente um.
4. Se não existir, procure `<slug>.md` no repositório (ignore `node_modules`, `.next`, `.turbo`,
   `dist`, `coverage`).
5. Se houver exatamente um resultado, confirme com o usuário antes de usar.
6. Se houver zero ou mais de um, **pare** e peça o caminho correto.

Nunca invente uma spec nem trate um plano como spec.

### Fase 1 — Ler o contexto

Leia, nesta ordem:

1. `.docs/AGENTS.md` — **obrigatório**, é o ponto de entrada.
2. A spec completa.
3. `.docs/RULES.md` — regras de processo e entrega.
4. `.docs/ARCHITECTURE.md` — estrutura, stack e decisões.
5. `.docs/DEVELOPMENT.md` — padrões de código.
6. `.docs/QA.md` — comandos e Definition of Done.
7. `.docs/BUSINESS.md` — contexto de produto, quando a feature for de negócio.
8. `.docs/DESIGN.md` e `.docs/DESIGN_SYSTEM.md` — quando houver UI.
9. Código, `package.json`, `turbo.json` e a árvore de diretórios das áreas envolvidas.

Confirme no código o que os documentos afirmam. Se houver divergência entre doc e código,
registre e resolva antes de implementar.

### Fase 2 — Validar a prontidão da spec

Verifique o **Definition of Ready** em `.specs/README.md#definition-of-ready`:

- Problema, usuário e resultado claros.
- Escopo dentro/fora explícito.
- Fluxos principal e de exceção descritos.
- Dados, contratos e retenção definidos.
- Permissões e isolamento definidos.
- Requisitos não funcionais mensuráveis.
- Critérios de aceite testáveis.
- Dependências e riscos com dono.
- Sem decisão aberta bloqueante.
- Spec aprovada.

Se a spec estiver `draft`, incompleta ou ambígua:

1. **Invoque a skill `refine-spec`** (leia `.agents/skills/refine-spec/SKILL.md`).
2. Se a lacuna for de descoberta (problema, usuário ou escopo ainda vagos), use
   `feature-concept`.
3. Faça as perguntas necessárias e atualize a spec.
4. Só continue depois de obter aprovação explícita do usuário.

Não comece a implementar "enquanto isso". Lacuna de spec vira retrabalho.

### Fase 3 — Criar o plano

Crie `.plans/<numero>-<slug>-plan.md`. Se já existir, leia e atualize; não sobrescreva sem entender.

O plano deve conter:

```md
# Plano — <Nome da spec>

> Spec: .specs/<numero>-<slug>.md
> Status: draft | approved | implementing | done

## 1. Contexto

## 2. Objetivo e critérios de aceite

## 3. Escopo

### Dentro

### Fora

## 4. Abordagem técnica

## 5. Arquivos e áreas afetadas

## 6. Passos de implementação

- [ ] Passo 1
- [ ] Passo 2

## 7. Riscos e mitigação

## 8. Plano de testes

## 9. QA manual

## 10. Rollout e rollback
```

Regras do plano:

- Cada passo deve ser pequeno o suficiente para ser verificado isoladamente.
- Mapeie cada critério de aceite da spec para pelo menos um passo/teste.
- Inclua migrações, feature flags, dados de teste e rollback quando aplicável.
- Se o plano exigir mudança de escopo, nova dependência ou decisão de arquitetura, peça
  aprovação antes de executar.

### Fase 4 — Implementar

Antes do primeiro passo, mude o status da spec e do plano para `implementing`.

Execute o plano em incrementos:

1. Marque o passo como em andamento no plano.
2. Implemente a menor mudança que atende ao passo.
3. Verifique localmente (tipos, lint, teste do módulo).
4. Marque o passo como concluído.
5. Repita.

Durante a implementação:

- Siga `.docs/DEVELOPMENT.md` e `.docs/ARCHITECTURE.md`.
- Use as skills de domínio quando aplicável:
  - UI: `frontend-design` e `web-design-guidelines`.
  - Next.js/React: `next-best-practices` e `vercel-react-best-practices`.
  - Componentes: `shadcn`.
  - Postgres/Supabase: `supabase-postgres-best-practices`.
  - E2E: `playwright`.
- Não faça refatoração fora do escopo.
- Não adicione dependência sem justificar no plano e no relatório.
- Não desabilite lint, tipos ou testes.
- Não commite segredos nem artefatos gerados.
- Não faça commit durante a implementação; o commit e o push acontecem apenas no fim, pelo
  fluxo `commit-and-push` (Fase 6).

Se durante a execução a spec se revelar inválida:

1. Pare.
2. Registre a descoberta.
3. Atualize a spec com `refine-spec` (ou `feature-concept` se o problema mudou).
4. Peça aprovação do novo escopo antes de continuar.

### Fase 5 — Verificar

Execute os comandos de `.docs/QA.md`:

1. `bun run lint`
2. `bun run types:check`
3. `bun run test`
4. `bun run build`
5. `bun run test:e2e` (quando a mudança afetar o web)
6. QA manual dos fluxos da spec

Observações atuais do repositório:

- Use `bun run <script>`; `bun build` e `bun test` são comandos nativos do Bun.
- A infraestrutura existe: Vitest + Supertest na API e Playwright no web.
- O lint compartilhado foi corrigido na fundação. Se ele voltar a falhar, trate como regressão.

Valide também:

- Critérios de aceite da spec, um por um.
- Estados de loading, vazio, erro e sucesso.
- Acessibilidade e responsividade quando houver UI.
- Documentação afetada atualizada.
- Nenhuma regressão nos fluxos existentes.

### Fase 6 — Finalizar e publicar

1. Atualize o plano para `done` e a spec para `done` (se o status existir).
2. Execute o fluxo de `.opencode/commands/commit-and-push.md` (comando `/commit-and-push`):
   analise as mudanças, crie o commit Conventional Commits com o trailer
   `Co-authored-by: opencode <noreply@opencode.ai>` e faça o push. **Isso é obrigatório ao
   final de cada spec.**
3. Se o commit ou o push falhar, pare e reporte o bloqueio. Não use `--no-verify` nem
   `--force`.
4. Entregue o relatório final exigido por `.docs/RULES.md`.

O relatório deve conter, nesta ordem:

1. **Decisões arquiteturais** — o que foi decidido, trade-offs e alternativas.
2. **QA manual** — passos reproduzíveis, esperado e resultado.
3. **Arquivos modificados** — criados, alterados e removidos.
4. **Bibliotecas instaladas** — nome, versão e motivo; ou "nenhuma".
5. **Racionais** — por que a implementação foi feita assim.

Inclua também:

- Link da spec e do plano.
- Critérios de aceite atendidos (com evidência).
- Hash do commit e branch publicada.
- Bloqueios, lacunas e follow-ups.

---

## Condições de parada

Pare e peça decisão quando:

- A spec não existir ou estiver ambígua.
- Houver conflito entre spec, docs e código.
- A mudança exigir migração destrutiva ou perda de dados.
- Faltar credencial, acesso ou serviço externo.
- Houver risco de segurança, privacidade ou isolamento entre tenants.
- O escopo crescer além da spec aprovada.
- Um comando de verificação falhar por causa da implementação.

Não contorne bloqueios silenciosamente.

---

## Guardrails

- Spec aprovada é a fonte de verdade do **o quê**; o plano é a fonte do **como**.
- Não implemente nada que não esteja na spec ou no plano aprovado.
- Não altere `BUSINESS.md`, `ARCHITECTURE.md` ou `DESIGN*.md` sem necessidade; se alterar,
  explique no relatório.
- Não use `any`, `@ts-ignore` ou `eslint-disable` sem justificativa.
- Não deixe TODOs sem dono ou issue.
- Não declare concluído sem executar o QA.
- Se o usuário pedir para pular etapas, explique o risco e registre a exceção.

---

## Definition of Done

- [ ] Spec resolvida e aprovada.
- [ ] `AGENTS.md` e docs relevantes lidos.
- [ ] Plano criado/atualizado em `.plans/<numero>-<slug>-plan.md`.
- [ ] Passos do plano concluídos.
- [ ] Critérios de aceite atendidos e verificados.
- [ ] `bun run lint`, `bun run types:check`, `bun run test` e `bun run build` executados.
- [ ] Testes adicionados/atualizados para toda mudança de comportamento.
- [ ] QA manual registrado.
- [ ] Documentação afetada atualizada.
- [ ] `commit-and-push` executado ao final (commit Conventional Commits + push).
- [ ] Relatório final no formato de `RULES.md`.
