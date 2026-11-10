---
name: feature-concept
description: Conduz uma entrevista profunda e implacável de requisitos para transformar uma ideia vaga em requisitos claros e executáveis. Use quando o usuário pedir para criar uma feature, produto ou fluxo, "feature-concept", "grill-me", "me entreviste", "faça perguntas", "discovery", ou quando a ideia/spec estiver vaga demais para ser escrita. Não implementa código: faz perguntas, resolve contradições e prepara o conteúdo para `create-spec` ou `refine-spec`.
user-invocable: true
metadata:
  argument-hint: <ideia-ou-problema>
---

# Feature Concept

Transforme uma ideia em uma **spec executável**, não em uma lista de desejos. O objetivo é
eliminar ambiguidade antes de qualquer código, fazendo perguntas duras e registrando decisões.

## Quando usar

- O usuário quer criar uma feature, produto, fluxo ou integração.
- Existe uma ideia vaga ("melhorar o onboarding", "criar um dashboard").
- Uma spec existente tem lacunas de descoberta (problema, usuário, escopo) que exigem entrevista.
- Antes de `create-spec` ou `refine-spec`, quando a ideia ainda está vaga.

## Quando não usar

- A spec já está aprovada, completa e sem lacunas.
- A spec só precisa de ajustes de completude, consistência ou redação: use `refine-spec`.
- A tarefa é puramente operacional (rodar um comando, corrigir um typo).
- O usuário quer implementação imediata de algo já especificado.

---

## Princípios

1. **Profundidade antes de velocidade.** Uma pergunta boa economiza horas de retrabalho.
2. **Uma pergunta por vez.** Não despeje um questionário de 20 itens. Pergunte, ouça, aprofunde.
3. **Sempre tenha uma recomendação.** Não pergunte "o que você prefere?" sem oferecer opções e
   dizer qual você recomenda e por quê.
4. **Desafie a vagueza.** "Rápido", "simples", "melhor" e "todos" não são requisitos.
5. **Use o contexto do projeto.** Leia `.docs` e o código antes de perguntar o que já está escrito.
6. **Registre decisões.** Toda resposta relevante entra na spec, inclusive as rejeitadas.
7. **Não invente produto.** Se o usuário não decidiu, marque como decisão aberta com dono.
8. **Não implemente.** Esta skill termina em requisitos claros; a escrita da spec fica com
   `create-spec` ou `refine-spec`.

---

## Fluxo

### Fase 0 — Absorver contexto

Antes da primeira pergunta:

1. Leia `.docs/AGENTS.md`.
2. Leia `.docs/BUSINESS.md` (produto e conceitos).
3. Leia `.docs/ARCHITECTURE.md` (restrições técnicas).
4. Leia `.docs/DEVELOPMENT.md`, `.docs/DESIGN.md`, `.docs/DESIGN_SYSTEM.md` e `.docs/QA.md`
   conforme o tipo de feature.
5. Leia a spec/ideia existente e o código diretamente relacionado.
6. Verifique `package.json`, `turbo.json` e a árvore de diretórios para não assumir que algo
   existe.

Se a ideia vier sem contexto, identifique: **qual problema**, **para quem**, **por que agora**.

### Fase 1 — Enquadrar o problema

Comece pelas perguntas de maior risco. Não avance para solução antes de entender o problema.

Perguntas de abertura (uma por vez):

1. "Qual dor concreta isso resolve? Quem sente essa dor hoje?"
2. "Como esse problema é resolvido hoje? Qual é o custo de não resolver?"
3. "O que muda no comportamento do usuário quando isso existir?"
4. "Como saberemos, com número ou evento observável, que funcionou?"
5. "O que está explicitamente fora do escopo?"

### Fase 2 — Interrogatório

Percorra as dimensões abaixo, adaptando a profundidade ao risco da feature. Para cada resposta,
procure a segunda ordem: "e se...?", "quem pode...?", "o que acontece quando falha?".

