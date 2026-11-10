---
name: orchestrate-me
description: Orquestra a implementação paralela de um range de specs (ex.: 001-010) com subagentes em background. Monta ondas de dependência, cria um worktree e uma branch por spec, lança um subagente por spec que executa implement-me de ponta a ponta, acompanha o progresso sem polling, integra por onda com merge + QA + push e entrega o relatório consolidado. Use sempre que o usuário disser "orchestrate-me", "orquestrar specs", "implementar specs 001-010", "rodar o range de specs", "implementar várias specs em paralelo", "implementar todas as specs de uma vez" ou passar um range numérico de specs para implementar de uma vez.
user-invocable: true
metadata:
  argument-hint: <range-de-specs>
---

# Orchestrate Me

Execute **N specs de uma só vez** como orquestrador de subagentes. Você não implementa nenhuma
spec: para cada spec do range você sobe um subagente que executa a skill `implement-me` de ponta
a ponta, em background e em paralelo, num worktree isolado. Você gerencia dependências, ondas,
integração (merge + QA + push) e o relatório consolidado.

## Quando usar

- O usuário passa um range de specs para implementar de uma vez (ex.: `001-010`).
- Há várias specs `approved` e o usuário pediu paralelismo ("em paralelo", "de uma vez",
  "orquestra", "subagentes").

## Quando não usar

- Uma única spec: use `implement-me`.
- A spec está `draft`, incompleta ou vaga: use `refine-spec` (ou `feature-concept`) antes.
- O range ainda não existe: use `breakdown-specs` e depois volte aqui.
- A tarefa não é implementar specs.

---

## Entrada

Aceite um dos formatos (números com ou sem zero à esquerda; padronize em 3 dígitos):

- Range: `001-010`, `1-10`, `001..010`
- Lista: `001,004,007` (trate como o conjunto dos números listados)
- Única: `004` (avise que `implement-me` é mais adequado e confirme)

Se nenhum argumento for informado, pergunte o range. Não escolha specs por conta própria.

---

## Conceitos

| Conceito            | Definição                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Orquestrador**    | Você: valida, monta ondas, lança, acompanha, integra e reporta. Não escreve código de spec.  |
| **Subagente**       | Sessão filha independente que executa `implement-me` para uma única spec, em background.     |
| **Onda**            | Grupo de specs sem dependências pendentes entre si; rodam em paralelo.                       |
| **Worktree**        | Checkout isolado por spec, fora do diretório principal, para evitar disputa de working tree. |
| **Branch de spec**  | `spec/<numero>` criada a partir do HEAD da branch principal no início da onda.               |
| **Integração**      | Merge sequencial das branches concluídas, QA completo, push e limpeza — por onda.            |
| **Espec bloqueada** | Spec cujo subagente terminou sem sucesso; a branch não é mesclada nem publicada.             |

---

## Fluxo obrigatório

### Fase 0 — Resolver o range

1. Parseie o argumento em uma lista de números de 3 dígitos.
2. Valide: início ≤ fim, sem números repetidos.
3. Para cada número, resolva o arquivo: `.specs/<numero>-<slug>.md` (exatamente um por número).
4. **Pare** se algum número do range não existir: informe a lista dos ausentes e pergunte se
   prossegue só com os existentes ou se o range deve ser corrigido. Não pule silenciosamente.
5. Specs com status `done`: marque como `pulada` no relatório (não relance, não recrie worktree).
6. Specs com status `implementing`: **pare** e pergunte o que fazer antes de qualquer lançamento.
7. Ordene a lista por número.

### Fase 1 — Absorver o contexto (nível orquestrador)

Leia, nesta ordem:

1. `.docs/AGENTS.md` — obrigatório, é o ponto de entrada.
2. `.specs/README.md` — convenções, status e Definition of Ready.
3. O cabeçalho de **cada** spec do range: status, `Depende de:` e `Mapa:`.
4. Os mapas de breakdown referenciados (`.plans/*-breakdown.md`).
5. `git status --short --branch` e a branch atual.

Você **não** precisa ler as specs completas nem os documentos técnicos de cada área — isso é
trabalho do subagente. Absorva o contexto uma única vez, para todas as ondas.

