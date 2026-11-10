---
name: create-spec
description: Cria uma spec refinada em .specs a partir de um prompt, ideia, ticket ou user story. Lê o contexto do projeto, aplica o template .specs/_template.md e preenche problema, escopo, fluxos, critérios de aceite e decisões abertas sem inventar requisitos. Use sempre que o usuário pedir para "criar uma spec", "gerar spec", "escrever a spec de X", "transformar isso em spec", "documentar a feature" ou entregar uma ideia que precise virar spec executável.
user-invocable: true
metadata:
  argument-hint: <prompt-ou-nome-da-feature>
---

# Create Spec

Transforme um prompt em uma **spec executável e refinada** em `.specs/`. O resultado descreve
**o quê** e **por quê**; o **como** pertence ao plano.

## Quando usar

- O usuário descreve uma feature, fluxo, integração ou melhoria e quer uma spec.
- Existe um ticket, user story, conversa ou rascunho que precisa virar spec.
- A spec ainda não existe em `.specs/`.
- O usuário pede explicitamente `create-spec`.

## Quando não usar

- A spec já existe: use `refine-spec` para não sobrescrever trabalho anterior.
- A ideia está vaga a ponto de não se saber qual problema resolver: use `feature-concept`.
- O usuário quer implementar: use `implement-me`.
- A tarefa é operacional ou trivial.

---

## Entrada

Aceite qualquer um dos formatos:

- Prompt livre: "quero uma tela para conectar Notion..."
- Nome + descrição: "spec de onboarding de experts — ..."
- Ticket ou user story colado no chat.
- Nome ou caminho de uma feature existente, apenas para conferir se a spec já existe.

Se o prompt não tiver um nome, derive um slug claro em kebab-case a partir do problema ou da
feature. Se houver mais de uma feature no mesmo prompt, separe em specs distintas ou peça
priorização.

---

## Fluxo obrigatório

### Fase 0 — Absorver contexto

1. Leia `.docs/AGENTS.md`, `.docs/BUSINESS.md` e `.docs/ARCHITECTURE.md`.
2. Leia `.docs/DEVELOPMENT.md`, `.docs/DESIGN.md`, `.docs/DESIGN_SYSTEM.md` e `.docs/QA.md`
   conforme o tipo de feature.
3. Leia `.specs/README.md` e `.specs/_template.md`.
4. Verifique no código, `package.json`, `turbo.json` e árvore de diretórios o que já existe.
5. Procure specs relacionadas em `.specs/` para evitar duplicidade e reutilizar decisões.

Não assuma que uma biblioteca, app, pasta ou integração existe. Confirme.

### Fase 1 — Extrair o conteúdo do prompt

Antes de perguntar, preencha o que o prompt e os docs já respondem:

| Dimensão   | O que extrair                                             |
| ---------- | --------------------------------------------------------- |
| Problema   | dor concreta, hoje e por que agora                        |
| Usuários   | quem usa, papel, frequência e contexto                    |
| Resultado  | comportamento observável que muda                         |
| Métricas   | número ou evento que prova sucesso                        |
| Escopo     | o que entra e o que fica de fora                          |
| Fluxos     | caminho principal e exceções                              |
| Dados      | entradas, saídas, retenção e contratos                    |
| Permissões | quem pode ver, criar, editar e excluir                    |
| NFRs       | latência, volume, custo, acessibilidade e observabilidade |
| Restrições | dependências, prazos, compatibilidade e riscos            |
| Aceite     | cenários verificáveis em "dado X, quando Y, então Z"      |

### Fase 2 — Classificar lacunas

Classifique o que falta:

- **Bloqueante:** muda escopo, usuário, dados, permissão ou critério de aceite. Pergunte.
- **Importante:** melhora a qualidade, mas pode virar decisão aberta com dono. Registre.
- **Cosmética:** redação ou detalhe irrelevante para o MVP. Resolva na escrita.

