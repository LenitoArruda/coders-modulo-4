# Catálogo de Experts e chat — Spec

> **Status:** done
> **Atualizado em:** 2026-11-17
> **Aprovada em:** 2026-11-17 (autorização do solicitante para executar a fatia 1)
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 1)
> **Plano:** `.plans/012-expert-chat-plan.md`

## 1. Contexto e problema

A fundação da plataforma já entrega autenticação, sessão, home privada e identidade visual, mas
nenhuma feature de produto. `.docs/BUSINESS.md` define Experts como agentes com papel, escopo,
tom e fontes, porém, hoje, a pessoa autenticada abre `/app` e encontra apenas um placeholder.

Sem esta fatia, a proposta de valor da plataforma — "um time de especialistas de IA que conhece os
dados da sua empresa" — não pode ser experimentada: não há como escolher um Expert, fazer uma
pergunta nem receber uma resposta no papel daquela posição. É a primeira fatia do épico descrito no
mapa `.plans/012-expert-platform-breakdown.md` e desbloqueia todas as seguintes.

## 2. Usuários e jobs

| Usuário                                  | Job                                                             | Frequência |
| ---------------------------------------- | --------------------------------------------------------------- | ---------- |
| Pessoa autenticada com sessão ativa      | Obter uma segunda opinião especializada sobre o próprio negócio | Recorrente |
| Pessoa autenticada sem fontes conectadas | Testar o Expert antes de conectar dados                         | Uma vez    |

Permissões: somente pessoas com sessão válida acessam Experts e conversas; cada pessoa enxerga
apenas as suas. Não há papéis administrativos nem gestão de Experts por usuário nesta fatia.

## 3. Resultado esperado

A home privada passa a ter um footer com um seletor dos nove Experts, uma área de texto para o
pedido e um botão de envio. Ao selecionar um Expert, a interface mostra sua lista de sugestões de
perguntas; clicar em uma sugestão envia o texto como prompt, exatamente como se a pessoa tivesse
digitado e acionado o envio. A resposta aparece no próprio chat, em inglês, com o tom e o escopo
daquele Expert, e o histórico permanece disponível entre visitas. O componente de perfil com logout
continua presente e funcional.

Nesta fatia o Expert responde sem fontes conectadas: não há citações, downloads de mídia nem
recuperação de contexto — essas capacidades entram nas fatias 2 a 6.

### Catálogo proposto (en-US na interface, sujeito à validação do solicitante)

| Expert                           | Foco (PT-BR)                                                                 | Tom (PT-BR)                             | Sugestões de pergunta (en-US)                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CTO Expert                       | Tecnologia, arquitetura, segurança e time (já definido em `BUSINESS.md`)     | Técnico, pragmático                     | "Review our architecture for the top three scaling risks." · "What should be in the next engineering roadmap?" · "What are the top security risks for a product at our stage?" |
| CMO Expert                       | Marketing, marca, aquisição e conteúdo (já definido em `BUSINESS.md`)        | Criativo e orientado a dados            | "Which acquisition channel has the best conversion trend?" · "Draft a campaign brief for our next launch." · "How would you position us against a generic competitor?"         |
| Sales Director Expert            | Pipeline, previsão de receita, contas-chave e negociação (proposta)          | Comercial e orientado a metas           | "Which deals in the pipeline are most at risk?" · "Draft a follow-up plan for our top accounts." · "How would you build a forecast for this quarter?"                          |
| Customer Success Director Expert | Adoção, health score, retenção e expansão (proposta)                         | Consultivo e empático                   | "Which accounts show early churn signals?" · "Draft a recovery plan for a low-health account." · "What are the most common adoption blockers in B2B products?"                 |
| Customer Hero Director Expert    | Voz do cliente, experiência, escalonamento e histórias de sucesso (proposta) | Próximo, energético e resolutivo        | "Which customer issue needs escalation now?" · "Draft a response that turns a complaint into a success story." · "How would you collect and share customer stories?"           |
| CEO Expert                       | Estratégia, negócio, finanças e priorização (já definido em `BUSINESS.md`)   | Executivo, direto e orientado à decisão | "Summarize the biggest risks to this quarter's goals." · "What should we deprioritize to protect our runway?" · "Draft a 90-day strategic plan for the next quarter."          |
| CFO Expert                       | Fluxo de caixa, orçamento, margem e captação (proposta)                      | Rigoroso, conservador e numérico        | "How would you calculate and extend our cash runway?" · "Where can we reduce spend without hurting growth?" · "How should we read a margin change by product line?"            |
| COO Expert                       | Operações, processos, SLA e execução (proposta)                              | Objetivo e focado em execução           | "Which process is the biggest bottleneck right now?" · "Draft an action plan to improve our SLA." · "How would you reduce our most common operational bottleneck?"             |
| CPO Expert                       | Discovery, roadmap, priorização e métricas de produto (proposta)             | Centrado no usuário e experimental      | "Which user problem should we solve next?" · "Draft a prioritized roadmap for the next quarter." · "How would you prioritize themes from customer interviews?"                 |