### Fase 2 — Validar a prontidão de todas as specs

Antes de lançar qualquer subagente, valide o **Definition of Ready**
(`.specs/README.md#definition-of-ready`) para todas as specs do range:

- Todas devem estar `approved`. Qualquer spec `draft` ou incompleta **para tudo**: liste as
  lacunas, sugira `refine-spec` e pare. Lacuna de spec vira N retrabalhos em paralelo.
- Working tree da branch principal deve estar limpo. Se houver mudanças não commitadas, pare e
  peça para commitar ou stashedar antes.
- Garanta a infraestrutura local **uma única vez** (`bun run infra:up`), pois os subagentes
  compartilham a mesma instância. Se falhar (ex.: Docker parado), pare e reporte.

### Fase 3 — Montar as ondas de dependência

1. Monte o grafo: para cada spec do range, as arestas são as dependências declaradas no campo
   `Depende de:` do cabeçalho; em caso de omissão, use o mapa de breakdown referenciado.
2. Dependência **fora do range**: só conta como satisfeita se estiver `done`. Caso contrário,
   **pare** e pergunte: estender o range para incluí-la, ou retirar a dependente do range.
3. Ciclo entre specs do range: **pare** e reporte (o `breakdown-specs` garante DAG; ciclo indica
   divergência entre spec e mapa).
4. Calcule as ondas por níveis (ordenação topológica):
   - Onda 1: specs cujas dependências já estão satisfeitas (`done` ou fora do range).
   - Onda seguinte: specs cujas dependências estão todas nas ondas anteriores.
   - Specs `done` no range não entram em nenhuma onda.
5. Apresente ao usuário a tabela de ondas (onda, specs, dependências) e **peça confirmação
   antes de lançar**. Se o usuário já tiver dito "decida por mim" ou equivalente, registre a
   decisão no arquivo de orquestração e siga.

### Fase 4 — Preparar o terreno

1. Crie o arquivo de orquestração `.plans/<inicio>-<fim>-orchestration.md` (template abaixo).
   Para listas, use `<primeiro>-<ultimo>` do conjunto resolvido. Committe-o com
   `docs: add orchestration file for specs <inicio>-<fim>` (com o trailer `Co-authored-by`) e
   faça o push — a branch principal deve voltar ao estado limpo antes dos merges.
2. Para **cada spec da onda atual**, crie o worktree **fora do diretório principal do
   repositório** (ex.: `../<repo>-spec-001`):
   - `git worktree add <caminho> -b spec/<numero>` (ramificando do HEAD atual).
   - Nunca crie worktree dentro do diretório principal: ele seria capturado por `git add -A` do
     fluxo de commit.
3. Copie os arquivos de ambiente (`.env` e, se existirem, `.env.local`) do diretório principal
   para cada worktree — worktree novo não herda arquivos ignorados.
4. Anote no arquivo de orquestração: worktree, branch e status `pendente` de cada spec.

O `bun install` dentro de cada worktree é responsabilidade do subagente (Fase 5, briefing).

### Fase 5 — Lançar a onda em background

Para cada spec da onda, **no mesmo passo**:

1. Componha o briefing a partir do template da seção **Briefing do subagente**, preenchendo:
   número, slug, caminho absoluto do worktree e branch.
2. Lance o subagente com a ferramenta de subagentes do ambiente, em **background**
   (ex.: `subagent` com `background: true`), usando o agente de propósito geral (ex.:
   `general`). Não defina modelo a menos que o usuário tenha pedido.
3. Lance **todas as specs da onda em paralelo**, de uma vez. Se o ambiente não suportar tantas
   sessões simultâneas, divida a onda em lotes, informe ao usuário e processe os lotes em
   sequência.
4. Registre no log de progresso do arquivo de orquestração e informe ao usuário a tabela de
   status da onda.

Regras durante o acompanhamento:

- **Não faça polling**: não durma, não consulte progresso em intervalos. Reaja às notificações
  de conclusão de cada subagente.
- A cada notificação, atualize o status da spec (`executando` → `mesclada` / `bloqueada` /
  `falhou`), anexe ao log de progresso com o resultado (`RESULTADO: ok|bloqueado`, commit e
  resumo) e informe o progresso ao usuário.
