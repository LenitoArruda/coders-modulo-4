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
- Para executar um range de specs aprovadas de uma vez (ex.: `001-010`), use `orchestrate-me`:
  um subagente por spec em worktree isolado, em paralelo, com ondas de dependência e integração
  por onda.
- Para um épico ou prompt com várias features, use `breakdown-specs` antes de `create-spec`:
  ele gera o mapa em `.plans/<numero>-<epic-slug>-breakdown.md` e as specs em ordem de
  dependência.
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

---

## Índice navegável

Todas as specs abaixo têm `Status: done`. A coluna **Documento** aponta para o documento dono do
assunto; a coluna **QA** aponta para a evidência datada quando ela existe (caso contrário, o
histórico fica no próprio plano).

| Spec                                                                  | Plano                                                     | Documento                                    | QA / evidência                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [000-foundation](./000-foundation.md)                                 | [plano](../.plans/000-foundation-plan.md)                 | [ARCHITECTURE](../.docs/ARCHITECTURE.md)     | §11 do plano                                                                                |
| [001-auth-schema](./001-auth-schema.md)                               | [plano](../.plans/001-auth-schema-plan.md)                | [ARCHITECTURE](../.docs/ARCHITECTURE.md)     | [001-breakdown](../.plans/001-auth-breakdown.md)                                            |
| [002-auth-session](./002-auth-session.md)                             | [plano](../.plans/002-auth-session-plan.md)               | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [003-auth-routes](./003-auth-routes.md)                               | [plano](../.plans/003-auth-routes-plan.md)                | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [004-auth-sign-up](./004-auth-sign-up.md)                             | [plano](../.plans/004-auth-sign-up-plan.md)               | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [005-auth-confirm-account](./005-auth-confirm-account.md)             | [plano](../.plans/005-auth-confirm-account-plan.md)       | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [006-auth-sign-in](./006-auth-sign-in.md)                             | [plano](../.plans/006-auth-sign-in-plan.md)               | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [007-auth-forgot-password](./007-auth-forgot-password.md)             | [plano](../.plans/007-auth-forgot-password-plan.md)       | [README](../README.md)                       | QA manual 2026-11-10 no plano                                                               |
| [008-auth-reset-password](./008-auth-reset-password.md)               | [plano](../.plans/008-auth-reset-password-plan.md)        | [README](../README.md)                       | [002–008](../.plans/002-008-orchestration.md)                                               |
| [009-postgres-nativo](./009-postgres-nativo.md)                       | [plano](../.plans/009-postgres-nativo-plan.md)            | [ADR 0016](../.adrs/0016-postgres-nativo.md) | §11 do plano                                                                                |
| [010-email-provider-by-node-env](./010-email-provider-by-node-env.md) | [plano](../.plans/010-email-provider-by-node-env-plan.md) | [README](../README.md)                       | "Gates automatizados" no plano                                                              |
| [011-ui-redesign](./011-ui-redesign.md)                               | [plano](../.plans/011-ui-redesign-plan.md)                | [DESIGN](../.docs/DESIGN.md)                 | [DESIGN_SYSTEM](../.docs/DESIGN_SYSTEM.md)                                                  |
| [012-expert-chat](./012-expert-chat.md)                               | [plano](../.plans/012-expert-chat-plan.md)                | [AI](../.docs/AI.md)                         | [012–018](../.plans/012-018-orchestration.md)                                               |
| [013-knowledge-files](./013-knowledge-files.md)                       | [plano](../.plans/013-knowledge-files-plan.md)            | [AI](../.docs/AI.md)                         | [QA §11](../.docs/QA.md#11-evidências-da-spec-013-2026-11-18)                               |
| [014-knowledge-url](./014-knowledge-url.md)                           | [plano](../.plans/014-knowledge-url-plan.md)              | [AI](../.docs/AI.md)                         | [QA §12](../.docs/QA.md#12-evidências-da-spec-014-2026-11-18)                               |
| [015-knowledge-media](./015-knowledge-media.md)                       | [plano](../.plans/015-knowledge-media-plan.md)            | [AI](../.docs/AI.md)                         | [QA §13](../.docs/QA.md#13-evidências-da-spec-015-2026-11-18)                               |
| [016-rag-citations](./016-rag-citations.md)                           | [plano](../.plans/016-rag-citations-plan.md)              | [AI](../.docs/AI.md)                         | [QA §15](../.docs/QA.md#15-evidências-da-spec-016-2026-11-18)                               |
| [017-multimedia-deliverables](./017-multimedia-deliverables.md)       | [plano](../.plans/017-multimedia-deliverables-plan.md)    | [AI](../.docs/AI.md)                         | [QA §19](../.docs/QA.md#19-evidências-da-spec-017-2026-11-18)                               |
| [018-langsmith-local](./018-langsmith-local.md)                       | [plano](../.plans/018-langsmith-local-plan.md)            | [OBSERVABILITY](../.docs/OBSERVABILITY.md)   | [QA §18](../.docs/QA.md#18-evidências-da-fatia-018--observabilidade-local-worktree-spec018) |

Índice completo de evidências em [QA.md §21](../.docs/QA.md#21-índice-navegável-spec--plano--evidência).
Refinimentos pendentes das specs de IA estão listados em
[`.docs/AI.md §12`](../.docs/AI.md#12-refinamentos-recomendados-das-specs-de-ia).

### Como registramos divergências

Quando o código evolui e a spec fica desatualizada, **não** sobrescreva a spec: abra o plano da
spec, registre a divergência e use `refine-spec` para atualizar o texto no lugar, preservando a
intenção original. Atualize também o documento dono e este índice na mesma mudança.
