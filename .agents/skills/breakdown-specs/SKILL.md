---
name: breakdown-specs
description: Quebra um prompt, épico ou ideia grande em várias specs pequenas e implementáveis uma por vez, usando create-spec. Produz um mapa de breakdown em .plans com ordem de dependência e fatias verticais, depois cria as specs em .specs com numeração sequencial. Use sempre que o usuário pedir para "quebrar em specs", "dividir essa feature", "decompor o épico", "fatiar o escopo", "planejar em etapas", "transformar esse prompt em várias specs" ou quando o pedido descrever várias features juntas (autenticação com sign-up/sign-in/confirmação/recuperação, CRUDs de produtos e usuários) e for grande demais para uma única spec.
user-invocable: true
metadata:
  argument-hint: <prompt-ou-epico>
---

# Breakdown Specs

Transforme um pedido grande em **várias specs pequenas, independentes e implementáveis uma por
vez**. O resultado tem duas partes:

1. Um **mapa de breakdown** em `.plans/<numero>-<epic-slug>-breakdown.md` com o resultado do
   épico, o fora de escopo, a ordem das fatias, as dependências e as decisões abertas.
2. As **specs** em `.specs/<numero>-<slug>.md`, criadas com a skill `create-spec`, numeradas em
   ordem de dependência e com status `draft`.

O objetivo é que o usuário consiga executar `implement-me` em uma spec por vez, sem precisar
implementar o épico inteiro para obter valor.

## Quando usar

- O prompt descreve um épico ou várias features relacionadas.
- O pedido é grande demais para uma única spec executável.
- Exemplos típicos: autenticação (sign-up, confirmação de conta, sign-in, recuperação de senha),
  CRUD de produtos, CRUD de usuários, onboarding, faturamento, notificações.
- O usuário pede explicitamente `breakdown-specs`, "quebrar em specs", "decompor", "fatiar",
  "dividir essa feature" ou "planejar em etapas".
- Uma spec existente cresceu e precisa ser dividida em entregas menores.

## Quando não usar

- Uma única feature cabe em uma spec: use `create-spec`.
- A spec já existe e só precisa ser completada: use `refine-spec`.
- A ideia ainda está vaga e falta descobrir o problema: use `feature-concept` primeiro.
- O usuário quer implementar: use `implement-me`.
- A tarefa é operacional, trivial ou não gera specs.

---

## Entrada

Aceite qualquer um dos formatos:

- Prompt livre: "quero autenticação com sign-up, sign-in, confirmação de conta e recuperação de
  senha".
- Épico nomeado: "breakdown do épico de gestão de usuários".
- Ticket, user story ou conversa colada no chat.
- Caminho de uma spec existente que precisa ser dividida.

Se o prompt não tiver nome, derive um slug do épico em kebab-case. Se houver mais de um épico
independente, trate na Fase 1.

---

## Conceitos

| Conceito                   | Definição                                                                  |
| -------------------------- | -------------------------------------------------------------------------- |
| **Épico**                  | Resultado grande que o usuário quer alcançar. Não vira spec.               |
| **Fatia**                  | Uma spec pequena que entrega uma capacidade observável de ponta a ponta.   |
| **Fundação compartilhada** | Modelo, contrato ou permissão usado por várias fatias. Deve ser explícito. |
| **Dependência**            | Fatia que precisa existir antes de outra. Sempre aponta para trás.         |
| **Mapa**                   | Documento em `.plans/` que registra épico, fatias, ordem e dependências.   |

---

## Fluxo obrigatório

### Fase 0 — Absorver contexto

1. Leia `.docs/AGENTS.md`, `.docs/BUSINESS.md` e `.docs/ARCHITECTURE.md`.
2. Leia `.docs/DEVELOPMENT.md`, `.docs/DESIGN.md`, `.docs/DESIGN_SYSTEM.md` e `.docs/QA.md`
   conforme o tipo de feature.
3. Leia `.specs/README.md` e `.specs/_template.md`.
4. Liste `.specs/` e `.plans/` para saber o maior número existente, as specs já criadas e os
   épicos em andamento.
5. Verifique no código, `package.json`, `turbo.json` e na árvore de diretórios o que já existe.
6. Procure specs relacionadas para evitar duplicidade e reutilizar decisões.

Absorva o contexto **uma vez** e reaproveite entre as fatias. Não releia os mesmos documentos
para cada spec, mas confirme os dados específicos de cada fatia.

### Fase 1 — Delimitar o épico

Extraia do prompt:

| Dimensão       | O que extrair                                                |
| -------------- | ------------------------------------------------------------ |
| Resultado      | o que o usuário consegue fazer quando o épico terminar       |
| Usuários       | papéis, frequência e contexto                                |
| Domínios       | entidades e áreas envolvidas (auth, produtos, usuários etc.) |
| Jornadas       | entradas e fluxos principais                                 |
| Permissões     | quem pode ver, criar, editar e excluir                       |
| Integrações    | e-mail, storage, pagamento, conectores, serviços externos    |
| Fora de escopo | o que o prompt não pede e não deve entrar                    |

Defina o épico em 1–3 linhas. Se o prompt contiver **épicos independentes** (ex.: autenticação,
produtos e usuários), não invente uma ordem artificial entre eles:

1. Proponha um mapa por épico, cada um com sua própria sequência.
2. Confirme com o usuário se ele quer mapas separados ou um programa único com trilhas.
3. Se for um programa único, use um mapa com trilhas e uma ordem entre elas.

### Fase 2 — Decompor em fatias verticais

Uma fatia entrega **uma capacidade observável de ponta a ponta**, não uma camada técnica. Use as
heurísticas abaixo.

#### Tamanho de uma spec

Uma spec deve caber em **uma execução de `implement-me`**:

- um resultado principal e um fluxo primário;
- de 3 a 7 critérios de aceite verificáveis;
- um único conjunto de telas/endpoints/persistência que só faz sentido junto;
- entregável sem depender de trabalho ainda não feito (além das dependências declaradas).

Divida quando:

- há mais de um ator ou permissão relevante;
- há mais de um ponto de entrada independente;
- os critérios de aceite passam de ~10;
- o título precisa de "e" para juntar coisas não relacionadas;
- a entrega exigiria mais de uma sprint ou mais de um time.

Não divida quando:

- as partes só entregam valor juntas (ex.: criar e listar um CRUD mínimo);
- a divisão criaria uma spec que não pode ser testada sozinha;
- a divisão é por verbo de CRUD sem valor observável em cada fatia.

#### Como cortar

1. Comece pela jornada principal: qual é a primeira coisa que o usuário precisa conseguir fazer?
2. Corte por resultado observável, não por arquivo, pasta, biblioteca ou camada.
3. Coloque primeiro a fatia que desbloqueia as demais.
4. Adicione os fluxos secundários (confirmação, recuperação, edição, exclusão).
5. Adicione administração, permissões e casos de borda.
6. Extraia uma fundação compartilhada **apenas** quando duas ou mais fatias precisarem do mesmo
   modelo/contrato. Prefira introduzi-la na primeira fatia em vez de criar uma spec de
   infraestrutura sem valor observável.

#### Exemplos de corte

**Autenticação**

| Ordem | Fatia                                                      | Depende de |
| ----- | ---------------------------------------------------------- | ---------- |
| 1     | Sign-up: criar conta, validar e-mail e persistir usuário   | —          |
| 2     | Confirmação de conta: token, confirmar e reenviar          | 1          |
| 3     | Sign-in: credenciais, sessão, redirecionamento e guardas   | 1          |
| 4     | Recuperação de senha: solicitar, validar token e redefinir | 1          |
| 5     | Sign-out e expiração de sessão                             | 3          |

MFA, SSO e "lembrar de mim" só entram se estiverem no escopo; caso contrário, vão para fora do
épico.

**CRUD**

Não crie uma spec por verbo. Agrupe pelo valor entregue:

- criar + listar (primeira fatia útil);
- ver detalhe + editar;
- arquivar/excluir + permissões;
- busca, filtro e paginação (quando o volume justificar).

Para **produtos e usuários**, trate como épicos separados quando não houver dependência real
entre eles. Se houver (ex.: produtos pertencem a usuários), declare a dependência no mapa.

### Fase 3 — Ordenar e resolver dependências

1. Monte o grafo de dependências.
2. Garanta que toda dependência aponta para uma fatia **anterior**.
3. Resolva ciclos antes de escrever: funda as fatias ou mova a parte compartilhada para antes.
4. Ordene por desbloqueio e valor: fundação mínima → fluxo principal → fluxos secundários →
   administração e borda.
5. Só então atribua a numeração. O número segue a ordem de implementação.

Regra de ouro: se a fatia B precisa da fatia C e C precisa de B, elas são uma fatia só ou falta
uma fundação compartilhada anterior.

### Fase 4 — Validar o mapa com o usuário

Antes de criar as specs, apresente:

- o resultado do épico e o fora de escopo;
- a tabela de fatias com ordem, capacidade e dependências;
- a fundação compartilhada, se houver;
- as lacunas bloqueantes.

Pergunte se o corte está correto. Se houver lacuna bloqueante, faça no máximo 3 perguntas por
vez, no formato de `feature-concept`: pergunta, por que importa, opções e recomendação. Se o
usuário disser "decida por mim", decida, explique o trade-off e registre no mapa.

Se o usuário pedir para seguir sem revisão, registre a decisão no mapa e continue.

### Fase 5 — Escrever o mapa

1. Resolva o número: use o número da **primeira spec nova** do épico, que é o próximo número
   livre de `.specs/`. Se a primeira fatia já existir como spec, use o próximo número livre para
   as novas e mantenha o mapa com o número da primeira nova.
2. Caminho: `.plans/<numero>-<epic-slug>-breakdown.md`.
   - O sufixo `-breakdown` evita colisão com `.plans/<numero>-<slug>-plan.md`.
   - Exemplo: primeira spec `001-auth-sign-up` → mapa `.plans/001-auth-breakdown.md`.
3. Se o mapa já existir, leia e atualize; não sobrescreva sem entender o que já foi decidido.
4. Use o template da seção **Template do mapa**.
5. Use `Status: draft` por padrão. Só use `approved` com aprovação explícita do usuário. O
   status do mapa se refere ao corte do épico, não ao status das specs.
6. Registre as decisões abertas com impacto e dono.
7. Não crie um plano de execução (`-plan.md`) por spec; isso pertence ao `implement-me`.

### Fase 6 — Criar as specs com `create-spec`

Para cada fatia, na ordem do mapa:

1. Leia `.agents/skills/create-spec/SKILL.md` e siga o fluxo dele.
2. Passe um **brief da fatia** com:
   - o épico e o trecho relevante do prompt original;
   - a capacidade e o resultado observável;
   - usuários e permissões;
   - escopo dentro/fora da fatia;
   - dependências (specs anteriores e fundação compartilhada);
   - sementes de critérios de aceite em "dado X, quando Y, então Z";
   - lacunas e decisões abertas.
3. Use o próximo número livre de `.specs/`, com 3 dígitos e slug em kebab-case.
4. Se a fatia já tiver uma spec equivalente, **não sobrescreva**: reutilize, linke no mapa e
   marque como `existing`.
5. Mantenha `status: draft` até aprovação explícita.
6. Na seção 11 da spec ("Dependências e riscos"), cite o mapa e as specs das quais ela depende.
7. Na seção 1 ("Contexto e problema"), situe a fatia dentro do épico.
8. Atualize o mapa com o caminho e o status real da spec assim que ela for criada.

Não transforme a criação de N specs em N interrogatórios: concentre na Fase 4 as perguntas que
mudam o corte do épico e pergunte apenas o que for específico da fatia.

Se durante a escrita a fatia se revelar grande demais:

1. Pare antes de criar a spec.
2. Divida em novas fatias.
3. Atualize o mapa.
4. Atribua os próximos números livres às novas fatias; não renumere specs já criadas.
5. Continue a partir da fatia atual.

Não crie uma spec "guarda-chuva" para o épico. O épico vive no mapa.

### Fase 7 — Validar a consistência

Antes de entregar, confira:

- [ ] Toda fatia entrega uma capacidade observável e pode ser implementada sozinha.
- [ ] Toda dependência aponta para uma fatia anterior; não há ciclo.
- [ ] A fundação compartilhada está explícita e não virou uma spec de infraestrutura gigante.
- [ ] Cada spec segue `.specs/_template.md` e não contém implementação.
- [ ] Cada spec tem critérios de aceite testáveis.
- [ ] O mapa aponta para caminhos que existem e os números são únicos.
- [ ] Nenhuma spec existente foi sobrescrita.
- [ ] O fora de escopo do épico está explícito.
- [ ] Decisões abertas têm impacto e dono.
- [ ] A primeira spec a implementar está óbvia.

### Fase 8 — Entregar

Responda com:

- Caminho do mapa de breakdown.
- Tabela das specs criadas, na ordem, com caminho e dependências.
- Qual spec implementar primeiro e por quê.
- Decisões abertas e quem precisa decidir.
- Próximo passo: `refine-spec` na primeira spec, se ainda houver lacuna, ou `implement-me`.

Não implemente código, não crie plano de execução e não faça commit sem pedido explícito.

---

## Template do mapa