- Se precisar inferir andamento sem interromper o subagente, leia o estado do worktree dele
  (`git -C <worktree> log --oneline`, checklist do plano dele). Não envie mensagens ao subagente
  para "ver como está".
- Se um subagente terminar com `RESULTADO: bloqueado`, não lança retry automático: marque
  `bloqueada` e siga com as demais da onda.

### Fase 6 — Integrar a onda

Quando **todas** as specs da onda tiverem terminado (ok, bloqueada ou falhou):

1. Para cada branch concluída com `ok`, **na ordem numérica das specs**:
   - Verifique o worktree: `git -C <worktree> status --short` deve estar limpo e o relatório do
     subagente deve citar o hash do commit. Worktree sujo: retome a sessão do subagente
     (sessionID) para concluir o commit; não committe por ele sem registrar a exceção.
   - No diretório principal: `git merge --no-ff spec/<numero> -m "chore(spec): integrate <numero>-<slug>" -m "Co-authored-by: OpenCode Agent <noreply@opencode.ai>"`.
   - Conflito: tente resolver se for trivial e local (mesmo arquivo, regiões distintas);
     caso contrário, abra um subagente de correção na branch principal com o conflito como
     escopo, ou pergunte ao usuário. Nunca use `--ours`/`--theirs` às cegas.
2. Branches `bloqueada`/`falhou`: **não mescle**. Mantenha worktree e branch para continuação
   posterior (a spec permanece `approved` na principal, então pode ser relançada).
3. Rode o **QA completo** na branch principal (comandos de `.docs/QA.md`): `bun run lint`,
   `bun run types:check`, `bun run test`, `bun run build` e `bun run test:e2e` quando aplicável.
   - Se falhar: corrija (direto, se trivial; senão via subagente de correção) e repita o QA. Só
     prossiga com o QA verde. A integração das specs não pode quebrar a branch principal.
4. Execute o fluxo de `.opencode/commands/commit-and-push.md` (`/commit-and-push`): ele leva o
   merge (e eventuais correções/arquivo de orquestração atualizado) ao remote. Sem
   `--no-verify`, sem `--force`.
5. Limpeza: `git worktree remove <caminho>` e `git branch -d spec/<numero>` (após merge
   bem-sucedido; `-d` se recusa a apagar branch não mesclada, o que é a proteção desejada).
6. Atualize o arquivo de orquestração: onda concluída, merges, hash do push.

### Fase 7 — Próxima onda

1. Retire da fila as specs bloqueadas **e suas dependentes transitivas** (informe ao usuário
   quais e por quê).
2. Repita as Fases 4-6 para a onda seguinte: os novos worktrees ramificam do HEAD **já
   atualizado** com os merges da onda anterior — as specs dependentes precisam do código das
   dependências.
3. Não lance a onda seguinte antes do QA verde e do push da onda anterior.

### Fase 8 — Relatório final

Entregue o relatório no formato de `.docs/RULES.md#8-relatório-final-obrigatório`, no nível da
orquestração:

1. **Decisões arquiteturais** — ondas, trade-offs, exceções (ex.: lotes por limite do ambiente).
2. **QA manual** — passos reproduzíveis, esperado e resultado.
3. **Arquivos modificados** — consolidado por spec, apontando para os relatórios dos subagentes.
4. **Bibliotecas instaladas** — união das dependências adicionadas pelos subagentes.
5. **Racionais** — por que as ondas ficaram como ficaram e como os bloqueios foram tratados.

Mais:

- Tabela final: spec \| resultado \| branch \| merge commit \| QA \| push.
- Caminho do arquivo de orquestração e dos planos por spec.
- Bloqueios, lacunas e follow-ups (specs bloqueadas e como retomar: relançar `orchestrate-me`
  com o range delas, ou `implement-me` individual).

---

## Contrato do subagente

Cada subagente recebe exatamente uma spec e respeita, sem exceção:

