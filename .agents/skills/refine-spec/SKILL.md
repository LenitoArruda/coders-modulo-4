---
name: refine-spec
description: Refina uma spec existente em .specs, auditando contra o template e o Definition of Ready, eliminando ambiguidade, contradições e critérios de aceite vagos. Faz perguntas direcionadas apenas onde há lacuna, atualiza a spec no lugar e preserva a intenção original. Use sempre que o usuário pedir para "refinar a spec", "melhorar a spec", "revisar a spec", "completar a spec", "auditar requisitos", "deixar a spec pronta para implementar" ou apontar uma spec em .specs.
user-invocable: true
metadata:
  argument-hint: <spec-name|path>
---

# Refine Spec

Melhore uma spec existente **sem reescrevê-la do zero**. O objetivo é deixá-la executável,
testável e sem ambiguidade, preservando as decisões que o autor já tomou.

## Quando usar

- A spec existe, mas está `draft`, incompleta ou ambígua.
- Faltam fluxos de exceção, dados, permissões ou critérios de aceite.
- A spec tem contradições com `.docs` ou com o código atual.
- O usuário quer preparar a spec para `implement-me`.
- O usuário pede explicitamente `refine-spec`.

## Quando não usar

- A spec ainda não existe: use `create-spec`.
- A ideia ainda está vaga e falta descobrir o problema: use `feature-concept`.
- O usuário quer implementar: use `implement-me`.
- O usuário quer apenas corrigir um typo: edite diretamente.

---

## Entrada

Aceite um dos formatos:

- Nome: `000-foundation` ou `foundation`
- Caminho: `.specs/000-foundation.md`
- Referência: "refina a spec de fundação"

Se nenhum argumento for informado, pergunte qual spec refinar. Não escolha sozinho.

### Resolver a spec

1. Se o argumento for um caminho existente, use-o.
2. Caso contrário, procure em `.specs/<numero>-<slug>.md`.
3. Se o argumento não tiver número, procure `.specs/*-<slug>.md` e confirme se houver
   exatamente um.
4. Se não existir, procure `<slug>.md` no repositório (ignore `node_modules`, `.next`, `.turbo`,
   `dist`, `coverage`).
5. Se houver exatamente um resultado, confirme com o usuário antes de editar.
6. Se houver zero ou mais de um, pare e peça o caminho correto.

Nunca trate um plano como spec.

---

## Fluxo obrigatório

### Fase 0 — Ler o contexto

1. Leia `.docs/AGENTS.md` e `.docs/RULES.md`.
2. Leia a spec inteira, incluindo decisões já fechadas.
3. Leia `.specs/_template.md` e o Definition of Ready em `.specs/README.md`.
4. Leia `.docs/BUSINESS.md`, `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md` e
   `.docs/DESIGN*.md` conforme o tipo de feature.
5. Leia o código, `package.json`, `turbo.json` e a árvore de diretórios das áreas citadas.
6. Procure specs e planos relacionados para detectar duplicidade ou contradição.

### Fase 1 — Auditar a spec

Percorra as dimensões abaixo e marque cada uma como **ok**, **lacuna** ou **contradição**:

| Dimensão     | O que verificar                                           |
| ------------ | --------------------------------------------------------- |
| Problema     | dor concreta, afetados e por que agora                    |
| Usuários     | papéis, frequência, contexto e permissões                 |
| Resultado    | comportamento observável e valor entregue                 |
| Métricas     | número ou evento, linha de base e meta                    |
| Escopo       | dentro/fora explícitos e priorizados                      |
| Fluxos       | caminho principal, alternativos e falhas                  |
| Regras       | validações, limites, estados vazios e erros               |
| Dados        | entradas, saídas, contratos, retenção e privacidade       |
| Segurança    | autorização, isolamento e dados sensíveis                 |
| NFRs         | latência, volume, custo, acessibilidade e observabilidade |
| Dependências | sistemas, times, credenciais e riscos com dono            |
| Rollout      | feature flag, migração, compatibilidade e rollback        |
| Testes       | cenários unitários, integração, E2E e manual              |
| Aceite       | critérios verificáveis em "dado X, quando Y, então Z"     |
| Decisões     | abertas com impacto/dono e fechadas registradas           |