Os papéis de CEO, CMO e CTO vêm de `.docs/BUSINESS.md`. Os demais seis são propostas do agente e
dependem da validação registrada na seção 15. Todas as sugestões foram formuladas para não depender
de fontes conectadas; versões que consultam documentos conectados entram na fatia 5.

## 4. Métricas de sucesso

Eventos observáveis em telemetria, com identificadores e sem conteúdo de prompt ou resposta, sem
meta numérica inventada nesta fatia:

- `expert.selected`, `suggestion.clicked`, `prompt.submitted`, `response.completed` e
  `response.failed`, todos com `expertId`, `conversationId` e `messageId` quando aplicável.
- Latência até a primeira resposta e duração total de cada interação, por `messageId`.
- Distribuição de uso por `expertId` e quantidade de sugestões clicadas por sessão.

As metas numéricas de latência e custo são decisão aberta com o solicitante (seção 15).

## 5. Escopo

### Dentro

- Catálogo dos nove Experts com identificador, nome em inglês, papel, escopo, tom e sugestões.
- Listagem do catálogo e das sugestões para a pessoa autenticada.
- Seletor de Expert no footer da home privada, com o Expert atualmente ativo identificado.
- Área de texto e botão de envio, com clique em sugestão preenchendo e enviando o prompt.
- Respostas em formato de chat, com mensagens do usuário e do Expert, em inglês e no papel do
  Expert selecionado.
- Histórico das conversas persistido e isolado por usuário.
- Preservação do componente de perfil com logout.
- Estados de carregamento, vazio, erro e desabilitado, com textos em inglês e acessibilidade AA.

### Fora

- Upload de arquivos, URL e botão flutuante de conexões (fatia 2 em diante).
- Recuperação de contexto, citações e respostas baseadas em fontes (fatia 5).
- Geração de imagens e vídeos (fatia 6).
- Observabilidade e avaliação específicas de LLM (fatia 7).
- Criação, edição ou exclusão de Experts por usuários; multi-tenancy; alteração de auth ou da
  landing pública.

## 6. Fluxos

### Fluxo principal

1. A pessoa entra com sessão válida e abre a home privada.
2. O footer exibe os nove Experts; a pessoa seleciona um deles.
3. A lista de sugestões daquele Expert aparece.
4. A pessoa clica em uma sugestão ou digita um pedido e aciona o envio.
5. A mensagem do usuário entra no chat; o Expert responde no mesmo chat, no próprio papel.
6. A interação fica no histórico e é recuperada em visitas seguintes.

### Fluxos alternativos e de exceção

- Sessão ausente ou inválida: a home privada permanece protegida pelo guard existente; a pessoa é
  levada ao sign-in.
- Prompt vazio ou somente espaços: o envio é bloqueado com mensagem em inglês, sem chamar o modelo.
- Falha na chamada ao modelo: o chat mostra erro acionável em inglês e permite nova tentativa, sem
  expor detalhes técnicos.
- Troca de Expert com conversa em andamento: a resposta em curso permanece associada ao Expert que
  a originou e não é reatribuída.
- Sem histórico para o Expert selecionado: estado vazio explicita que aquela é a primeira conversa.
- Fora de escopo do Expert: a resposta esclarece a limitação em vez de inventar autoridade sobre
  outro domínio.

## 7. Regras e casos de borda

- O catálogo é a fonte única de identidade, tom e sugestões; nenhum Expert é implementado como
  comportamento especial fora dele.