- Trabalha **somente** dentro do seu worktree, com a branch `spec/<numero>`.
- Executa `implement-me` de ponta a ponta, incluindo plano, QA completo e relatório.
- Faz os commits localmente na branch da spec (Conventional Commits + trailer), mas **não faz
  push, não faz merge e não roda `commit-and-push`** — a integração é do orquestrador.
- Banco local é **compartilhado**: apenas `bun run db:migrate`; nunca reset, down ou destrutivo.
- Não altera outras specs, outros planos, o arquivo de orquestração nem worktrees alheios.
- Termina com um relatório cuja primeira linha é `RESULTADO: ok` ou `RESULTADO: bloqueado`.

---

## Template do arquivo de orquestração

````md
# Orquestração — specs <inicio>–<fim>

> **Range:** <inicio>-<fim>
> **Criado em:** YYYY-MM-DD
> **Branch base:** <branch> @ <hash-curto>
> **Status:** running | done | partial

## 1. Specs do range

| Spec | Título | Status | Worktree | Branch | Estado | Observações  |
| ---- | ------ | ------ | -------- | ------ | ------ | ------------ |
| 001  | ...    | done   | —        | —      | pulada | já concluída |

Estados: `pendente | executando | mesclada | bloqueada | falhou | pulada`.

## 2. Ondas

| Onda | Specs | Lançada em | Concluída em | Merge/push     |
| ---- | ----- | ---------- | ------------ | -------------- |
| 1    | 001   | HH:MM      | HH:MM        | `<hash-curto>` |
| 2    | 002   | HH:MM      | HH:MM        | `<hash-curto>` |

## 3. Grafo de dependências

```text
001 → 002 → 003
002 → 004
```

## 4. Log de progresso

- HH:MM — [001] subagente lançado (background).
- HH:MM — [001] concluído: RESULTADO ok, commit `abc1234`.
- HH:MM — onda 1 integrada: merge, QA verde, push `def5678`.

## 5. Resultado consolidado

| Spec | Resultado | Commit da spec | Merge | QA  | Bloqueios |
| ---- | --------- | -------------- | ----- | --- | --------- |
````

---

## Briefing do subagente (template)

Envie exatamente este contrato, preenchendo os placeholders:

```md
Você é o subagente responsável pela spec <numero>-<slug>, executada de ponta a ponta
dentro do worktree <caminho-absoluto-do-worktree> (branch spec/<numero>).

Diretório de trabalho: TODAS as operações — leitura, edição e comandos — acontecem dentro de
<caminho-absoluto-do-worktree>, usando caminhos absolutos ou o parâmetro de diretório dos
comandos. Não altere nada fora dele.

Missão:

1. Rode `bun install` no worktree (o `.env` já foi copiado; a infraestrutura local já está no
   ar e é compartilhada).
2. Leia .agents/skills/implement-me/SKILL.md e execute a skill para a spec
   .specs/<numero>-<slug>.md DE PONTO A PONTA, com as adaptações abaixo.

Adaptações obrigatórias ao modo orquestrado:

- Fase 6 do implement-me: faça os commits localmente nesta branch, com Conventional Commits e o
  trailer `Co-authored-by: OpenCode Agent <noreply@opencode.ai>`. NÃO faça push, NÃO faça merge
  e NÃO rode o comando commit-and-push — o orquestrador cuida da integração.
- Banco local compartilhado: rode apenas `bun run db:migrate`. NUNCA rode db reset, migração
  down ou qualquer comando destrutivo — outros subagentes usam a mesma instância.
- Escopo: altere apenas os artefatos da sua spec (código, testes, docs, o plano
  .plans/<numero>-<slug>-plan.md e o status da sua spec). Não toque em outras specs, outros
  planos ou no arquivo de orquestração .plans/<inicio>-<fim>-orchestration.md.
- Se a spec se revelar inválida, bloqueada por credencial/serviço ou fora do Definition of
  Ready, PARE de implementar e reporte o bloqueio em vez de contornar.

Relatório final (última mensagem, no formato de .docs/RULES.md#8): comece com a linha
`RESULTADO: ok` ou `RESULTADO: bloqueado`, seguido de resumo, decisões, QA executado, arquivos
modificados, bibliotecas instaladas, hash do(s) commit(s), bloqueios e follow-ups.
```

