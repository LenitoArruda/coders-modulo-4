# Specs

Esta pasta guarda as **specs de feature** do projeto.

## Convenção

- Um arquivo por feature: `.specs/<numero>-<slug>.md` (ex.: `.specs/000-foundation.md`).
- O número tem **3 dígitos**, com zero à esquerda, é sequencial e único. `000` é reservado para
  a fundação; as próximas specs começam em `001`.
- Use sempre o próximo número livre (maior número existente + 1). Não reutilize números.
- O identificador `<numero>-<slug>` é o mesmo usado no plano:
  `.plans/<numero>-<slug>-plan.md` (ex.: `.plans/000-foundation-plan.md`).
- A spec descreve **o quê** e **por quê**; o plano descreve **como**.
- Crie specs com a skill `create-spec`, refine com `refine-spec` e execute com `implement-me`.
- Use `feature-concept` quando a ideia ainda estiver vaga e precisar de uma entrevista de
  requisitos antes de escrever ou refinar a spec.

## Status

| Status         | Significado                                        |
| -------------- | -------------------------------------------------- |
| `draft`        | Em descoberta; não pode ser implementada           |
| `approved`     | Requisitos fechados; pronta para planejar/executar |
| `implementing` | Em execução                                        |
| `done`         | Entregue e verificada                              |

## Template

Use o template canônico em [`_template.md`](./_template.md). O arquivo começa com `_` para não
ser confundido com uma spec. O nome do arquivo de uma spec segue `<numero>-<slug>.md`; o
template define o conteúdo, não o nome. Omita seções vazias em features pequenas; não invente
conteúdo.

## Definition of Ready

Uma spec só está pronta para `implement-me` quando:

- [ ] Problema, usuário e resultado estão claros.
- [ ] Escopo dentro/fora está explícito.
- [ ] Fluxo principal e exceções estão descritos.
- [ ] Dados, contratos e retenção estão definidos.
- [ ] Permissões e isolamento estão definidos.
- [ ] Requisitos não funcionais são mensuráveis.
- [ ] Critérios de aceite são testáveis.
- [ ] Dependências e riscos têm dono.
- [ ] Não há decisão aberta bloqueante.
- [ ] O usuário aprovou a spec.

Se algum item falhar, continue o refinamento com `refine-spec` ou a descoberta com
`feature-concept`. Não entregue uma spec "quase pronta".

## Regras rápidas

- Critérios de aceite no formato "dado X, quando Y, então Z".
- Toda decisão aberta tem impacto e dono.
- Não inclua detalhes de implementação: eles pertencem ao plano.
- Não trate um plano como spec.
- Não sobrescreva uma spec existente: use `refine-spec`.
