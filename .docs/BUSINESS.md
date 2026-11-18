# BUSINESS.md — Negócio e produto

> **Status:** hipóteses iniciais + catálogo de Experts, chat, fontes de arquivo e mídia implementados (fatias 012–013, 015) · **Atualizado em:** 2026-11-18
> **Público:** produto, engenharia e agentes que precisam entender **o que** estamos construindo.

Este documento descreve o problema, a proposta de valor e o escopo do produto. Decisões ainda
não validadas estão marcadas como **hipótese**.

---

## 1. Resumo

Plataforma para criar e operar **Experts**: agentes de IA especializados em uma área ou posição
da empresa (CEO, CMO, CTO etc.). Cada Expert acessa dados conectados de fontes externas e
responde a pedidos assumindo o papel daquela posição.

**Em uma frase:** um time de especialistas de IA que conhece os dados da sua empresa.

---

## 2. Problema

- Decisões de negócio dependem de informações espalhadas em várias ferramentas.
- Lideranças gastam tempo consolidando dados manualmente antes de analisar.
- Ferramentas de IA genéricas não conhecem o contexto, o histórico e os dados da empresa.
- Consultorias especializadas são caras e não escalam para o dia a dia.

## 3. Proposta de valor

- **Contexto real:** Experts respondem com base nas fontes conectadas, não apenas em
  conhecimento genérico.
- **Especialização:** cada Expert tem escopo, tom e critérios de análise de uma posição.
- **Rastreabilidade:** respostas devem citar as origens usadas.
- **Velocidade:** substituir a consolidação manual por perguntas em linguagem natural.

## 4. Público-alvo (hipótese)

| Segmento                   | Necessidade                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| Startups e PMEs            | Acesso a análises de nível executivo sem contratar um executivo sênior |
| Empresas médias            | Acelerar análises e reduzir retrabalho de consolidação                 |
| Lideranças (CEO, CMO, CTO) | Segunda opinião e apoio à decisão com dados da própria empresa         |

---

## 5. Conceitos

| Termo                    | Definição                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Expert**               | Agente de IA com papel, escopo, instruções e fontes de dados definidos (ex.: CEO Expert).                                              |
| **Conector**             | Integração que autentica e sincroniza dados de uma ferramenta externa.                                                                 |
| **Fonte de dados**       | Origem concreta de conteúdo: um documento, uma pasta, um projeto, um board etc.                                                        |
| **Base de conhecimento** | Conteúdo ingerido, normalizado e indexado a partir das fontes conectadas.                                                              |
| **Pedido**               | Pergunta ou tarefa enviada a um Expert.                                                                                                |
| **Conversa**             | Transcript de pedidos e respostas com um Expert, isolado por usuário autenticado.                                                      |
| **Entregável**           | Resposta, análise, resumo ou documento produzido pelo Expert.                                                                          |
| **Workspace**            | Espaço isolado de uma empresa/conta, com seus Experts, fontes e dados. **Hipótese — não implementado; a fatia 012 isola por usuário.** |

---

## 6. Experts iniciais

A fatia 012 implementa os nove Experts abaixo, nesta ordem de exibição. O catálogo (identidade,
papel, escopo, tom e sugestões) vive na API (`EXPERT_CATALOG`) e é a fonte única consumida pela web.

