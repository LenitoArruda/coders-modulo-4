# Plano — Skills de spec e template canônico

> Spec: não aplicável (tarefa de processo/documentação)
> Status: done

## 1. Contexto

O projeto já tem `feature-concept` (descoberta de requisitos) e `implement-me` (execução de
spec), mas não tem skills dedicadas a **criar** e **refinar** specs. Além disso,
`.specs/_template.md` está incompleto, com typos e sem as seções necessárias para uma spec
executável.

## 2. Objetivo e critérios de aceite

- [x] Criar `.agents/skills/create-spec/SKILL.md`.
- [x] Criar `.agents/skills/refine-spec/SKILL.md`.
- [x] Reescrever `.specs/_template.md` como template canônico de 15 seções.
- [x] Centralizar o Definition of Ready em `.specs/README.md`.
- [x] Atualizar as referências em `.docs/AGENTS.md`, `.docs/RULES.md`, `.specs/README.md`,
      `feature-concept` e `implement-me`.
- [x] Não alterar código de produto.

## 3. Escopo

### Dentro

- Conteúdo das duas skills.
- Template de spec e convenções da pasta `.specs`.
- Referências cruzadas nos documentos e skills existentes.

### Fora

- Implementar features de produto.
- Executar `implement-me` ou criar planos de execução para features reais.
- Rodar a suíte completa de avaliação da `skill-creator`.

## 4. Abordagem técnica

- Seguir o padrão das skills existentes: `.agents/skills/<name>/SKILL.md` com frontmatter
  `name`, `description`, `user-invocable` e `metadata.argument-hint`.
- Separar responsabilidades:
  - `feature-concept`: descobrir requisitos quando a ideia está vaga.
  - `create-spec`: transformar prompt/ideia em spec usando o template.
  - `refine-spec`: auditar e completar uma spec existente.
  - `implement-me`: executar a spec aprovada.
- Usar `.specs/_template.md` como fonte única da estrutura da spec.
- Usar `.specs/README.md#definition-of-ready` como fonte única do checklist de prontidão.

## 5. Arquivos e áreas afetadas

- `.agents/skills/create-spec/SKILL.md` (novo)
- `.agents/skills/refine-spec/SKILL.md` (novo)
- `.specs/_template.md` (reescrito)
- `.specs/README.md`
- `.docs/AGENTS.md`
- `.docs/RULES.md`
- `.agents/skills/feature-concept/SKILL.md`
- `.agents/skills/implement-me/SKILL.md`

## 6. Passos de implementação

- [x] Criar a skill `create-spec`.
- [x] Criar a skill `refine-spec`.
- [x] Reescrever `.specs/_template.md`.
- [x] Adicionar o Definition of Ready e as novas skills em `.specs/README.md`.
- [x] Atualizar `.docs/AGENTS.md` e `.docs/RULES.md`.
- [x] Alinhar `feature-concept` e `implement-me`.
- [x] Rodar a verificação estática e revisar referências quebradas.

## 7. Riscos e mitigação

- **Sobreposição de gatilhos entre skills:** descrições deixam explícito quando usar cada uma.
- **Duplicação do template:** `feature-concept` passa a apontar para `.specs/_template.md`.
- **Specs existentes quebrarem:** o template é uma evolução; specs antigas podem ser refinadas
  com `refine-spec`.
- **Interrogatório excessivo no `create-spec`:** a skill pergunta apenas lacunas bloqueantes e
  registra o resto como decisão aberta.

## 8. Plano de testes

- Verificar frontmatter e caminhos das skills.
- Buscar referências antigas ao template e às skills.
- Validar que `.specs/_template.md` contém as 15 seções e o cabeçalho.
- Conferir que os links relativos entre `.specs` e `.agents/skills` existem.

## 9. QA manual

```md
1. Ação: abrir `.agents/skills/create-spec/SKILL.md`
   Esperado: frontmatter válido, fluxo de criação e guardrails.
   Resultado: ok

2. Ação: abrir `.agents/skills/refine-spec/SKILL.md`
   Esperado: fluxo de auditoria, atualização in-place e Definition of Ready.
   Resultado: ok

3. Ação: abrir `.specs/_template.md`
   Esperado: template com 15 seções e instruções de uso.
   Resultado: ok

4. Ação: buscar por referências ao template antigo
   Esperado: nenhuma referência apontando para `feature-concept#template-da-spec`.
   Resultado: ok
```

## 10. Rollout e rollback

Sem migração de dados. Rollback consiste em restaurar os arquivos anteriores pelo Git.
