# Plano — Commitlint com Conventional Commits

> Spec: não aplicável (tarefa de tooling/processo)
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto e problema

O repositório exige commits pequenos e no imperativo ([RULES.md](../.docs/RULES.md)),
mas não há validação automática. Mensagens fora do padrão passam pelo hook `pre-commit`
(que só roda `lint-staged`) e entram no histórico sem formato consistente. Isso dificulta
leitura do histórico e automação futura (changelog, versionamento, CI).

Já existe **Lefthook 2.2.2** instalado e configurado em `lefthook.yml`, com o hook
`pre-commit`. Não há CI configurado.

## 2. Objetivo e critérios de aceite

- [x] `@commitlint/cli` e `@commitlint/config-conventional` instalados nas versões atuais.
- [x] `commitlint.config.mjs` na raiz estendendo `@commitlint/config-conventional`.
- [x] Hook `commit-msg` do Lefthook executa o commitlint na mensagem do commit.
- [x] Mensagem válida (`feat: add commitlint`) passa; inválida (`mensagem qualquer`) falha com
      código de saída diferente de `0` e mensagem clara.
- [x] `bun run lint:commit` valida a mensagem preparada em `.git/COMMIT_EDITMSG`.
- [x] Documentação afetada atualizada (`README.md`, `.docs/RULES.md`, `.docs/QA.md`).
- [x] Nenhum commit é criado durante a execução.

## 3. Escopo

### Dentro

- Configuração do commitlint e hook `commit-msg` no Lefthook.
- Script de conveniência `lint:commit` na raiz.
- Documentação da convenção e da verificação.

### Fora

- CI (não existe pipeline no repositório).
- Changelog automático, release-please ou semantic-release.
- Alterar o hook `pre-commit`/`lint-staged`.
- Reescrever o commit inicial existente (`Initial commit from create-turbo`), que é anterior
  à regra e continuará fora do padrão.

## 4. Abordagem técnica

- `commitlint.config.mjs` com `extends: ["@commitlint/config-conventional"]`. As regras padrão
  já cobrem o projeto: `type-enum` (feat, fix, docs, style, refactor, perf, test, build, ci,
  chore, revert), `subject-empty`, `subject-full-stop`, `header-max-length` (100) e
  `subject-case` (impede Sentence/Start/Pascal/Upper), alinhado ao imperativo em inglês.
- Hook no Lefthook:

  ```yaml
  commit-msg:
    jobs:
      - name: commitlint
        run: bunx commitlint --edit {1}
  ```

  `{1}` é o caminho do arquivo de mensagem fornecido pelo Git.

- Script raiz `"lint:commit": "commitlint --edit"`, que lê `.git/COMMIT_EDITMSG`.
- `bunx lefthook install` para regenerar os hooks do Git, incluindo `commit-msg`.

## 5. Arquivos/áreas previstos

- `package.json` (devDependencies + script) e `bun.lock`
- `commitlint.config.mjs` (novo)
- `lefthook.yml`
- `README.md`
- `.docs/RULES.md`
- `.docs/QA.md`

## 6. Riscos e mitigação

| Risco                                       | Mitigação                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hook não ser instalado em clones existentes | `prepare` já roda `lefthook install` no `bun install`; documentar `bunx lefthook install` |
| `bunx` lento/indisponível no hook           | O projeto já usa `bunx lint-staged` no `pre-commit`; mesmo padrão                         |
| Falso negativo por config não encontrada    | Config na raiz; validar com `bunx lefthook validate` e teste real do hook                 |
| Mensagens em PT-BR no assunto               | A regra não impede PT-BR; apenas o formato. Convenção do projeto segue inglês             |
| Commit inicial fora do padrão               | Documentado como exceção histórica; não reescrever histórico                              |

## 7. Plano de testes e QA manual

1. `bunx lefthook validate` — config válida.
2. `bunx commitlint --edit <arquivo-válido>` — passa.
3. `bunx commitlint --edit <arquivo-inválido>` — falha com exit code ≠ 0.
4. Executar o hook gerado em `.git/hooks/commit-msg` com os dois arquivos — mesmo resultado.
5. `bun run lint:commit` — valida `.git/COMMIT_EDITMSG` (o commit inicial deve falhar).
6. `bun run lint` e `bun run types:check` continuam passando (sem regressão).
7. Conferir `git status` — apenas arquivos esperados; nenhum commit novo.

---

## 8. Resultado da execução

**Status:** concluído em 2026-11-09.

Evidências:

- `@commitlint/cli@21.2.4` e `@commitlint/config-conventional@21.2.4` instalados na raiz;
  `bun.lock` atualizado.
- `bunx lefthook validate` → `All good`.
- `bunx lefthook install` → `sync hooks: ✔️(commit-msg, pre-commit)`.
- Mensagem válida (`feat: add commitlint`): `commitlint --edit` e hook `commit-msg` saem com `0`.
- Mensagem inválida (`mensagem qualquer`): ambos falham com exit `1` e apontam
  `subject-empty`/`type-empty`.
- `bun run lint:commit` valida o `.git/COMMIT_EDITMSG`; o commit inicial
  (`Initial commit from create-turbo`) falha como esperado, por ser anterior à regra.
- `bun run lint` e `bun run types:check` passam.
- Nenhum commit criado; alterações permanecem no working tree.

Observação: ao testar o hook manualmente com um caminho **absoluto** do Windows, o Lefthook
remove as barras invertidas e o arquivo não é encontrado. O Git passa o caminho relativo
(`.git/COMMIT_EDITMSG`), que funciona — o teste com caminho relativo confirmou o comportamento
real.