| Expert                               | Foco                                                    | Exemplos de entregável                                                    |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| **CTO Expert**                       | Tecnologia, arquitetura, segurança, engenharia          | Avaliação de arquitetura, roadmap técnico, análise de riscos de segurança |
| **CMO Expert**                       | Marketing, marca, aquisição, conteúdo                   | Plano de campanha, análise de concorrência, calendário editorial          |
| **Sales Director Expert**            | Pipeline, previsão de receita, contas-chave, negociação | Análise de deals em risco, plano de follow-up, previsão do trimestre      |
| **Customer Success Director Expert** | Adoção, health score, retenção, expansão                | Sinais de churn, plano de recuperação, bloqueios de adoção                |
| **Customer Hero Director Expert**    | Voz do cliente, experiência, escalonamento, histórias   | Resposta a reclamação, plano de escalonamento, histórias de sucesso       |
| **CEO Expert**                       | Estratégia, negócio, finanças, priorização              | Diagnóstico, plano estratégico de 90 dias, resumo executivo               |
| **CFO Expert**                       | Fluxo de caixa, orçamento, margem, captação             | Cálculo de runway, redução de custo, leitura de margem por linha          |
| **COO Expert**                       | Operações, processos, SLAs, execução                    | Gargalos de processo, plano de ação de SLA, prioridades operacionais      |
| **CPO Expert**                       | Descoberta, roadmap, priorização, métricas de produto   | Priorização de problemas, roadmap trimestral, temas de entrevistas        |

> Novos Experts devem ser compostos por **template + instruções + fontes permitidas**, não por
> código específico por Expert. Na fatia 012 as sugestões não dependem de fontes conectadas; versões
> que consultam fontes entram nas fatias seguintes.

---

## 7. Conectores

| Conector      | Conteúdo                     | Prioridade (hipótese) |
| ------------- | ---------------------------- | --------------------- |
| Upload de PDF | Documentos e relatórios      | MVP                   |
| Markdown      | Notas e documentação técnica | MVP                   |
| Google Drive  | Arquivos e pastas            | MVP                   |
| Notion        | Páginas e bases              | MVP                   |
| Google Docs   | Documentos                   | Próxima fase          |
| Google Sheets | Planilhas                    | Próxima fase          |
| Confluence    | Páginas e spaces             | Próxima fase          |
| Jira          | Issues, épicos e projetos    | Próxima fase          |
| Linear        | Issues e projetos            | Próxima fase          |
| ClickUp       | Tarefas e docs               | Próxima fase          |

> **Estado atual (fatia 013):** upload de PDF, TXT e Markdown já está implementado na home privada.
> A pessoa anexa arquivos pelo botão flutuante, acompanha `queued`/`processing`/`ready`/`failed`,
> recebe "Already connected" quando reenvia o mesmo conteúdo e pode remover uma fonte. O hash do
> conteúdo deduplica no escopo do usuário; nome igual com conteúdo diferente cria nova versão e a
> anterior fica desatualizada. Arquivo, versões, chunks e vetores são removidos juntos na exclusão.
> Google Drive e Notion seguem como hipótese de MVP, não implementados nesta fatia.
>
> **Estado atual (fatia 015):** a mesma lista de conexões aceita imagem (JPEG/PNG), áudio (MP3) e
> vídeo (MP4) atrás da flag `knowledge_media_enabled`, desligada por padrão. A mídia é convertida
> em texto localmente por OCR/transcrição e segue o pipeline de chunks, embeddings e Weaviate da
> fatia 013, com deduplicação, status, retry e exclusão iguais. Áudio sem fala falha com
> "No speech detected"; formatos não suportados são recusados com mensagem em inglês. As opções
> de mídia por URL, modelos locais definitivos e limites operacionais seguem em decisão aberta.

Requisitos por conector:

- Autenticação segura e renovação de token.
- Sincronização incremental quando a API permitir.
- Mapeamento para um formato normalizado de documento.
- Tratamento de rate limit, timeout e falhas transitórias.
- Respeito às permissões da fonte original.

---

## 8. Fluxos principais

### 8.1 Onboarding

1. Usuário cria um workspace.
2. Conecta uma ou mais fontes.
3. Plataforma sincroniza e indexa o conteúdo.
4. Usuário escolhe um Expert inicial.
5. Usuário faz o primeiro pedido e recebe uma resposta com citações.

### 8.2 Uso recorrente

1. Usuário seleciona um Expert.
2. Envia um pedido em linguagem natural.
3. Expert recupera contexto das fontes permitidas.
4. Expert responde com análise e referências.
5. Usuário refina o pedido ou solicita um entregável.