````md
# Breakdown — <Nome do épico>

> **Prompt original:** <resumo ou citação do pedido>
> **Criado em:** YYYY-MM-DD
> **Status:** draft | approved
> **Primeira spec:** `.specs/<numero>-<slug>.md`

## 1. Resultado do épico

<O que o usuário consegue fazer quando o épico terminar. 1–3 linhas.>

## 2. Fora do épico

- ...

## 3. Fatias e ordem de implementação

| Ordem | Spec             | Capacidade entregue | Depende de | Status |
| ----- | ---------------- | ------------------- | ---------- | ------ |
| 1     | `.specs/001-...` | ...                 | —          | draft  |
| 2     | `.specs/002-...` | ...                 | 001        | draft  |

Status da fatia: `draft` (criada), `existing` (reutilizada) ou `planned` (ainda não criada).

## 4. Grafo de dependências

```text
001 → 002
001 → 003 → 005
001 → 004
```

## 5. Fundação compartilhada

<Modelo, contrato ou permissão usado por várias fatias e onde ele é introduzido.
Se não houver, escreva "Não aplicável" e o motivo.>

## 6. Decisões abertas

| Tema | Pergunta | Impacto | Dono | Status |
| ---- | -------- | ------- | ---- | ------ |
| ...  | ...      | ...     | ...  | aberta |

## 7. Histórico

- YYYY-MM-DD — breakdown criado.
````

---

## Exemplos

### Exemplo 1 — Autenticação

**Prompt:** "Precisamos de autenticação com sign-up, confirmação de conta, sign-in e
recuperação de senha."

**Mapa:** `.plans/001-auth-breakdown.md`

**Specs:**

1. `.specs/001-auth-sign-up.md` — criar conta, validar e-mail e persistir usuário.
2. `.specs/002-auth-confirm-account.md` — confirmar conta por token e reenviar e-mail.
3. `.specs/003-auth-sign-in.md` — autenticar, abrir sessão, redirecionar e proteger rotas.
4. `.specs/004-auth-password-recovery.md` — solicitar recuperação, validar token e redefinir.
5. `.specs/005-auth-sign-out.md` — encerrar sessão e tratar expiração.

**Fora:** MFA, SSO, login social e "lembrar de mim", salvo pedido explícito.

### Exemplo 2 — CRUD de produtos e usuários

**Prompt:** "Quero CRUD de produtos e de usuários."

**Decisão:** são dois épicos independentes; proponha dois mapas.

**Produtos:** `.plans/010-products-breakdown.md`

1. `.specs/010-products-create-list.md` — criar e listar produtos.
2. `.specs/011-products-edit-archive.md` — editar e arquivar produtos.
3. `.specs/012-products-search-filter.md` — buscar, filtrar e paginar.

**Usuários:** `.plans/013-users-breakdown.md`

1. `.specs/013-users-invite-list.md` — convidar e listar usuários.
2. `.specs/014-users-roles-permissions.md` — editar papéis e permissões.
3. `.specs/015-users-deactivate.md` — desativar usuário e registrar auditoria.

Os números são exemplos: use sempre o próximo livre em `.specs/`.

---

## Guardrails

- Spec é fonte do **o quê**; o mapa é fonte da **ordem e das dependências**; o plano é fonte do
  **como**.
- Use `create-spec` para escrever cada spec. Não duplique o template nem as regras dele.
- Uma spec = uma capacidade implementável. Não crie specs por camada técnica.
- Não invente requisitos, permissões ou métricas para preencher lacuna.
- Não crie uma spec para o épico inteiro.
- Não reutilize números e não sobrescreva specs existentes.
- Não avance para `approved` sem aprovação explícita.
- Não implemente, não crie plano de execução e não faça commit.
- Se o pedido violar `.docs/RULES.md`, pare e explique.

---

## Anti-padrões

- Criar uma spec gigante "autenticação completa".
- Dividir por pasta ou tecnologia: "spec da API de auth", "spec da UI de auth".
- Criar uma spec por verbo de CRUD sem valor observável em cada uma.
- Deixar uma fatia depender de outra que ainda não existe, sem declarar.
- Duplicar o modelo de usuário ou de produto em várias specs.
- Criar uma fundação compartilhada gigante que não entrega nada ao usuário.
- Ignorar specs existentes e criar duplicatas.
- Gerar 15 specs minúsculas que só fazem sentido juntas.
- Declarar o breakdown aprovado sem o usuário confirmar.
- Começar a implementar durante o breakdown.
