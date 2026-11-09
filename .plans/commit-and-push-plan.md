# Plano — Comando `commit-and-push`

> Spec: não aplicável (tarefa de tooling/processo)
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto e problema

Hoje o commit é manual: o agente analisa as mudanças, escreve a mensagem, roda `git add` e
`git push`. Isso gera mensagens inconsistentes e exige repetir o mesmo raciocínio a cada
entrega. O commitlint já valida o formato, mas não existe um fluxo padronizado para gerar a
mensagem a partir do diff, commitar e publicar.

Além disso, a skill `implement-me` ainda instrui "não faça commit sem o usuário pedir", o que
impede a publicação automática ao final de uma spec. O usuário definiu que, ao final de cada
spec, o fluxo `commit-and-push` deve ser executado.

## 2. Objetivo e critérios de aceite

- [x] Criar o comando OpenCode `/commit-and-push` em `.opencode/commands/commit-and-push.md`.
- [x] O comando inspeciona `git status`, diff e histórico antes de decidir a mensagem.
- [x] A mensagem segue Conventional Commits, em inglês, no imperativo.
- [x] O commit inclui o trailer `Co-authored-by: opencode <noreply@opencode.ai>`.
- [x] O fluxo faz `git add`, `git commit` (passando pelo hook do commitlint) e `git push`.
- [x] O comando recusa commitar segredos, artefatos gerados e arquivos fora do escopo.
- [x] Nunca usa `--no-verify` nem `--force`.
- [x] Ao final de cada spec, `implement-me` executa o fluxo `commit-and-push`.
- [x] Documentação afetada atualizada (`README.md`, `RULES.md`, `AGENTS.md`, `QA.md`).
- [x] Nenhum commit é criado durante a criação do comando.

## 3. Escopo

### Dentro

- Comando OpenCode `/commit-and-push`.
- Atualização da skill `implement-me` para executar o comando ao final da spec.
- Documentação da convenção de commit, co-autoria e fluxo de publicação.

### Fora

- Configurar CI (não existe pipeline).
- Criar plugin, hook Git adicional ou script Node que substitua o comando.
- Alterar o commitlint ou o hook `commit-msg`.
- Commitar as mudanças atuais.

## 4. Abordagem técnica

- O comando é um **prompt Markdown** em `.opencode/commands/commit-and-push.md` (formato V2
  documentado em `https://opencode.ai/v2/docs/commands`). A análise do diff e a geração da
  mensagem exigem o modelo; por isso não é um script Node.
- O prompt define cinco etapas: inspecionar, gerar mensagem, stage/commit, push e reportar.
- Regras de segurança: não usar `git add -f`, parar em segredos/artefatos, não commitar fora do
  escopo, não reescrever histórico, não usar `--no-verify` nem `--force`.
- O trailer usa o padrão do próprio OpenCode:
  `Co-authored-by: opencode <noreply@opencode.ai>`.
- `implement-me` passa a executar o fluxo na Fase 6, depois de atualizar spec/plano e antes do
  relatório final, para que o relatório inclua hash e status do push.
- Aproveitando a edição da skill, corrigir instruções desatualizadas da Fase 5
  (`check-types`, lint quebrado e "testes não configurados"), que contradizem o estado real da
  fundação.

## 5. Arquivos/áreas previstos

- `.opencode/commands/commit-and-push.md` (novo)
- `.agents/skills/implement-me/SKILL.md`
- `README.md`
- `.docs/RULES.md`
- `.docs/AGENTS.md`
- `.docs/QA.md`
- `.plans/commit-and-push-plan.md` (este plano)

## 6. Riscos e mitigação

| Risco                                     | Mitigação                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Commitar segredos ou artefatos            | Checagem explícita de `git status` e proibição de `git add -f`                  |
| Mensagem ampla para mudanças heterogêneas | O comando deve identificar o tipo dominante e sugerir divisão antes de commitar |
| Push rejeitado                            | Parar e reportar; nunca forçar nem fazer merge/rebase automático                |
| Commit sem QA                             | `implement-me` só executa depois do QA e da documentação                        |
| Hook do commitlint bloquear a mensagem    | Corrigir a mensagem e repetir; proibido `--no-verify`                           |
| Co-autoria incorreta                      | Trailer fixo no prompt e documentado em `RULES.md`                              |

## 7. Plano de testes e QA manual

1. Verificar que `.opencode/commands/commit-and-push.md` é descoberto (comando listado no
   OpenCode) e que o frontmatter é válido.
2. Revisar o prompt contra os fluxos: sem mudanças, mudanças não commitadas, branch sem
   upstream, hook falhando, push rejeitado.
3. Confirmar que `implement-me` referencia o comando na Fase 6 e no DoD.
4. `bun run lint`, `bun run types:check` e `bun run build` sem regressão (docs/config não
   afetam código, mas o gate é obrigatório).
5. Conferir `git status` — apenas arquivos esperados; nenhum commit novo.

> O comando `commit-and-push` **não** será executado nesta tarefa: a criação do comando não é
> uma execução de spec e o usuário não pediu commit agora.

---

## 8. Resultado da execução

**Status:** concluído em 2026-11-09.

Evidências:

- `.opencode/commands/commit-and-push.md` criado no formato V2 de comandos
  (`.opencode/commands/<nome>.md`).
- Mensagem de exemplo com subject, corpo e trailer
  `Co-authored-by: opencode <noreply@opencode.ai>` validada pelo commitlint: exit `0`.
- `implement-me` atualizado: Fase 6 agora finaliza, executa `commit-and-push` e só então
  entrega o relatório; DoD inclui o commit + push.
- QA da skill corrigido: `types:check`, `test` e `test:e2e` no lugar das instruções antigas
  (`check-types`, lint quebrado, testes inexistentes).
- `bun run lint`, `bun run types:check` e `bun run build` passam.
- Nenhum commit criado; alterações permanecem no working tree.

Limitação registrada: `.agents/` está no `.gitignore`, então a edição da skill `implement-me`
é local à máquina. A política durável ficou em `.docs/AGENTS.md` e `.docs/RULES.md`, que são
versionados e lidos pela própria skill.