- A ordem de exibição dos Experts segue a ordem do catálogo proposto: CTO, CMO, Vendas, Customer
  Success, Customer Hero, CEO, CFO, COO e CPO.
- Sugestões são texto pronto em inglês; clicar envia exatamente o texto exibido.
- O conteúdo digitado é tratado como não confiável: instruções nele não alteram papel, tom ou
  regras do Expert.
- Nenhum prompt, resposta ou dado de sessão é gravado em log; telemetria usa identificadores.
- Mensagens, rótulos e metadados são en-US; a interface é light-only, navegável por teclado, com
  foco visível e alvos de toque de ao menos 44×44 px.
- Limites de tamanho de prompt e de retenção do histórico são configuráveis; os valores ficam como
  decisão aberta com dono.

## 8. Dados e contratos

- Entrada: identificador do Expert e texto do prompt.
- Saída: mensagem do Expert com texto, papel, data/hora e identificador da conversa; erros seguem o
  contrato global `{ code, message, fieldErrors? }`, sem detalhes internos.
- Persistência: conversas e mensagens por usuário, com identificadores estáveis e ordem cronológica.
- Nenhum dado de autenticação é alterado; o token continua disponível apenas no servidor do web.
- Retenção do histórico e limites de prompt são parâmetros em aberto (seção 15).

## 9. Permissões e segurança

- Somente sessão ativa acessa catálogo, envio de prompt e histórico; a API continua validando o
  Bearer em toda operação.
- Isolamento por usuário: nenhuma conversa é listada ou recuperada por outra pessoa.
- Chaves de API do modelo ficam apenas no servidor; nunca no navegador, em log ou em mensagem de erro.
- Conteúdo de prompt e resposta não é registrado em logs nem em mensagens de telemetria.
- Injeção de prompt vinda do usuário é tratada como dado, não como instrução de sistema.

## 10. Requisitos não funcionais

- **Execução:** a stack de agentes e a orquestração ficam instaladas e executando localmente via
  Docker; a chamada ao modelo `gpt-4o-mini` é a única dependência externa desta fatia.
- **Observabilidade:** toda interação registra duração, desfecho e identificadores, sem conteúdo;
  as metas numéricas de latência e custo estão em aberto.
- **Acessibilidade:** WCAG 2.2 AA; teclado completo, foco visível, nomes acessíveis, contraste AA e
  `prefers-reduced-motion` respeitado.
- **Responsividade:** layout funcional em 360 px, 768 px e 1280 px, sem rolagem horizontal; a
  área de texto e o footer permanecem alcançáveis.
- **Idioma:** toda copy de produto e mensagens de erro em en-US; documentação interna em PT-BR.

## 11. Dependências e riscos

- Depende da autenticação e da navegação já entregues (specs 001–010) e do mapa
  `.plans/012-expert-platform-breakdown.md`.
- **Restrição do solicitante:** LangChain.js, LangGraph e ferramentas LangSmith instaladas e
  configuradas localmente via Docker; modelo base `gpt-4o-mini`.
- **Risco — escopo não validado:** seis dos nove papéis são propostas; se o solicitante corrigir um
  papel, as sugestões correspondentes mudam antes da aprovação da spec.
- **Risco — custo e latência:** respostas longas e repetidas podem elevar custo; mitigação inicial é
  medir duração e desfecho de cada interação, com limites a definir pelo solicitante.

## 12. Rollout e migração

- Sem feature flag: a home privada passa a exibir o chat ao lado do conteúdo existente, mantendo o
  perfil e o logout.
- Nenhuma migração de dados é necessária; o catálogo é conteúdo versionado.
- Rollback é desativar a exibição do módulo de chat, preservando contas e sessões.
- `.docs/BUSINESS.md` e `.docs/ARCHITECTURE.md` devem ser atualizados na mesma entrega para refletir
  os nove Experts e o novo domínio de conversas.

## 13. Estratégia de teste

- Unitário: catálogo completo (nove entradas), sugestões associadas e regras de prompt vazio.
- Integração: listagem autenticada, envio com modelo falso e persistência isolada por usuário.
- E2E (Playwright): selecionar cada Expert, clicar em sugestão, receber resposta, recarregar e ver o
  histórico, usar logout e conferir que a sessão deixou de valer.