Também procure:

- Critérios de aceite vagos ("rápido", "simples", "funciona bem").
- Detalhes de implementação que deveriam estar no plano.
- Contradições entre seções da própria spec.
- Contradições com `.docs`, código ou outras specs.
- Seções vazias, `TODO`, placeholders ou "Não aplicável" sem motivo.
- Escopo grande demais para uma única entrega.

### Fase 2 — Classificar e priorizar

Classifique cada achado:

- **Bloqueante:** impede implementar ou testar. Deve ser resolvido antes de `implement-me`.
- **Importante:** não bloqueia, mas gera retrabalho. Pode virar decisão aberta com dono.
- **Cosmético:** redação, formatação ou consistência. Corrija direto.

Priorize os bloqueantes e contradições. Não reescreva o que já está bom.

### Fase 3 — Perguntar apenas o necessário

Para cada lacuna bloqueante:

1. Faça no máximo 3 perguntas por vez, uma de cada vez quando o risco for alto.
2. Use o formato de `feature-concept`: pergunta, por que importa, opções e recomendação.
3. Cite o trecho da spec que gerou a dúvida.
4. Espere a resposta antes de editar a seção afetada.
5. Se o usuário disser "decida por mim", decida, explique o trade-off e registre.
6. Se a spec estiver vaga a ponto de precisar redescobrir o problema, use `feature-concept`
   antes de continuar.

Não faça perguntas cuja resposta está nos docs ou no código.

### Fase 4 — Atualizar a spec

Edite o arquivo original, não crie uma cópia.

Regras:

- Preserve a estrutura, o tom e as decisões já tomadas.
- Corrija apenas as seções afetadas; não reescreva a spec inteira sem necessidade.
- Remova `TODO` e placeholders, substituindo por conteúdo ou decisão aberta com dono.
- Mantenha critérios de aceite no formato "dado X, quando Y, então Z".
- Remova detalhes de implementação; se forem úteis, registre como nota para o plano.
- Atualize a data em `Atualizado em`.
- Não mude o status para `approved` sem aprovação explícita do usuário.
- Se a spec estiver em `implementing` ou `done`, não reabra o escopo sem avisar.

### Fase 5 — Validar

Confira o checklist de `.specs/README.md#definition-of-ready` e também:

- [ ] A spec continua coerente com o problema original.
- [ ] Nenhuma decisão fechada foi apagada ou contradita.
- [ ] Critérios de aceite cobrem o fluxo principal e as exceções.
- [ ] Dados, permissões, NFRs e riscos têm resposta ou dono.
- [ ] Não há decisão aberta bloqueante sem aviso.
- [ ] Nenhum detalhe de implementação vazou para a spec.
- [ ] A data foi atualizada.

### Fase 6 — Reportar

Entregue:

- Caminho da spec atualizada.
- Resumo do que estava faltando e do que foi resolvido.
- Perguntas feitas e decisões registradas.
- Decisões abertas restantes, com impacto e dono.
- Próximo passo recomendado: `implement-me`, `feature-concept` ou `create-spec` (se a spec
  precisar ser refeita).

Não crie plano, não implemente código e não faça commit sem pedido explícito.

---

## Guardrails

- Spec existente é do autor; refine, não substitua.
- Mudança de escopo exige aprovação explícita.
- Não invente requisitos para eliminar uma lacuna.
- Não use a spec para prescrever implementação.
- Não declare a spec pronta com bloqueio aberto.
- Se houver conflito entre spec, docs e código, pare e peça decisão.

---

## Anti-padrões

- Reescrever a spec inteira porque é mais fácil.
- Fazer perguntas já respondidas na spec ou nos docs.
- Aceitar "sim" sem registrar o que foi aprovado.
- Transformar a spec em plano de implementação.
- Aprovar a spec sem o usuário confirmar.
- Ignorar decisões e restrições já registradas.