> **Estado atual (fatias 012–013):** seleção do Expert, sugestões clicáveis, envio de prompt, resposta
> no papel do Expert e histórico isolado por usuário já funcionam. A fatia 013 permite conectar
> PDF/TXT/Markdown e indexar chunks/embeddings no Weaviate local, mas o chat ainda não consulta essa
> base: a resposta continua vindo do modelo com a persona do Expert. A recuperação de contexto e as
> citações (passos 3–4) entram na fatia 5.

### 8.3 Gestão

- Administrador gerencia membros, fontes e permissões do workspace.
- Administrador configura quais fontes cada Expert pode acessar.
- Histórico de pedidos e entregáveis fica disponível para consulta.

---

## 9. Escopo do MVP (proposta)

**Dentro do MVP**

- Autenticação (implementada); workspace segue como hipótese.
- Catálogo de nove Experts com chat em persona (implementado na fatia 012).
- Conexão de fontes de arquivo (PDF, TXT e Markdown — implementada na fatia 013); Google Drive e
  Notion seguem como hipótese de MVP.
- Pergunta e resposta com citações das fontes (citações nas fatias seguintes).
- Histórico de conversas isolado por usuário (implementado na fatia 012).
- Controle básico de acesso por workspace.

**Fora do MVP**

- Cobrança e planos.
- Marketplace de Experts.
- Escrita de volta nas ferramentas conectadas.
- Apps mobile nativos.
- Fine-tuning de modelos.
- Permissões granulares por documento.

> O escopo acima é uma **proposta**. Deve ser validado com produto antes de virar compromisso.

---

## 10. Requisitos não funcionais

| Área            | Requisito                                                               |
| --------------- | ----------------------------------------------------------------------- |
| Segurança       | Isolamento por workspace, menor privilégio e tokens criptografados      |
| Privacidade     | Conformidade com LGPD; política clara de retenção e uso de dados        |
| Auditabilidade  | Registrar acessos, sincronizações e pedidos relevantes                  |
| Qualidade       | Respostas devem citar fontes e deixar claro quando não houver evidência |
| Latência        | Primeira resposta em poucos segundos para consultas simples             |
| Custo           | Controlar custo por resposta e por sincronização                        |
| Observabilidade | Logs, métricas e traces desde o dia 0                                   |

---

## 11. Métricas de sucesso (proposta)

| Métrica               | Definição                                                           |
| --------------------- | ------------------------------------------------------------------- |
| Ativação              | Workspace conecta ao menos uma fonte e faz o primeiro pedido em 24h |
| Time to first insight | Tempo entre o cadastro e o primeiro entregável útil                 |
| Uso semanal           | Workspaces e usuários ativos por semana                             |
| Retenção              | Workspaces ativos após 30 e 90 dias                                 |
| Satisfação            | CSAT/NPS por resposta ou entregável                                 |
| Confiança             | Percentual de respostas com citação válida                          |

---

## 12. Riscos e questões abertas

| Risco/questão                             | Impacto                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| Alucinação ou resposta sem evidência      | Perda de confiança; mitigar com citações obrigatórias |
| Custo de LLM e ingestão                   | Inviabiliza o modelo de negócio; medir desde o MVP    |
| Permissões nas fontes externas            | Vazamento de dados; aplicar menor privilégio          |
| Multi-tenancy não definido                | Retrabalho de modelo de dados e RLS                   |
| Escopo do Expert (aconselhar vs executar) | Expectativa do usuário e complexidade                 |
| Modelo de cobrança                        | Ainda não definido                                    |
| Dependência de APIs de terceiros          | Rate limits e mudanças de contrato                    |

---

## 13. Como usar este documento

- **Produto:** valide ou corrija as hipóteses antes de tratá-las como requisito.
- **Engenharia:** use os conceitos e fluxos para nomear módulos e casos de uso.
- **Agentes:** se uma tarefa exigir uma regra de negócio não descrita aqui, **pare e pergunte**;
  não invente comportamento de produto.