Não transforme a criação de uma spec em um interrogatório quando o prompt já é suficiente. O
objetivo é entregar uma spec útil, não esgotar todas as perguntas.

### Fase 3 — Perguntar apenas o necessário

Se houver lacuna bloqueante:

1. Faça no máximo 3 perguntas por vez, priorizando as de maior risco.
2. Use o formato de `feature-concept`: pergunta, por que importa, opções e recomendação.
3. Espere a resposta antes de escrever a versão final.
4. Se o usuário disser "decida por mim", decida, explique o trade-off e registre.
5. Se a ideia estiver vaga demais, carregue `.agents/skills/feature-concept/SKILL.md` e conduza
   a entrevista antes de voltar para a escrita.

Nunca invente regra de negócio, permissão ou número de sucesso para preencher silêncio.

### Fase 4 — Escrever a spec

1. Resolva o caminho: `.specs/<numero>-<slug>.md`, com 3 dígitos e o próximo número livre.
   - Liste `.specs/` para encontrar o maior número existente e use o próximo.
   - `000` é reservado para a fundação; as features começam em `001`.
   - Não reutilize um número já existente.
2. Se o arquivo já existir, **não sobrescreva**. Avise e use `refine-spec`.
3. Copie a estrutura de `.specs/_template.md`.
4. Preencha com o conteúdo extraído, removendo comentários e placeholders.
5. Use `status: draft` por padrão. Só use `approved` se o usuário aprovar explicitamente.
6. Atualize a data em `Atualizado em`.
7. Omita seções vazias em features pequenas; não deixe `TODO` sem dono.
8. Registre decisões abertas na seção 15, com impacto e dono.

Regras de escrita:

- Critérios de aceite no formato "dado X, quando Y, então Z".
- Nada de arquivos, classes, bibliotecas ou passos de implementação; isso é plano.
- Prefira exemplos concretos a adjetivos vagos.
- Se uma seção não se aplica, escreva "Não aplicável" com o motivo.
- Mantenha o texto em PT-BR e identificadores em inglês.

### Fase 5 — Validar

Antes de entregar, confira:

- [ ] Problema, usuário e resultado estão claros.
- [ ] Escopo dentro/fora está explícito.
- [ ] Fluxo principal e exceções estão descritos.
- [ ] Dados, contratos e retenção estão definidos ou marcados como abertos.
- [ ] Permissões e isolamento estão definidos ou marcados como abertos.
- [ ] Requisitos não funcionais são mensuráveis.
- [ ] Critérios de aceite são testáveis.
- [ ] Dependências e riscos têm dono.
- [ ] Não há decisão aberta bloqueante sem aviso.
- [ ] Nenhum detalhe de implementação vazou para a spec.

Checklist completo em `.specs/README.md#definition-of-ready`.

### Fase 6 — Entregar

Responda com:

- Caminho da spec criada.
- Resumo em 3–5 linhas do problema e do resultado.
- Lacunas que viraram decisão aberta e quem precisa decidir.
- Próximo passo recomendado: `refine-spec`, se ainda houver lacunas, ou `implement-me`.

Não crie plano, não implemente código e não faça commit sem pedido explícito.

---

## Guardrails

- Spec é fonte do **o quê**; plano é fonte do **como**.
- Não duplique conteúdo de `.docs`; referencie o documento dono.
- Não trate um plano como spec nem uma spec como plano.
- Não crie uma spec para algo que já existe sem confirmar duplicidade.
- Não avance para `approved` sem aprovação explícita.
- Se o pedido violar `.docs/RULES.md`, pare e explique.

---

## Anti-padrões

- Despejar 20 perguntas antes de ler o prompt e os docs.
- Inventar requisitos, métricas ou permissões.
- Escrever solução técnica antes do problema.
- Deixar critérios de aceite vagos ("deve funcionar bem").
- Criar uma spec gigante para uma feature pequena.
- Sobrescrever uma spec existente sem ler.
