# Plano — Skill orchestrate-me

> **Status:** implementing
> **Atualizado em:** 2026-11-09

## 1. Contexto e problema

O projeto já tem `breakdown-specs` (decomposição em specs ordenadas) e `implement-me` (execução
de uma spec de ponta a ponta). Falta a etapa de volume: quando há N specs aprovadas (ex.:
`001-010`), executá-las uma a uma é lento e sequencial por natureza. O usuário quer que o agente
principal vire um **orquestrador de subagentes**: cada spec recebe um subagente dedicado que a
implementa de ponta a ponta, rodando em background e em paralelo, com o orquestrador gerenciando
o progresso e a integração.

## 2. Objetivo e critérios de aceite

Criar a skill `orchestrate-me`, que recebe um range de specs (ex.: `001-010`) e entrega:

- Um arquivo de orquestração em `.plans/<inicio>-<fim>-orchestration.md` com range, ondas,
  status ao vivo e resultado consolidado.
- Um subagente por spec, rodando em background, executando `implement-me` de ponta a ponta em
  um worktree isolado com branch `spec/<numero>`.
- Ondas de dependência: specs sem dependências no range rodam em paralelo; dependentes esperam
  suas dependências serem mescladas.
- Integração por onda: merges sequenciais na branch principal, QA completo, push e limpeza de
  worktrees/branches.
- Relatório final consolidado no formato de `.docs/RULES.md`.

Critérios de aceite:

- [ ] Dado `orchestrate-me 001-010`, quando o range existe e as specs estão `approved`, então
      a skill monta ondas, lança um subagente por spec em background e mantém o status ao vivo
      no arquivo de orquestração.
- [ ] Dado um range com dependências entre specs (ex.: 006 depende de 002), quando as ondas são
      montadas, então nenhuma spec é lançada antes de suas dependências estarem mescladas.
- [ ] Dado um range com spec inexistente, `draft` ou com dependência fora do range e não
      concluída, quando a validação roda, então a skill para antes de lançar qualquer subagente
      e informa o bloqueio.
- [ ] Dado um subagente que termina com sucesso, quando a onda é integrada, então o merge é
      feito com mensagem Conventional Commits, o QA completo roda na branch principal e o push
      acontece antes da próxima onda.
- [ ] Dado um subagente bloqueado, quando a onda termina, então a branch dele não é mesclada,
      as dependentes dele são retiradas da fila e o relatório lista o bloqueio.
- [ ] Nenhuma spec é implementada pelo próprio orquestrador; a skill delega para subagentes.

## 3. Escopo

### Dentro

- Criar `.agents/skills/orchestrate-me/SKILL.md` com fases, contrato do subagente, template do
  arquivo de orquestração e template de briefing.
- Definir o modelo de isolamento: um worktree fora do diretório principal + branch
  `spec/<numero>` por spec.
- Definir o modelo de paralelismo: ondas de dependência com lançamento em background.
- Definir o modelo de integração: merge sequencial por onda, QA completo, `commit-and-push`,
  limpeza de worktree.
- Referenciar a skill em `.docs/AGENTS.md`, `.docs/RULES.md` e `.specs/README.md`.

### Fora

- Implementar features de negócio.
- Alterar `implement-me`, `refine-spec`, `create-spec` ou `breakdown-specs`.
- Criar scripts ou automações de CI para orquestração.
- Versionar `.agents/` (permanece no `.gitignore`).

## 4. Abordagem técnica

- **Isolamento por worktree:** cada subagente trabalha em `git worktree` próprio com branch
  `spec/<numero>`, criado fora do diretório principal (nunca dentro, para não ser capturado por
  `git add -A`). Isso elimina disputa de working tree, `index.lock`, builds e testes em
  paralelo, e permite um commit limpo por spec.
- **Ondas de dependência:** grafo montado a partir do campo `Depende de:` das specs e dos mapas
  de breakdown; Kahn por níveis. Dependência fora do range só é satisfeita se estiver `done`.
  Degrada para paralelo total quando não há dependências no range.
