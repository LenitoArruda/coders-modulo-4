# ADR 0011 — ESLint + Prettier com config raiz para lint-staged

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O monorepo precisa de lint e formatação consistentes sem duplicar configuração por app. O
starter já trazia ESLint e Prettier, mas o preset Babel não resolvia e o `lint-staged` rodava
`eslint --fix` na raiz sem um `eslint.config.*` acessível, fazendo o hook `pre-commit` falhar.
As configurações dos workspaces também não declaram `files`, então arquivos TS/TSX passados
explicitamente eram ignorados.

## Decisão

Manter **ESLint 10.9.1 + Prettier 3.9.6** e as configurações compartilhadas `base`, `next-js`
e `react-internal` em `packages/eslint-config`. Para o `lint-staged`:

- Adicionar `eslint` como devDependency da raiz.
- Criar `eslint.config.mjs` na raiz, que aplica cada config compartilhada ao diretório do seu
  workspace e habilita o parsing de JSX no preset Babel.
- Executar `eslint --no-config-lookup --config eslint.config.mjs --fix` no hook, para usar o
  config raiz em vez da busca por diretório do ESLint v10.

OXLint/OXFmt permanecem fora da fundação e seguem em avaliação.

## Consequências

### Positivas

- Hook `pre-commit` funciona sem `--no-verify`.
- Arquivos TS/TSX são efetivamente parseados e lintados no commit.
- Configuração compartilhada continua sendo a fonte das regras.
- Prettier uniformiza código, JSON, CSS, Markdown e YAML.

### Negativas / trade-offs

- O config raiz é uma ponte entre os configs dos workspaces e o `lint-staged`; precisa ser
  mantido quando um workspace ou config mudar.
- ESLint ainda emite avisos de globais (`process`, `console`) em alguns arquivos.
- O hook não usa `--max-warnings 0`, então avisos não bloqueiam o commit.

## Alternativas consideradas

| Alternativa                     | Por que foi descartada                       |
| ------------------------------- | -------------------------------------------- |
| OXLint/OXFmt                    | Migração fora do escopo e ainda em avaliação |
| Biome                           | Troca de ferramenta sem necessidade imediata |
| Lint apenas via `turbo lint`    | Não lintaria os arquivos staged no hook      |
| Remover ESLint do `lint-staged` | Reduziria a proteção do pre-commit           |

## Referências

- [`eslint.config.mjs`](../eslint.config.mjs)
- [`packages/eslint-config/base.js`](../packages/eslint-config/base.js)
- [`package.json`](../package.json)
