# Plano — Skill refactor-vertical-slices

> **Spec:** não aplicável (tarefa de processo/arquitetura)
> **Status:** done
> **Atualizado em:** 2026-11-11

## 1. Contexto e problema

A API já adota vertical slices com as camadas `domain`, `application`, `infrastructure` e
`interface` (ADR 0004), mas o padrão ainda não é aplicado de forma uniforme. O caso mais visível
é `apps/api/src/modules/auth/interface/auth.controller.ts`, que concentra sete endpoints em uma
única classe. Isso dilui a responsabilidade de cada fluxo, dificulta testes focados e permite que
regras vazem entre camadas sem que ninguém perceba.

O projeto precisa de uma skill que audite todas as slices, produza um plano de refatoração,
execute o plano preservando comportamento, valide os gates de qualidade, publique a mudança e
abra o PR — com cada fase executada por um subagente separado.

## 2. Objetivo e critérios de aceite

Criar a skill `refactor-vertical-slices`, que:

- [x] Descobre e audita todas as slices de `apps/api/src/modules` (exceto `shared`), apontando
      não conformidades com evidência (`arquivo:linha`), severidade e contrato de comportamento.
- [x] Produz um plano de refatoração em ondas, mapeando cada achado a um passo verificável.
- [x] Aplica o padrão alvo: camadas com dependências para dentro, portas na aplicação/domínio,
      adaptadores na infraestrutura, **um use case por fluxo** e **um request handler por
      endpoint em relação 1:1 com o use case de entrada**.
- [x] Preserva rotas, status, corpos, headers, cookies, rate limits, guards e contratos de erro.
- [x] Orquestra seis subagentes em sequência: auditoria, plano, execução, QA, commit/push e PR.
- [x] Roda `lint`, `types:check`, `test` e `build` antes de commitar; nunca publica gates
      vermelhos.
- [x] Atualiza a documentação arquitetural afetada e registra um ADR quando o padrão de request
      handler ainda não estiver formalizado.
- [x] Entrega relatório final no formato de `.docs/RULES.md#8`.

Critérios de aceite:

- [x] Dado `refactor-vertical-slices all`, quando o repositório está limpo e os gates estão
      verdes, então a skill audita todas as slices e gera os artefatos de auditoria e plano antes
      de tocar em código.
- [x] Dada uma slice com um controller multi-endpoint, quando a refatoração termina, então cada
      endpoint tem sua própria classe `*RequestHandler`, cada handler injeta exatamente um
      `*UseCase` e nenhum `*.controller.ts` multi-endpoint permanece.
- [x] Dado um endpoint existente, quando a refatoração termina, então método, caminho, guards,
      status, corpo, headers, cookies, rate limit e códigos de erro são idênticos aos de antes.
- [x] Dado um gate vermelho, quando o QA termina, então a skill para, reporta a falha e não
      commita nem abre PR.
- [x] Dado um push bem-sucedido, quando a fase 6 termina, então existe um PR aberto (ou o link de
      comparação é entregue quando `gh` não estiver autenticado).

## 3. Escopo

### Dentro

- Criar `.agents/skills/refactor-vertical-slices/SKILL.md`.
- Criar as referências da skill: padrão alvo, checklist de auditoria, briefings dos subagentes e
  template de PR.
- Definir o fluxo de seis subagentes, os artefatos em `.plans/refactor-<escopo>-*.md`, o contrato
  de branch/commit/push e o tratamento de falhas.
- Referenciar a skill em `.docs/AGENTS.md` e `.docs/RULES.md`.

### Fora

- Executar a refatoração real das slices nesta tarefa.
- Alterar controllers, use cases, módulos, testes ou documentação arquitetural de produto.
- Criar ADR do padrão de request handler agora; a skill exige o ADR na primeira execução.
- Instalar dependências ou criar scripts de CI.

## 4. Abordagem técnica

- **Orquestração sequencial:** as seis fases são dependentes; cada subagente lê o artefato da
  fase anterior e grava o seu. O orquestrador não implementa, apenas valida contratos e passa
  adiante.
- **Artefatos duráveis:** auditoria, plano, QA e relatório ficam em `.plans/`, para que um
  subagente com contexto novo consiga continuar sem depender da conversa do orquestrador.
- **Contrato de comportamento:** a auditoria inventaria todos os endpoints e seus contratos
  observáveis; o QA compara o antes/depois. Testes de integração existentes são a rede de
  segurança.
- **Ondas de refatoração:** primeiro mover/extrair sem mudar comportamento, depois dividir use
  cases por fluxo, depois dividir controllers em request handlers, por último limpeza e docs.
