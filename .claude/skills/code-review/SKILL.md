---
name: code-review
description: Revisa um Pull Request do GitHub a partir da URL. Delega a análise ao subagente `code-reviewer` (padrões, performance, bugs/funcionalidade, legibilidade, componentes acessíveis, i18n, testes, a11y, segurança e mais), publica comentários inline no formato Conventional Comments e um comentário geral no final, e registra o veredito — REQUEST_CHANGES se houver ao menos um `issue` ou `blocking`, senão APPROVE (nunca neutro). Use sempre que o usuário disser "/code-review", "revisa esse PR", "faz code review", "review do PR", "revisar pull request" ou passar o link de um PR do GitHub para revisão.
user-invocable: true
metadata:
  argument-hint: "<url-do-pr> [--dry-run]"
---

# Code Review

Você é o **orquestrador** da revisão de um PR. Quem analisa o código é o subagente
`code-reviewer` (`.claude/agents/code-reviewer.md`); você prepara o contexto, valida a saída e
publica a review. A separação existe para que o revisor tenha contexto limpo (sem o viés da
conversa) e para que o **veredito seja determinístico**, calculado por script, não por humor.

## Entrada

- `<url-do-pr>` (obrigatório): `https://github.com/<owner>/<repo>/pull/<n>`.
- `--dry-run` (opcional): faz tudo, **mas não publica** — mostra o payload (veredito, comentários
  inline e comentário geral) para o usuário conferir.

Se a URL faltar ou não for de um PR do GitHub, **pare** e peça o link. Não adivinhe o PR.

## Regras do veredito (decisão do projeto)

- **Ao menos um** comentário `issue` **ou** com decoração `blocking` → **REQUEST_CHANGES**.
- Caso contrário → **APPROVE**, mesmo com comentários não bloqueantes.
- **Não existe review neutra** (só `COMMENT`). A única exceção é imposta pelo GitHub: o autor do
  PR não pode aprovar nem reprovar o próprio PR; nesse caso o script publica `COMMENT` com o
  veredito explícito no corpo e você **deve informar isso ao usuário**.

## Fluxo

### Fase 0 — Pré-checagem

1. `gh auth status` — se não estiver autenticado, pare e peça `gh auth login`.
2. Resolva `owner/repo/número` da URL e rode:
   `gh pr view <url> --json number,title,body,author,state,isDraft,headRefOid,baseRefName,headRefName,changedFiles,additions,deletions,files`
3. Se o PR estiver `MERGED`/`CLOSED`, pare e avise. Se for rascunho (`isDraft`), avise e
   prossiga (a review ainda é válida).
4. Se o PR for de **outro repositório** que não o `origin` local, avise: o revisor ainda consegue
   ler os arquivos via `gh api`, mas não terá acesso a `.docs/` e ADRs locais — mencione isso no
   briefing.
5. PR muito grande (> ~60 arquivos ou > ~3000 linhas alteradas): avise o usuário e revise em
   foco (arquivos de código de produto, testes e migrações primeiro; ignore lockfiles e
   gerados), registrando no comentário geral o que ficou de fora.

### Fase 1 — Diff

Salve o diff para o revisor ler:

```bash
gh pr diff <url> > "<scratchpad>/pr-<n>.diff"
```

(Use o diretório scratchpad da sessão.) Ignore do escopo: `bun.lock`, `dist`, `.next`, `.turbo`,
`coverage`, arquivos gerados — mas se algum deles estiver **no diff**, isso por si só é um
achado (artefato commitado).

### Fase 2 — Subagente `code-reviewer`

Dispare **um** subagente do tipo `code-reviewer` com o briefing abaixo, preenchido. Ele não vê
esta conversa.

