# Plano — Skill breakdown-specs

> **Status:** done
> **Atualizado em:** 2026-11-09

## 1. Contexto e problema

O projeto já tem `feature-concept` (descoberta), `create-spec` (uma spec), `refine-spec`
(refinamento) e `implement-me` (execução). Falta uma etapa para pedidos grandes: um prompt que
descreve um épico inteiro (autenticação, CRUD de produtos e usuários) não cabe em uma única spec
executável. Hoje o agente teria que decompor manualmente, com risco de criar uma spec gigante,
specs por camada técnica ou fatias que não podem ser implementadas sozinhas.

## 2. Objetivo e critérios de aceite

Criar a skill `breakdown-specs`, que recebe um prompt/épico e entrega:

- Um mapa de breakdown em `.plans/<numero>-<epic-slug>-breakdown.md`, com resultado do épico,
  fora de escopo, fatias ordenadas, dependências e decisões abertas.
- Várias specs pequenas em `.specs/<numero>-<slug>.md`, criadas com `create-spec`, numeradas em
  ordem de dependência e com status `draft`.
- Fatias verticais: cada spec entrega uma capacidade observável e pode ser implementada por uma
  execução de `implement-me`.

Critérios de aceite:

- [ ] Dado um prompt de autenticação, quando a skill roda, então produz um mapa e specs separadas
      para sign-up, confirmação, sign-in e recuperação de senha, com dependências explícitas.
- [ ] Dado um prompt com produtos e usuários, quando a skill roda, então separa os épicos e não
      mistura as entidades em uma spec única.
- [ ] Dado um mapa gerado, quando o usuário o lê, então consegue identificar a primeira spec a
      implementar sem abrir as demais.
- [ ] Nenhuma spec criada contém detalhes de implementação, plano de execução ou código.

## 3. Escopo

### Dentro

- Criar `.agents/skills/breakdown-specs/SKILL.md`.
- Definir o template do mapa de breakdown, heurísticas de fatiamento, ordenação e validação.
- Referenciar a skill em `.docs/AGENTS.md`, `.docs/RULES.md` e `.specs/README.md`.

### Fora

- Implementar features de negócio.
- Alterar `create-spec`, `refine-spec` ou `implement-me`.
- Criar specs reais de autenticação, produtos ou usuários.
- Versionar `.agents/` (permanece no `.gitignore`).

## 4. Abordagem técnica

- Seguir o formato das skills locais existentes: frontmatter com `name`, `description`,
  `user-invocable` e `argument-hint`; corpo em PT-BR com fases obrigatórias, guardrails e
  anti-padrões.
- A skill **orquestra** `create-spec` em vez de duplicar as regras do template. O contexto é
  absorvido uma vez e reaproveitado entre as specs.
- O mapa fica em `.plans/` com o número da primeira spec do épico. O sufixo `-breakdown` evita
  colisão com `.plans/<numero>-<slug>-plan.md`.
- A numeração das specs é sequencial e única, atribuída em ordem de dependência. Dependências só
  apontam para specs anteriores; ciclos são resolvidos antes de escrever.

## 5. Arquivos e áreas afetadas

- `.agents/skills/breakdown-specs/SKILL.md` (novo)
- `.plans/breakdown-specs-plan.md` (novo)
- `.docs/AGENTS.md` (referência na ordem de trabalho e na lista de skills)
- `.docs/RULES.md` (referência no planejamento obrigatório)
- `.specs/README.md` (referência na convenção)

## 6. Passos de implementação

- [x] Fechar as decisões de design com o usuário (mapa + todas as specs, mapa em `.plans/`,
      fatias verticais).
- [x] Criar este plano.
- [x] Escrever `.agents/skills/breakdown-specs/SKILL.md`.
- [x] Atualizar `.docs/AGENTS.md`, `.docs/RULES.md` e `.specs/README.md`.
- [x] Validar a skill com os exemplos de autenticação e CRUD, conferindo que o fluxo produz
      fatias independentes e ordenadas.
- [x] Revisar links, acentuação e consistência com as skills existentes.

## 7. Riscos e mitigação

| Risco                                     | Mitigação                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Specs por camada técnica (API, UI, banco) | Heurística explícita de fatia vertical e anti-padrões                      |
| Specs que só funcionam depois de outra    | Dependências declaradas e regra de que toda fatia entrega valor observável |
| Uma spec gigante disfarçada de épico      | Limite de tamanho e sinal de "precisa de mais de um implement-me"          |
| Duplicação de regras do `create-spec`     | A skill referencia e segue o `create-spec`; não copia o template           |
| Numeração colidindo com specs existentes  | Ler `.specs/`, usar o próximo número livre e nunca reutilizar              |
| Mapa e specs divergirem                   | Fase de validação de consistência antes da entrega                         |

## 8. Plano de testes e QA manual

- Simular o prompt: "autenticação com sign-up, sign-in, confirmação de conta e recuperação de
  senha" e conferir o mapa e as fatias.
- Simular o prompt: "CRUD de produtos e de usuários" e conferir a separação de épicos.
- Conferir que cada spec criada segue `.specs/_template.md` e não contém implementação.
- Conferir que o mapa aponta para os caminhos reais e que as dependências formam um DAG.
- Conferir que nenhuma skill existente foi alterada.

Validação realizada: revisão estática do fluxo, dos exemplos e da consistência com
`create-spec`; frontmatter e cercas de código validados pelo Prettier. A primeira execução real
da skill deve ser tratada como smoke test do breakdown.

Pendência de acompanhamento: executar `breakdown-specs` com o prompt de autenticação e conferir
as specs geradas antes de considerar o comportamento validado em uso real.
