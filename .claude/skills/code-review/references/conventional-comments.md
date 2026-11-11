# Conventional Comments — como usamos

Formato:

```text
<label> [decorations]: <subject>

[discussion]
```

Publicado no GitHub como `**label (decoração, decoração):** subject` + discussão.
Referência: <https://conventionalcomments.org>.

## Labels

| Label        | Quando usar                                                               | Bloqueia? |
| ------------ | ------------------------------------------------------------------------- | --------- |
| `praise`     | Destaque genuíno e específico de algo bem feito                           | Não       |
| `nitpick`    | Preferência trivial de estilo/nome                                        | Não       |
| `suggestion` | Proposta de melhoria com caminho concreto                                 | Não¹      |
| `issue`      | Problema real: bug, regressão, segurança, violação de regra/ADR, a11y     | **Sim**   |
| `todo`       | Item pequeno e necessário, mas trivial (ex.: renomear, remover `console`) | Não¹      |
| `question`   | Dúvida real; você não tem certeza de que é problema                       | Não       |
| `thought`    | Ideia para o futuro, sem ação neste PR                                    | Não       |
| `chore`      | Tarefa de processo (rodar script, atualizar doc/lockfile)                 | Não¹      |
| `note`       | Informação que o autor deve saber, sem ação                               | Não       |

¹ Torna-se bloqueante se receber a decoração `(blocking)`.

## Decorações

- `blocking` — impede o merge. Combine com qualquer label (ex.: `suggestion (blocking)`).
- `non-blocking` — explicita que não impede o merge.
- `if-minor` — "só se for pequeno/fácil de ajustar".
- Área (usada por este projeto para triagem): `standards`, `performance`, `bug`, `readability`,
  `a11y`, `i18n`, `tests`, `security`, `architecture`, `docs`, `deps`, `observability`, `db`.

Exemplos: `issue (blocking, security)`, `suggestion (non-blocking, performance)`,
`nitpick (non-blocking, readability)`, `question (tests)`.

## Regra de veredito (decisão do projeto)

A review **nunca é neutra**. O veredito é determinístico:

- Existe ao menos um comentário `issue` **ou** com decoração `blocking` → **REQUEST_CHANGES**.
- Caso contrário → **APPROVE** (os comentários não bloqueantes continuam registrados).

`issue` é sempre tratado como bloqueante, mesmo sem a decoração explícita.

## Boas práticas

- Um comentário = uma ideia. Assunto curto (≤ ~80 caracteres), detalhe na discussão.
- Diga o **impacto** ("quebra X quando Y"), não só a regra.
- Prefira `question` a `issue` quando não conseguiu confirmar o problema.
- Para correções pequenas e certas, use bloco `suggestion` do GitHub (substitui as linhas
  comentadas):

````text
```suggestion
const total = items.reduce((sum, item) => sum + item.price, 0);
```
````

- Elogie com `praise` apenas o que é genuíno e específico.
- Ancore o comentário na linha do diff que causa o problema.