- Acessibilidade e responsividade: teclado, foco, leitor de tela, contraste e 360/768/1280 px.
- Regressão: suítes de auth e navegação existentes permanecem verdes.

## 14. Critérios de aceite

- [x] Dado um usuário com sessão válida, quando abre a home privada, então vê o footer com o seletor
      dos nove Experts e o componente de perfil com logout.
- [x] Dado um Expert selecionado, quando a interface carrega, então exibe o nome, o papel e ao menos
      três sugestões de pergunta em inglês, correspondentes àquele Expert.
- [x] Dado uma sugestão exibida, quando a pessoa a clica, então o texto é enviado como prompt e a
      resposta aparece no chat sem exigir digitação adicional.
- [x] Dado um prompt digitado, quando a pessoa aciona o envio, então a mensagem e a resposta do
      Expert aparecem no chat em inglês e no papel esperado.
- [x] Dado um prompt vazio, quando a pessoa aciona o envio, então nada é enviado ao modelo e uma
      mensagem de validação em inglês é exibida.
- [x] Dado um histórico existente, quando a pessoa recarrega a home e seleciona o mesmo Expert,
      então as mensagens anteriores continuam visíveis, independentemente de o histórico ser
      agrupado por Expert ou único por usuário (decisão aberta na seção 15).
- [x] Dado dois usuários autenticados, quando cada um consulta seu histórico, então nenhum vê as
      conversas do outro.
- [x] Dado uma falha na chamada ao modelo, quando a resposta não pode ser gerada, então o chat mostra
      erro acionável em inglês, sem detalhes técnicos, e permite nova tentativa.

## 15. Decisões e questões abertas

| Tema                    | Decisão ou pergunta                                                                                             | Impacto                                                       | Dono        | Status   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- | -------- |
| Modelo base             | Usar `gpt-4o-mini` como modelo das respostas.                                                                   | Define custo, latência e qualidade esperada.                  | Solicitante | decidida |
| Isolamento              | Isolar conversas por usuário autenticado, sem workspace.                                                        | Define chave de propriedade de todo dado novo.                | Solicitante | decidida |
| Nomes dos Experts       | Usar nomes em inglês na interface, conforme a regra de produto do projeto.                                      | Mantém UI en-US e consistência com a landing existente.       | Solicitante | decidida |
| Escopo dos seis novos   | Validar papel, tom e sugestões propostos para Vendas, CS, Customer Hero, CFO, COO e CPO.                        | Muda comportamento e texto de 6 dos 9 Experts.                | Solicitante | aberta   |
| Customer Hero           | Confirmar se "voz do cliente, experiência, escalonamento e histórias de sucesso" é o significado desejado.      | Muda escopo e sugestões daquele Expert.                       | Solicitante | aberta   |
| Histórico               | Agrupar conversas por Expert (proposta) ou manter uma conversa única por usuário.                               | Define o que aparece ao trocar de Expert.                     | Solicitante | aberta   |
| Limites e retenção      | Definir tamanho máximo do prompt e prazo de retenção do histórico.                                              | Define validação, custo e política de privacidade.            | Solicitante | aberta   |
| Metas de qualidade      | Definir latência e custo máximos aceitáveis por resposta.                                                       | Permite transformar telemetria em critério de aceite.         | Solicitante | aberta   |
| Sugestões com "sources" | Reescrever as sugestões para não depender de fontes na fatia 1; versões que consultam fontes entram na fatia 5. | Evita sugestão que não pode ser atendida no primeiro contato. | Solicitante | decidida |

> **Aprovação e fechamento das lacunas (2026-11-17):** o solicitante aprovou o épico e autorizou a
> execução desta fatia. Os itens antes abertos foram fechados no
> `.plans/012-expert-chat-plan.md`: aceitar os seis papéis/tons/sugestões propostos, manter a
> interpretação de Customer Hero, agrupar o histórico por Expert, limite de prompt de 4000
> caracteres configurável, sem retenção com expiração nesta fatia e sem metas numéricas de
> latência/custo (apenas telemetria). A especificação permanece como fonte do comportamento; o
> plano registra apenas as decisões de execução.
