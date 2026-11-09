# Plano — Architecture Decision Records (`.adrs`)

> Spec: não aplicável (tarefa de documentação/processo)
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto e problema

As decisões arquiteturais estão concentradas em `.docs/ARCHITECTURE.md` §6–§7, mas não existem
registros individuais com contexto, alternativas e consequências. Sem esse histórico, fica
difícil auditar por que a fundação escolheu determinada stack e como revisar decisões futuras
sem reescrever a documentação principal.

## 2. Objetivo e critérios de aceite

- [x] Criar `.adrs/` com `README.md`, `_template.md` e ADRs das decisões já registradas.
- [x] Cada ADR contém contexto, decisão, consequências, alternativas e referências.
- [x] `.adrs/README.md` mantém um índice com status e links.
- [x] `README.md`, `.docs/AGENTS.md` e `.docs/ARCHITECTURE.md` referenciam `.adrs/`.
- [x] Nenhuma decisão nova é inventada: os registros derivam de `.docs/ARCHITECTURE.md` e
      `.specs/000-foundation.md`.
- [x] Nenhuma dependência ou mudança de código é adicionada.

## 3. Escopo

### Dentro

- Estrutura `.adrs/` com índice, template e ADRs 0001–0011.
- Atualização dos mapas de documentação e da árvore de estrutura.

### Fora

- Mudanças de código, dependências ou pipeline.
- Decisões ainda abertas (deploy, multi-tenancy, `apps/docs`, `packages/shared` etc.), que
  permanecem em `.docs/ARCHITECTURE.md` §7.
- Automação de lint ou validação de ADRs.

## 4. Abordagem técnica

- Formato MADR adaptado, em PT-BR, com arquivos `NNNN-titulo-em-kebab-case.md`.
- Decisões já fechadas recebem status `aceito`; decisões em aberto continuam apenas em
  `ARCHITECTURE.md` §7 até serem tomadas.
- Cada ADR aponta para a fonte original e não duplica a tabela de decisões.

## 5. Arquivos/áreas previstos

- `.adrs/README.md`, `.adrs/_template.md` e `.adrs/000*.md`
- `README.md`
- `.docs/AGENTS.md`
- `.docs/ARCHITECTURE.md`
- `.plans/adrs-plan.md` (este plano)

## 6. Riscos e mitigação

| Risco                            | Mitigação                                                           |
| -------------------------------- | ------------------------------------------------------------------- |
| Divergir de `ARCHITECTURE.md`    | ADRs referenciam a fonte e não alteram a tabela de decisões         |
| ADR virar documentação morta     | Índice + regra de atualização em `.adrs/README.md` e `ARCHITECTURE` |
| Excesso de registros redundantes | Agrupar decisões intimamente relacionadas (ex.: Supabase e LGTM)    |

## 7. Plano de testes e QA manual

1. Conferir que o índice lista todos os arquivos de ADR e que os links relativos resolvem.
2. Conferir que cada ADR tem contexto, decisão, consequências e alternativas.
3. Rodar `bun run format` ou Prettier nos arquivos alterados.
4. Rodar `bun run lint` e `bun run types:check` (não há mudança de código, mas o gate é
   obrigatório).

## 8. Resultado da execução

**Status:** concluído em 2026-11-09.

- Estrutura `.adrs/` criada com índice, template e ADRs 0001–0011.
- `README.md`, `.docs/AGENTS.md` e `.docs/ARCHITECTURE.md` atualizados.
- Nenhuma decisão nova ou mudança de código introduzida.
