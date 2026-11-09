---
description: Analisa as mudanças pendentes, cria um commit Conventional Commits com opencode como co-author e faz push
---

# Commit and push

Execute o fluxo abaixo **nesta ordem**. Não pule etapas. Se qualquer verificação falhar, pare,
explique o problema e peça decisão — nunca contorne com `--no-verify` ou `--force`.

Se o usuário informar texto adicional ao chamar o comando, use-o apenas como contexto para a
mensagem; não o copie literalmente.

## 1. Inspecionar o estado atual

Rode:

- `git status --short --branch`
- `git diff --stat`
- `git diff` (mudanças não staged)
- `git diff --staged` (mudanças já staged)
- `git log -5 --oneline` (para seguir o estilo do histórico)
- `git branch --show-current`
- `git remote -v`

Interprete o **diff completo**, não apenas os nomes dos arquivos. Antes de continuar:

- Se `git status --porcelain` estiver vazio e não houver nada para enviar, informe que não há
  mudanças e **pare**.
- Se não houver mudanças mas a branch estiver à frente do upstream, vá direto para a etapa 4.
- **Pare** se aparecer segredo ou algo que não deve ser versionado: `.env` e variantes, chaves,
  tokens, credenciais, `node_modules`, `.next`, `.turbo`, `dist`, `coverage`, `test-results`,
  `playwright-report`, arquivos grandes ou binários inesperados. Nunca use `git add -f`.
- **Pare e peça confirmação** se o diff misturar mudanças independentes que deveriam virar
  commits separados.

## 2. Gerar a mensagem

Siga Conventional Commits:

```text
<tipo>(<escopo opcional>): <resumo no imperativo, em inglês>
```

- Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`.
- Resumo com até 100 caracteres, minúsculo, sem ponto final.
- Escolha o tipo pelo efeito dominante do diff. Use escopo curto quando ajudar (`api`, `web`,
  `ui`, `docs`, `infra`, `tooling`); omita quando o diff for transversal.
- Corpo opcional em inglês, com bullets do que mudou e por quê, linhas com até 100 caracteres.
- O rodapé é obrigatório e separado do corpo por uma linha em branco:

```text
Co-authored-by: OpenCode Agent <noreply@opencode.ai>
```

Não liste caminhos de arquivos no resumo. Descreva o comportamento entregue.

## 3. Stage e commit

1. `git add -A` (sem `-f`).
2. `git status --short` para confirmar que apenas os arquivos esperados estão staged.
3. Crie o commit com subject, corpo (quando houver) e o trailer:

```sh
git commit -m "<subject>" -m "<corpo>" -m "Co-authored-by: OpenCode Agent <noreply@opencode.ai>"
```

O hook `commit-msg` valida a mensagem com o commitlint. Se ele falhar, **corrija a mensagem** e
repita o commit. Se o hook `pre-commit` falhar, corrija o problema indicado. Não use
`--no-verify` em nenhuma hipótese.

## 4. Push

1. `git push`.
2. Se a branch ainda não tiver upstream, use `git push -u origin <branch>`.
3. Nunca use `--force` ou `--force-with-lease` e nunca reescreva histórico.
4. Se o push for rejeitado, **pare** e informe o motivo. Não faça merge, rebase ou reset
   automático.

## 5. Reportar

Informe:

- Hash curto do commit e branch publicada.
- Resumo do que foi commitado (tipo, escopo e principais mudanças).
- Confirmação de que o push terminou, com o remote/URL quando disponível.
- Qualquer arquivo deixado de fora e o motivo.