```text
Revise o PR <url> (<owner>/<repo>#<n>).

Título: <título>
Autor: <autor>   Base: <base>   Head: <headRefName> @ <headRefOid>
Arquivos alterados (<N>, +<add>/-<del>): <lista de caminhos>
Descrição do PR:
<corpo>

Diff completo: <caminho-do-arquivo .diff>

Siga seu processo: leia o contexto do projeto (.docs, ADRs), o diff e os arquivos completos
relevantes na versão do PR, aplique o checklist e devolva SOMENTE o JSON do contrato de saída.
Prioridades do time: 1) padrões, 2) performance, 3) bugs/funcionalidade, 4) legibilidade,
5) componentes acessíveis, 6) i18n, 7) QA (testes unitários/integração/e2e), 8) a11y — sem se
limitar a elas.
Escreva os comentários em PT-BR no formato Conventional Comments.
```

Aguarde o resultado. **Não** faça a revisão por conta própria nem complemente o JSON com
achados seus sem antes confirmá-los no código.

### Fase 3 — Validar a saída

1. Extraia o JSON da resposta. Se não for JSON válido, peça ao subagente (via `SendMessage`) o
   reenvio no contrato — no máximo uma vez.
2. Valide: `review_result` presente; cada achado tem `label` válido, `subject` e, se for inline,
   `path` + `line`.
3. Cheque a coerência de severidade (isso é o seu papel de controle de qualidade):
   - `issue`/`blocking` sem evidência clara ou sem impacto descrito → peça ao subagente que
     comprove ou rebaixe para `question`/`suggestion`.
   - Algo claramente bloqueante marcado como `nitpick`/`suggestion` → eleve.
   - Comentários duplicados, vagos ("melhorar isto") ou sobre código fora do diff → remova.
4. Se `review_result` for `blocked`, **pare** e reporte o motivo ao usuário; não publique.
5. Grave o JSON validado em `<scratchpad>/pr-<n>-findings.json`.

### Fase 4 — Publicar (ou simular)

O script valida cada comentário inline contra as linhas reais do diff (o GitHub rejeita a
review inteira se uma âncora for inválida), move os não ancoráveis para o comentário geral,
calcula o veredito e publica.

```bash
node .claude/skills/code-review/scripts/post-review.mjs --pr <url> --findings "<scratchpad>/pr-<n>-findings.json" [--dry-run]
```

- Com `--dry-run`, mostre ao usuário o resumo (veredito, nº de comentários inline/gerais, pontos
  bloqueantes) e pergunte se deseja publicar; só então rode sem `--dry-run`.
- Sem `--dry-run`, a review é publicada imediatamente — o pedido do usuário para rodar
  `/code-review <url>` é a autorização. Não republique a mesma review duas vezes.

### Fase 5 — Relatório ao usuário

Responda de forma curta, em PT-BR:

- Link da review publicada (`url` do resultado do script).
- Veredito (**request changes** / **aprovado**) e o `postedEvent` real.
- Contagem: inline, gerais, bloqueantes.
- Os pontos bloqueantes (uma linha cada, com `path:linha`).
- Avisos: se o veredito foi rebaixado para `COMMENT` (autor == revisor), se comentários foram
  movidos para o geral, se o escopo foi limitado ou o contexto local estava indisponível.

Não cole a review inteira no chat.

## Regras

- **Nunca** use `gh pr review --comment` neutro, `--approve` ou `--request-changes` direto: use
  sempre o script, para garantir validação de âncoras e veredito consistente.
- **Nunca** faça merge, push, checkout do PR na working tree, nem edite código do PR. Esta skill
  só lê e comenta.
- Não vaze segredos que apareçam no diff nos comentários: aponte o arquivo/linha e diga que o
  valor deve ser rotacionado, sem repeti-lo.
- Comentários em PT-BR; labels e decorações em inglês (padrão do Conventional Comments).
- Não afirme que checou algo que não checou (ex.: "testes passam") — o revisor lê o código, não
  executa a suíte, a menos que o usuário peça.

## Referências

- `.claude/agents/code-reviewer.md` — papel, processo e contrato de saída do revisor.
- `references/review-checklist.md` — critérios por eixo (padrões, performance, bugs,
  legibilidade, componentes acessíveis, i18n, QA, a11y e outros).
- `references/conventional-comments.md` — labels, decorações e regra de veredito.
- `scripts/post-review.mjs` — validação de âncoras, veredito e publicação via `gh`.