| Dimensão        | Pergunta de exemplo                                                             | Por que importa                   |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Problema        | "Qual é o problema, em uma frase, sem citar a solução?"                         | Evita solução procurando problema |
| Evidência       | "Que sinal mostra que isso é prioridade agora?"                                 | Evita feature de opinião          |
| Usuário         | "Quem usa, com que frequência e em qual contexto?"                              | Define fluxo e permissões         |
| Resultado       | "O que o usuário consegue fazer que não conseguia antes?"                       | Define valor real                 |
| Métrica         | "Qual número deve mudar, de quanto para quanto, em quanto tempo?"               | Torna sucesso verificável         |
| Escopo          | "Quais são as 3 coisas que NÃO faremos nesta versão?"                           | Protege o prazo                   |
| Fluxo           | "Descreva o caminho do início ao fim, incluindo o que acontece antes e depois." | Expõe etapas esquecidas           |
| Estados         | "O que aparece enquanto carrega, quando não há dados e quando dá erro?"         | Evita UI incompleta               |
| Dados           | "Quais dados entram, saem, são armazenados e por quanto tempo?"                 | Define modelo e privacidade       |
| Contratos       | "Quem consome isso? Qual o formato de entrada e saída?"                         | Evita retrabalho de API           |
| Permissões      | "Quem pode ver, criar, editar e excluir? Existe isolamento por workspace?"      | Segurança e multi-tenancy         |
| Falhas          | "O que acontece se a fonte externa cair, demorar ou retornar dados sujos?"      | Resiliência                       |
| Volume          | "Qual o volume inicial e o esperado em 6 meses?"                                | Performance e custo               |
| NFR             | "Qual latência, custo, acessibilidade e observabilidade são inegociáveis?"      | Requisitos não funcionais         |
| Compatibilidade | "Existe dado, contrato ou cliente antigo que precisa continuar funcionando?"    | Migração                          |
| Operação        | "Como vamos monitorar, alertar e reverter?"                                     | Produção                          |
| Teste           | "Qual cenário prova que está pronto? Quem valida?"                              | Critério de aceite                |
| Risco           | "O que pode dar errado? Qual o plano B?"                                        | Decisão consciente                |

### Fase 3 — Fechar lacunas

Antes de escrever a spec, confirme:

- Todos os atores e permissões estão claros.
- O fluxo feliz e os fluxos de exceção estão descritos.
- Dados, contratos e retenção estão definidos.
- Requisitos não funcionais são mensuráveis.
- Critérios de aceite são testáveis.
- Dependências e riscos têm dono.
- Não há contradição com `.docs` ou com o código atual.

Se alguma resposta for "não sei", não a ignore: registre como **decisão aberta**, com impacto e
quem precisa decidir. Se bloquear a implementação, diga isso explicitamente.

---

## Como perguntar

Use este formato:

```md
**Pergunta:** <pergunta direta>

Por que importa: <impacto na execução>

Opções:

- A) <opção> — <trade-off>
- B) <opção> — <trade-off>
- C) Não sei ainda — registramos como decisão aberta

Recomendação: <A ou B>, porque <motivo>.
```

Regras:

- Uma pergunta por mensagem; no máximo 3 se forem fortemente relacionadas.
- Espere a resposta antes de avançar.
- Se o usuário responder de forma vaga, reformule com um exemplo concreto.
- Se o usuário disser "decida por mim", decida, explique o trade-off e registre.
- Não repita perguntas já respondidas na spec.
- Não faça perguntas cuja resposta está nos docs; cite o doc em vez disso.

---

## Desafios de vagueza

| Resposta vaga | Contra-pergunta                                          |
| ------------- | -------------------------------------------------------- |
| "Rápido"      | "Qual p95? Em qual operação? Medido onde?"               |
| "Simples"     | "Qual é o fluxo mínimo? O que fica de fora?"             |
| "Melhor"      | "De X para Y. Como medimos a melhora?"                   |
| "Todos"       | "Quais 3 primeiros? Qual a ordem e por quê?"             |
| "Depois"      | "Isso bloqueia o MVP? Se sim, não é depois."             |
| "Usuário"     | "Qual usuário? Qual papel? Qual permissão?"              |
| "Integração"  | "Qual fonte? Qual evento? Qual frequência? Qual falha?"  |
| "Seguro"      | "Seguro contra qual ameaça? Qual o impacto se falhar?"   |
| "Escalável"   | "Qual volume hoje e em 6 meses? Qual o custo aceitável?" |

---

## Template da spec

A spec é salva em `.specs/<numero>-<slug>.md` e segue o template canônico em
[`.specs/_template.md`](../../../.specs/_template.md). Use a skill `create-spec` para criar o
arquivo e `refine-spec` para fechar lacunas. Esta skill termina quando os requisitos estão
claros; a escrita/atualização do arquivo deve usar o template, sem duplicar a estrutura aqui.

Regras do template:

- Critérios de aceite devem ser verificáveis, no formato "dado X, quando Y, então Z".
- Decisões abertas devem ter impacto e dono.
- Não inclua detalhes de implementação que pertencem ao plano.
- Se a feature for pequena, omita seções vazias; não invente conteúdo.

---

## Definition of Ready

A spec só está pronta para `implement-me` quando atende ao checklist em
[`.specs/README.md#definition-of-ready`](../../../.specs/README.md#definition-of-ready).

Se algum item falhar, continue o interrogatório. Não entregue uma spec "quase pronta".

---

## Anti-padrões

- Fazer 20 perguntas de uma vez e sobrecarregar o usuário.
- Aceitar "sim" sem entender o que está sendo aprovado.
- Escrever solução antes de entender o problema.
- Inventar requisitos para preencher silêncios.
- Ignorar restrições de `.docs/ARCHITECTURE.md` ou `.docs/BUSINESS.md`.
- Transformar a spec em um documento de implementação.
- Declarar a spec pronta com decisões abertas bloqueantes.