- **Background sem polling:** todos os subagentes da onda são lançados com background; o
  orquestrador reage às notificações de conclusão, sem dormir nem consultar progresso. O status
  ao vivo fica no arquivo de orquestração.
- **Contrato do subagente:** executa `implement-me` com adaptações documentadas — commit local
  na branch da spec, sem push, sem merge, sem `commit-and-push`, sem comandos destrutivos no
  banco compartilhado; relatório final começando com `RESULTADO: ok|bloqueado`.
- **Integração por onda:** merges sequenciais `--no-ff` com mensagem Conventional Commits +
  trailer, QA completo na branch principal, push via fluxo `commit-and-push`, limpeza de
  worktree/branch, e só então a próxima onda ramifica do HEAD atualizado.
- **Segurança do repositório:** worktrees fora do diretório principal; `.env` copiado pelo
  orquestrador; infraestrutura local (`infra:up`) garantida uma única vez, compartilhada.

## 5. Arquivos e áreas afetados

- `.agents/skills/orchestrate-me/SKILL.md` (novo, não versionado)
- `.plans/orchestrate-me-skill-plan.md` (novo)
- `.docs/AGENTS.md` (referência no fluxo de trabalho e na lista de skills)
- `.docs/RULES.md` (referência no planejamento e no cadence de git do modo orquestrado)
- `.specs/README.md` (referência na convenção)

## 6. Passos de implementação

- [x] Fechar as decisões de design com o usuário (worktree por spec; ondas de dependência).
- [x] Criar este plano.
- [x] Escrever `.agents/skills/orchestrate-me/SKILL.md`.
- [x] Atualizar `.docs/AGENTS.md`, `.docs/RULES.md` e `.specs/README.md`.
- [x] Validar a skill contra o grafo real das specs 001-008 de autenticação.
- [x] Revisar links, acentuação e consistência com as skills existentes (Prettier).

## 7. Riscos e mitigação

| Risco                                        | Mitigação                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Subagentes disputando o mesmo working tree   | Um worktree e uma branch por spec, fora do diretório principal             |
| Spec dependente rodando antes da dependência | Ondas de dependência; próxima onda só ramifica após merge + QA da anterior |
| Worktree capturado por `git add -A`          | Worktrees sempre fora do diretório principal do repositório                |
| Banco local compartilhado entre subagentes   | Contrato proíbe reset/down; orquestrador revalida QA na integração         |
| Falha silenciosa de subagente                | Relatório final com `RESULTADO:`; branch bloqueada não é mesclada          |
| Merge conflituoso entre specs da mesma onda  | Resolução pelo orquestrador, subagente de correção ou decisão do usuário   |
| Duplicar as regras do `implement-me`         | A skill orquestra `implement-me`; não copia as fases dele                  |
| Push de main quebrada por integração         | QA completo por onda antes do push e antes de ramificar a próxima onda     |

## 8. Plano de testes e QA manual

- Conferir que o grafo de ondas derivado das specs reais (001-008) bate com as dependências
  declaradas em `Depende de:`.
- Simular `orchestrate-me 001-010` com o estado atual (`009`/`010` inexistentes → deve parar).
- Simular `orchestrate-me 001-008` com specs `approved` → ondas: 001 \| 002 \| 003 \| 004 \|
  005+007 \| 006 \| 008.
- Conferir que o template de briefing cobre: diretório do worktree, adaptações do
  `implement-me`, segurança do banco e formato do relatório final.
- Conferir links e referências de caminhos nos três documentos atualizados.
- Rodar o Prettier sobre os arquivos criados/alterados.

## 9. QA manual

1. Ação: ler `.agents/skills/orchestrate-me/SKILL.md` e conferir as fases 0-8.
   Esperado: fases completas, sem referência a caminho inexistente.
   Resultado: ok (ver relatório final).
2. Ação: conferir menções a `orchestrate-me` em `.docs/AGENTS.md`, `.docs/RULES.md` e
   `.specs/README.md`.
   Esperado: referências consistentes com o papel da skill.
   Resultado: ok (ver relatório final).

## 10. Rollout e rollback

- Documentação e skill novas; não há rollback de código. Remover os arquivos e reverter as
  menções em caso de rejeição.