---

## Exemplo

`orchestrate-me 001-008` com as specs de autenticação aprovadas (`Depende de:` reais):

| Onda | Specs    | Por quê                                                |
| ---- | -------- | ------------------------------------------------------ |
| 1    | 001      | sem dependências                                       |
| 2    | 002      | depende de 001                                         |
| 3    | 003      | depende de 001, 002                                    |
| 4    | 004      | depende de 001, 002, 003                               |
| 5    | 005, 007 | dependem de 004 (005 também de 003; 007 também de 004) |
| 6    | 006      | depende de 005                                         |
| 7    | 008      | depende de 006, 007                                    |

- Onda 5 roda **dois subagentes em paralelo**; as demais são ondas de uma spec só — o
  paralelismo real vem das dependências declaradas, não de um range.
- Se 004 falhar na onda 4: 005, 007 (onda 5), 006 (onda 6) e 008 (onda 7) saem da fila, 002 e
  003 continuam normalmente.
- `orchestrate-me 001-010` hoje: 009 e 010 não existem → para na Fase 0 e pergunta.

---

## Condições de parada

Pare e peça decisão quando:

- Houver spec inexistente, `draft`, `implementing` ou fora do Definition of Ready no range.
- Uma dependência fora do range não estiver `done`.
- O working tree principal não estiver limpo, ou a infraestrutura local falhar.
- Houver ciclo ou divergência entre spec e mapa de breakdown.
- O QA de integração falhar após correção razoável.
- Um merge gerar conflito que não seja trivial e local.
- O ambiente não suportar tantas sessões em paralelo (ofereça lotes).
- O escopo de qualquer spec crescer além do aprovado (o subagente reporta; você decide com o
  usuário).

---

## Guardrails

- Você é orquestrador: **não implemente specs**. Corrija na branch principal apenas o mínimo
  para destravar merge/QA, registrando a exceção.
- Nunca lance uma spec antes de suas dependências estarem mescladas e com QA verde.
- Nunca mescle branch de subagente bloqueado ou sem relatório com `RESULTADO: ok`.
- Worktrees ficam fora do diretório principal e são removidos após a integração.
- Nunca rode comandos destrutivos no banco compartilhado (reset, down, truncate).
- Sem `--no-verify`, sem `--force`, sem reescrever histórico.
- O push para a branch principal acontece por onda, após QA — nunca com QA vermelho.
- Atualize o arquivo de orquestração a cada evento; ele é parte da entrega.
- Se o usuário pedir para pular etapas, explique o risco e registre a exceção.

---

## Anti-padrões

- Fazer polling ou dormir esperando subagentes em vez de reagir às notificações.
- Lançar todas as specs de uma vez ignorando `Depende de:`.
- Implementar as specs você mesmo "porque é mais rápido".
- Criar worktree dentro do repositório (capturado por `git add -A`).
- Lançar a onda seguinte antes do QA verde e do push da anterior.
- Mesclar branches de specs bloqueadas "para não perder o trabalho".
- Duplicar as fases do `implement-me` na orquestração — o briefing referencia a skill.
- Rodar db reset/down no banco local compartilhado.
- Deixar worktrees e branches `spec/*` acumulando após a integração.

---

## Definition of Done

- [ ] Range resolvido; specs inexistentes, `done` e inválidas tratadas com o usuário.
- [ ] Prontidão validada para todas as specs antes do primeiro lançamento.
- [ ] Ondas montadas a partir de `Depende de:` (+ mapas), sem ciclo, confirmadas.
- [ ] Arquivo de orquestração criado em `.plans/<inicio>-<fim>-orchestration.md`.
- [ ] Um worktree e uma branch por spec, com `.env` copiado.
- [ ] Um subagente por spec, em background, com briefing completo.
- [ ] Progresso registrado a cada notificação, sem polling.
- [ ] Integração por onda: merges `--no-ff`, QA verde, `commit-and-push`, limpeza.
- [ ] Specs bloqueadas fora da fila, com dependentes removidas e motivo registrado.
- [ ] Relatório final consolidado no formato de `RULES.md` + tabela por spec.