- **Publicação segura:** branch dedicada `refactor/<escopo>`, commit Conventional Commits com
  trailer, push sem `--force` e PR via `gh`. Sem gates verdes, não há commit.
- **Documentação na mesma mudança:** a primeira execução cria/atualiza o ADR, `ARCHITECTURE.md`,
  `DEVELOPMENT.md` e o checklist de QA para refletir o padrão de request handler 1:1.

## 5. Arquivos e áreas afetados

- `.agents/skills/refactor-vertical-slices/SKILL.md` (novo)
- `.agents/skills/refactor-vertical-slices/references/target-pattern.md` (novo)
- `.agents/skills/refactor-vertical-slices/references/audit-checklist.md` (novo)
- `.agents/skills/refactor-vertical-slices/references/subagent-briefings.md` (novo)
- `.agents/skills/refactor-vertical-slices/references/pr-template.md` (novo)
- `.plans/refactor-vertical-slices-skill-plan.md` (novo)
- `.docs/AGENTS.md`
- `.docs/RULES.md`

## 6. Passos de implementação

- [x] Criar este plano.
- [x] Escrever o `SKILL.md` com as fases 0-6, contrato 1:1, artefatos e guardrails.
- [x] Escrever `references/target-pattern.md` com a árvore alvo, exemplos NestJS e receita de
      migração.
- [x] Escrever `references/audit-checklist.md` com severidades, inventário de comportamento e
      formato de achado.
- [x] Escrever `references/subagent-briefings.md` com os seis briefings e os contratos de saída.
- [x] Escrever `references/pr-template.md`.
- [x] Atualizar `.docs/AGENTS.md` e `.docs/RULES.md`.
- [x] Validar a skill contra as slices reais (`auth`, `hello`, `shared`) e rodar Prettier.

## 7. Riscos e mitigação

| Risco                                              | Mitigação                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Subagente alterar comportamento sem perceber       | Inventário de contrato na auditoria + QA comparativo + testes de integração |
| Subagente commitar antes da hora                   | Briefings proíbem commit nas fases 1-4; orquestrador valida `git log`       |
| Refatoração virar big bang e quebrar tudo          | Plano em ondas pequenas, com teste direcionado por passo                    |
| QA verde por testes enfraquecidos                  | QA não pode remover asserções; revisa o diff dos testes                     |
| Branch/PR misturar mudanças não relacionadas       | Exigir working tree limpo e branch dedicada; parar se houver sujeira        |
| Skill não encontrar slices fora do padrão          | Checklist explícito e evidência obrigatória `arquivo:linha`                 |
| Duplicar regras do `implement-me`/`orchestrate-me` | A skill tem fluxo próprio de refatoração e referencia os docs existentes    |
| PR aberto com gates vermelhos                      | Fase 5 só roda depois de `QA_RESULT: ok`; falha para o fluxo                |

## 8. Plano de testes e QA manual

- Validar o frontmatter e os caminhos relativos da skill.
- Conferir que o checklist de auditoria encontra o `auth.controller.ts` (7 endpoints) e o
  `hello.controller.ts` (1 endpoint, nome fora do padrão) no estado atual.
- Conferir que o contrato 1:1 está explícito no `SKILL.md` e no `target-pattern.md`.
- Conferir que os seis briefings têm entradas, saídas e proibições claras.
- Rodar Prettier nos arquivos criados/alterados.
- Verificar que nenhum código de produto foi alterado.

## 9. QA manual

```md
1. Ação: abrir `.agents/skills/refactor-vertical-slices/SKILL.md`
   Esperado: frontmatter válido, fases 0-6, contrato 1:1, artefatos e guardrails.
   Resultado: ok — 450 linhas, frontmatter válido, fases 0-6 e contrato 1:1 presentes.

2. Ação: abrir `references/audit-checklist.md` e aplicá-lo mentalmente ao slice `auth`
   Esperado: o controller multi-endpoint é blocker; o `hello.controller.ts` é finding menor de
   nomenclatura; `shared` é isento.
   Resultado: ok — `auth.controller.ts` tem 7 rotas em uma classe (blocker); `hello.controller.ts`
   tem 1 rota e sufixo `Controller` (minor); `shared` está listado como isento.

3. Ação: conferir as menções à skill em `.docs/AGENTS.md` e `.docs/RULES.md`
   Esperado: referência consistente com o papel da skill.
   Resultado: ok — `AGENTS.md` §4 e `RULES.md` §1 apontam para `refactor-vertical-slices`.
```

## 10. Rollout e rollback

Mudança apenas de skill e documentação de processo. Rollback consiste em remover a pasta da skill,
este plano e as menções em `.docs/AGENTS.md` e `.docs/RULES.md`.
