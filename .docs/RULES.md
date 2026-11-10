# RULES.md — Regras do projeto

> **Normativo.** Em caso de conflito, este documento prevalece sobre os demais.
> **Status:** ativo · **Atualizado em:** 2026-11-09

Estas regras valem para qualquer pessoa ou agente que altere o repositório.

---

## 1. Planejamento obrigatório

Antes de iniciar qualquer desenvolvimento:

1. Crie um plano em `.plans/<numero>-<slug>-plan.md`.
2. Use a skill `feature-concept` para levantar requisitos **quando ela estiver disponível**.
   Caso contrário, faça as perguntas manualmente e registre as respostas no plano.
3. O plano deve conter, no mínimo:
   - Contexto e problema
   - Objetivo e critérios de aceite
   - Escopo e fora de escopo
   - Abordagem técnica
   - Arquivos/áreas previstos
   - Riscos e mitigação
   - Plano de testes e QA manual
4. Se o escopo mudar durante a execução, atualize o plano antes de continuar.
5. Mudanças triviais (typo, link quebrado, formatação) dispensam plano; registre a dispensa no
   relatório final.
6. Specs de feature ficam em `.specs/<numero>-<slug>.md` (3 dígitos, ex.:
   `001-expert-onboarding.md`) e seguem o template
   [`.specs/_template.md`](../.specs/_template.md). Crie com `create-spec`, refine com
   `refine-spec` e execute com `implement-me`. Use `feature-concept` quando a ideia ainda estiver
   vaga ou for necessário descobrir requisitos. Quando o pedido descrever um épico ou várias
   features, use `breakdown-specs` antes de `create-spec` para gerar o mapa em `.plans/` e as
   specs em ordem de dependência. Para executar várias specs aprovadas de uma vez, use
   `orchestrate-me`: um subagente por spec, em paralelo, com integração por onda.

---

## 2. Escopo e mudanças

- Faça a **menor mudança** que resolve o problema.
- Não faça refatorações, renomeações ou formatações fora do escopo.
- Não adicione dependências sem justificar custo, alternativa e impacto.
- Não altere código gerado nem pastas ignoradas (`node_modules`, `.next`, `.turbo`, `dist`,
  `coverage`).
- Se encontrar um problema adjacente, registre-o; não o corrija "de carona".

---

## 3. Qualidade

- É **proibido** desabilitar lint, tipagem ou testes para concluir uma tarefa.
- Não use `any`, `@ts-ignore` ou `eslint-disable` sem justificativa explícita no código e no
  relatório.
- Toda mudança de comportamento deve incluir testes. A infraestrutura existe: **Vitest +
  Supertest** na API e **Playwright** no web; comandos em [QA.md](./QA.md).
- Toda UI deve passar pelos checklists de acessibilidade e responsividade de
  [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) e [QA.md](./QA.md).
- Siga [DEVELOPMENT.md](./DEVELOPMENT.md) para arquitetura, nomenclatura e padrões.

---

## 4. Documentação

- Documentação interna (`.docs/`, `.specs/`, `.plans/` e ADRs) em **PT-BR**.
- Textos de produto (UI, e-mails transacionais), rotas, endpoints e código em **en-US**; identificadores em inglês.
- Atualize o documento afetado na **mesma mudança** de código.
- Evite duplicar informação entre documentos: referencie o documento dono do assunto. Repetir
  uma regra crítica de forma curta é aceitável para reforço.
- Todo comando citado deve existir no `package.json` ou estar marcado como **planejado**.
- Use a legenda de status: ✅ implementado · 🧭 planejado · ❌ fora de escopo.

---

## 5. Segurança e privacidade

- Segredos apenas em variáveis de ambiente; **nunca** no código, em logs ou no Git.
- Valide entradas na borda do sistema (API, conectores, formulários, variáveis de ambiente).
- Aplique menor privilégio em tokens de conectores e credenciais.
- Não registre PII, tokens ou payloads sensíveis em logs.
- Isolamento entre tenants/workspaces é obrigatório quando houver multi-tenancy.

---

## 6. Git

- Commit messages seguem **Conventional Commits**: `<tipo>(<escopo opcional>): <descrição>`.
- Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore` e `revert`. Descrição em inglês, no imperativo, sem ponto final.
- Exemplos: `feat: add expert card`, `fix(api): handle empty connector response`.
- O hook `commit-msg` do Lefthook valida a mensagem com **commitlint**; commits fora do padrão
  são bloqueados. Para validar manualmente a mensagem preparada: `bun run lint:commit`.
- Ao final de cada spec, a skill `implement-me` executa o comando `commit-and-push`
  (`.agents/commands/commit-and-push.md`): analisa o diff, commita e faz push. No modo
  orquestrado (`orchestrate-me`), cada subagente commita na branch `spec/<numero>` do seu
  worktree e o orquestrador integra por onda: merge, QA completo e `commit-and-push` antes de
  lançar a onda seguinte.
- Commits criados por esse fluxo incluem o trailer
  `Co-authored-by: OpenCode Agent <noreply@opencode.ai>`.
- Fora da execução de spec, não commite nem faça push sem pedido explícito do usuário.
- Não commite `.env`, credenciais ou artefatos de build.
- Não reescreva histórico compartilhado nem use `push --force` em branches de outras pessoas.
- Antes de finalizar, confira `git status` e remova arquivos acidentais.

---

## 7. Proibições explícitas

- ❌ Instalar dependência "para testar" sem registrar no relatório.
- ❌ Alterar regras de negócio sem atualizar `BUSINESS.md`.
- ❌ Alterar arquitetura sem atualizar `ARCHITECTURE.md`.
- ❌ Criar componente de UI fora do design system sem justificativa.
- ❌ Entregar UI com dark mode, cores fora da paleta ou texto branco sobre pastel.
- ❌ Declarar tarefa concluída sem executar [QA.md](./QA.md).

---

## 8. Relatório final obrigatório

Ao final de **cada interação**, entregue os cinco itens abaixo, nesta ordem:

### 8.1 Decisões arquiteturais

O que foi decidido e por quê. Inclua trade-offs e alternativas descartadas.

### 8.2 QA manual

Passo a passo reproduzível:

```md
1. Ação: <o que fazer>
   Esperado: <resultado>
   Resultado: <ok | falha + evidência>
```

### 8.3 Arquivos modificados

Lista de caminhos criados, alterados ou removidos.

### 8.4 Bibliotecas instaladas

Nome, versão e motivo. Se nenhuma, escreva "nenhuma".

### 8.5 Racionais

Justificativa das escolhas de implementação, mudanças e omissões relevantes.

---

## 9. Exceções

Se uma regra impedir a entrega correta:

1. Pare.
2. Explique o conflito e o impacto.
3. Proponha a alternativa.
4. Peça aprovação antes de violar a regra.
