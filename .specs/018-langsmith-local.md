# Observabilidade e avaliação com LangSmith local — Spec

> **Status:** done (fatia local-first; validações dependentes da stack licenciada registradas como bloqueio)
> **Atualizado em:** 2026-11-18
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 7)
> **Depende de:** `.specs/012-expert-chat.md`, `.specs/016-rag-citations.md`
> **Plano:** `.plans/018-langsmith-local-plan.md`

## 1. Contexto e problema

As fatias 1 a 6 entregam Experts, chat, conexões de conhecimento, RAG com citações e
geração multimídia, com chamadas a OpenAI e Gemini e execução local no restante. Porém, sem
instrumentação, o time não consegue responder perguntas básicas: qual Expert está sendo mais
usado, quais prompts falham, quanto custa cada conversa, se as citações estão corretas ou se
uma mudança de prompt piorou a qualidade das respostas.

O usuário definiu LangSmith como ferramenta de Deployment, Evaluation, Observability e
Studio, mas também exigiu que tudo rode local via Docker, exceto chamadas a OpenAI e Gemini.
Websearch confirmou que LangSmith self-hosted usa Compose para dev/test e Kubernetes para
produção. Sem esta fatia, não há rastreabilidade ponta a ponta, não há avaliação
reproduzível e a evolução dos Experts vira tentativa e erro.

## 2. Usuários e jobs

- **Time de IA:** instrumenta cadeias LangChain.js/LangGraph, acompanha traces, executa
  avaliações e compara versões de prompts e modelos.
- **Time de produto:** acompanha uso, latência, custo e taxa de falha por Expert.
- **Pessoa autenticada:** se beneficia indiretamente de respostas mais confiáveis e de
  correções rápidas; não precisa ver detalhes de instrumentação.
- **Time de infraestrutura:** sobe a stack local em Docker e, no futuro, em Kubernetes, sem
  expor dados a SaaS externo.

## 3. Resultado esperado

Cada interação relevante — envio de prompt, recuperação vetorial, geração de resposta,
citação e geração de mídia — produz um trace estruturado no LangSmith self-hosted, com
metadados de usuário (sem PII), expert, conversa, fontes, modelo, latência e custo.
O time consegue abrir o Studio para inspecionar grafos e prompts, usar a CLI para executar
evaluations com datasets versionados e acompanhar métricas em painel local (LGTM: Grafana,
Loki e Tempo, ou equivalente).

A stack permanece compatível com o requisito "local primeiro": LangSmith em Docker Compose
para desenvolvimento/teste, com caminho de evolução para Kubernetes em produção como
decisão aberta. Nenhum dado de trace é enviado para a nuvem da LangChain.

## 4. Métricas de sucesso

| Métrica                                      | Linha de base | Meta                                                                |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| Interações com trace completo                | 0%            | 100% dos fluxos das fatias 1, 5 e 6 instrumentados                  |
| Evaluations executadas por release de prompt | 0             | ≥ 1 suite executada antes de cada mudança de prompt/modelo          |
| Cobertura de metadados obrigatórios          | 0%            | 100% dos traces com expert, user_id (pseudônimo), conversa e modelo |
| Tempo para diagnosticar falha                | —             | Reduzir para < 10 min usando trace + logs                           |
| Vazamento de PII para serviços externos      | —             | 0 (com exceção explícita de OpenAI/Gemini já existente)             |

## 5. Escopo

### Dentro

- Subida do LangSmith self-hosted via Docker Compose para dev/test, integrada ao Compose
  existente do projeto.
- Configuração de variáveis de ambiente para apontar SDK/CLI para o endpoint local, sem
  fallback automático para a nuvem.
- Instrumentação de spans com LangChain.js/LangGraph para:
  - recebimento do prompt e seleção do Expert (fatia 1);
  - recuperação no Weaviate (fatia 5);
  - geração da resposta com `gpt-4o-mini` (fatia 5);
  - geração de imagem/vídeo (fatia 6);
  - processamento de fontes de conhecimento (fatia 2 e seguintes), quando útil.
- Convenção de metadados obrigatórios e opcionais por span, com pseudonimização de
  `user_id`.
- Datasets de avaliação versionados para respondabilidade, fidelidade a fontes e
  qualidade de citações, executáveis pela CLI.
- Painel local de logs/métricas (LGTM ou equivalente) com alertas básicos para taxa de
  erro e latência.
- Uso do Studio para inspecionar e versionar prompts/grafos.
- Documentação operacional de subida, execução de evaluation e leitura de traces.
- Testes de instrumentação, sem PII e com falha graciosa do coletor local.
- Registro do caminho de evolução para Deployment/self-hosted em Kubernetes como decisão
  aberta, sem implementação nesta fatia.

### Fora

- Evaluation e Deployment do LangSmith em infraestrutura dedicada/Kubernetes — fase futura,
  após validação; nesta fatia a avaliação é feita pela CLI local e a leitura por Studio e LGTM.
- Migração de dados de produção para Kubernetes — decisão aberta, fase futura.
- Envio de traces para LangSmith Cloud.
- Treinamento de modelos ou fine-tuning com traces.
- Redesign da interface do chat para exibir métricas ao usuário final.
- Definição de política de retenção de dados sensíveis além do mínimo necessário — decisão
  aberta.
- Instrumentação de partes fora do épico (autenticação legada, por exemplo) além do
  necessário para correlacionar requests.
- SLOs formais e paginação de plantão.

## 6. Fluxos

### Fluxo principal

1. O time sobe a stack com `bun run infra:up` (script que usa o Docker Compose do projeto,
   após a inclusão dos serviços do LangSmith), incluindo o LangSmith self-hosted e o painel local
   de observabilidade.
2. A aplicação é iniciada com variáveis apontando para o endpoint local do LangSmith.
3. A pessoa autenticada envia um prompt no chat.
4. Cada etapa do grafo LangGraph emite spans com metadados padronizados.
5. O trace completa com entrada, saída, latência, custo, fontes recuperadas e citações.
6. O time abre o Studio para inspecionar o trace/grafo e o painel local para ver métricas
   agregadas.
7. Antes de uma mudança de prompt/modelo, o time executa a CLI de evaluation contra o
   dataset versionado e compara resultados.

### Fluxos alternativos e de exceção

- **LangSmith local indisponível:** a aplicação continua funcionando; spans são descartados
  com aviso em log, sem quebrar chat, RAG ou geração.
- **Evaluation falha:** a CLI reporta erro com diff e não bloqueia o deploy automaticamente,
  a menos que policy esteja habilitada — decisão aberta.
- **Dataset ausente:** mensagem clara instruindo a criar/versionar o dataset antes de rodar
  a evaluation.
- **Metadados obrigatórios faltando:** o span é emitido com marcador `missing` e alerta,
  em vez de falhar a requisição do usuário.
- **PII detectado em texto de prompt:** sanitizador remove ou mascarará antes de emitir o
  trace, registrando apenas o evento de sanitização.
- **Custo/latência acima do esperado:** alerta no painel local e destaque no trace.
- **Mudança de modelo:** nova versão é registrada nos metadados para comparação entre
  evaluations.

## 7. Regras e casos de borda

- Nenhum trace pode ser enviado para endpoint externo; a configuração deve falhar
  explicitamente se apontar para a nuvem sem autorização.
- `user_id` é pseudonimizado (hash estável) nos metadados; e-mail, nome e tokens nunca
  entram em spans.
- Prompt e resposta completos só entram no trace se a política de retenção permitir; por
  padrão, registrar resumo e identificadores — decisão aberta.
- Spans devem ser correlacionáveis por `conversationId`, `messageId`, `expertId` e
  `sourceId` quando aplicável.
- O custo é estimado por modelo e tokens e registrado por requisição, com arredondamento
  documentado.
- Instrumentação não pode adicionar latência relevante ao caminho crítico; emissão é
  assíncrona/buffered.
- Mudanças de esquema de metadados são versionadas para não quebrar datasets antigos.
- Evaluations devem ser determinísticas: fixed seed/temperatura quando o modelo permitir.
- O painel local deve ser acessível apenas na rede interna do Docker.

## 8. Dados e contratos

- **Entrada:** eventos e spans das cadeias LangChain.js/LangGraph das fatias 1 a 6.
- **Metadados obrigatórios:** `traceId`, `conversationId`, `messageId`, `expertId`,
  `userPseudonym`, `modelId`, `timestamp`, `status`, `latencyMs`.
- **Metadados por tipo de etapa:**
  - recuperação: `topK`, `threshold`, `scores[]`, `sourceIds[]`, `chunksConsidered`;
  - geração: `promptVersion`, `tokensIn`, `tokensOut`, `estimatedCost`, `finishReason`;
  - mídia: `mediaKind`, `modelId`, `parameters`, `sizeBytes`, `durationSeconds`;
  - fontes: `sourceId`, `sourceVersionId`, `extractionMethod`, sem hash de conteúdo, endereço ou
    trecho.
- **Datasets:** `expert-answer-quality`, `citation-fidelity`, `rag-no-answer`,
  `multimedia-intent`, versionados com nome + revisão.
- **Saída:** traces no LangSmith local, métricas/alertas no painel local, relatório de
  evaluation via CLI.
- **Eventos observáveis:** `obs.trace.emitted`, `obs.trace.dropped`,
  `obs.evaluation.started`, `obs.evaluation.completed`, `obs.pii.sanitized`.
- **Retenção:** definida em decisão aberta; padrão sugerido de 14 dias para traces e 90 dias
  para métricas agregadas.

## 9. Permissões e segurança

- LangSmith local e painel de observabilidade não devem ser expostos publicamente; acesso
  apenas via rede interna/autenticação.
- Nenhum segredo (OpenAI/Gemini API keys, tokens de sessão) em metadados ou logs.
- Pseudonimização obrigatória de usuário; nenhum dado pessoal em datasets sem consentimento
  explícito.
- Sanitização antes de emitir spans: remover e-mails, telefones, tokens e padrões de PII
  configuráveis.
- Datasets de avaliação devem usar dados sintéticos ou anonimizados.
- Backups do LangSmith local seguem a mesma política de segurança do restante da stack.
- Auditoria de configuração para garantir que o SDK nunca use endpoint cloud por padrão.

## 10. Requisitos não funcionais

- Toda a stack roda em Docker local; Compose para dev/test, com caminho futuro para
  Kubernetes em produção.
- Emissão de spans assíncrona, com overhead alvo < 50 ms por requisição.
- Painel local com retenção e consulta de logs/métricas por pelo menos 14 dias.
- Acessibilidade da documentação e do painel: contraste, navegação por teclado e textos
  descritivos — o painel é ferramenta interna, mas deve seguir o padrão do projeto.
- Evaluations via CLI executáveis em pipeline local, com saída legível e código de saída
  inequívoco.
- Compatibilidade com os modelos já definidos: `gpt-4o-mini`, `gpt-image-2` e Gemini
  estável para vídeo.
- Observabilidade da própria observabilidade: alerta se o coletor local parar de receber
  spans.

## 11. Dependências e riscos

- **Depende de:** fatia 1 (chat e Experts), fatia 5 (RAG e citações) e fatia 6 (mídia
  gerada); fundação Docker Compose do projeto.
- **Bloqueia:** nada dentro do épico; é a camada de fechamento.
- **Riscos:**
  - LangSmith self-hosted pode exigir recursos significativos — dimensionar Docker e
    documentar requisitos mínimos;
  - instrumentação pode vazar PII — sanitização e pseudonimização obrigatórias;
  - evaluations podem ser caras — limitar tamanho dos datasets e reutilizar mocks quando
    possível;
  - mudança de modelo muda custo e qualidade — versionar metadados e comparar suites;
  - evolução para Kubernetes é trabalho maior — manter configuração isolada e decidir
    depois.

## 12. Rollout e migração

- Subir LangSmith local e painel em Compose em ambiente de desenvolvimento, sem afetar o
  comportamento funcional das fatias anteriores.
- Ativar instrumentação por configuração; se o coletor estiver fora, a aplicação segue sem
  traces.
- Nenhuma migração de dados de usuário; traces antigos não existem.
- Rollback: desativar instrumentação e remover os serviços do Compose; chat, RAG e mídia
  continuam funcionando.
- Comunicação: documentar como ler traces, rodar evaluations e interpretar alertas,
  reforçando que nada vai para a LangChain Cloud.

## 13. Estratégia de teste

- **Unitário:** formatação de metadados, pseudonimização, sanitização de PII, cálculo de
  custo estimado.
- **Integração:** envio de prompt → span completo; recuperação → span com scores; geração de
  mídia → span com parâmetros; queda do coletor → aplicação continua.
- **Contract test:** esquema de metadados versionado é aceito pelo LangSmith local e pelos
  datasets.
- **E2E:** subir a stack com `bun run infra:up` do zero, enviar prompt, abrir trace no Studio, rodar
  evaluation pela CLI e visualizar métrica no painel.
- **Manual:** injetar PII no prompt, simular falha do coletor, rodar evaluation com modelo
  diferente e verificar diff.
- **Dados de teste:** datasets sintéticos, prompts de exemplo e mocks de modelo quando
  possível.

## 14. Critérios de aceite

- [ ] **BLOQUEADO** — Dada a stack subida com `bun run infra:up`, quando a aplicação envia um
      prompt, então um trace completo aparece no LangSmith local com expert, conversa, modelo e
      latência. Exige daemon Docker e imagem Enterprise licenciada; validado apenas contra coletor
      fake.
- [x] Dado um fluxo com recuperação, quando a resposta é gerada, então o trace inclui
      `topK`, `threshold`, `scores[]` e `sourceIds[]` — verificado com sink em memória.
- [ ] **PARCIAL** — Dado um fluxo de geração de mídia, quando o job termina, então o trace registra
      `mediaKind`, modelo, parâmetros e custo estimado. Contrato de metadados testado; nenhum fluxo
      da fatia 017 foi integrado ou alterado.
- [x] Dado um prompt com e-mail ou token, quando o span é emitido, então o dado é mascarado
      e apenas o evento de sanitização é registrado.
- [x] Dado o coletor LangSmith indisponível, quando o usuário envia um prompt, então o chat
      funciona normalmente e o aviso de span descartado aparece em log — verificado contra
      servidor HTTP local com falha induzida.
- [x] Dado um dataset versionado, quando a CLI de evaluation é executada, então o relatório
      mostra resultados por métrica e compara com a versão anterior (`--baseline`).
- [ ] **BLOQUEADO** — Dado um trace no Studio, quando o time o abre, então é possível inspecionar
      o grafo, os prompts e as etapas de recuperação/geração. Depende da stack licenciada.
- [ ] **FORA DESTA FATIA** — Dado um alerta de latência ou erro no painel local, quando ele
      dispara, então é possível navegar até os traces relacionados. Eventos de log emitidos;
      integração de alertas não implementada.
- [x] Dada a configuração padrão, quando a aplicação sobe, então o endpoint é local e endpoints
      cloud são rejeitados na configuração quando a flag está ligada.
- [ ] **BLOQUEADO** — Dado um usuário sem acesso à rede interna, quando ele tenta abrir o painel,
      então o acesso é negado. Bind em `127.0.0.1` declarado no override opcional; não validado em
      runtime sem a stack licenciada.

## 15. Decisões e questões abertas

| Tema                       | Decisão ou pergunta                                                                                                            | Impacto                                                           | Dono                 | Status    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------- | --------- |
| Arquitetura do LangSmith   | Modo híbrido local: Studio/CLI e LGTM agora; Evaluation/Deployment em infraestrutura dedicada/Kubernetes após validação.       | Define o escopo de infraestrutura desta fatia.                    | Solicitante          | decidida  |
| Painel de métricas         | Usar LGTM completo (Grafana + Loki + Tempo) ou apenas Grafana com Tempo?                                                       | Define recursos e complexidade do Compose.                        | Usuário + Infra      | aberta    |
| Armazenamento do LangSmith | Qual backend (SQLite/Postgres) e volume persistente usar?                                                                      | Define confiabilidade e migração futura.                          | Infra                | aberta    |
| Retenção de traces         | Por quanto tempo guardar prompts/respostas completas?                                                                          | Impacta privacidade, storage e custo.                             | Usuário + Time de IA | aberta    |
| Conteúdo em spans          | Registrar prompt/resposta completos ou apenas resumo?                                                                          | Equilibra depuração e privacidade.                                | Usuário + Time de IA | aberta    |
| Evaluations                | Quais métricas e limiares mínimos por suite?                                                                                   | Define gate de qualidade.                                         | Time de IA + Usuário | aberta    |
| Gate de deploy             | Evaluation ruim deve bloquear deploy automaticamente?                                                                          | Define o rigor do processo.                                       | Usuário              | aberta    |
| Kubernetes                 | Quando e como migrar LangSmith self-hosted para Kubernetes?                                                                    | Define esforço futuro e ambiente de produção.                     | Infra                | aberta    |
| Versão do LangSmith        | Fixar qual versão self-hosted e cadência de atualização?                                                                       | Evita quebras de esquema/API.                                     | Infra                | aberta    |
| Estratégia desta fatia     | Entregar fatia local-first com flag desligada, sink HTTP local, pseudonimização e degradação graciosa, sem novas dependências. | Entrega utilizável mesmo sem stack licenciada.                    | Usuário + OpenCode   | decidida  |
| Stack self-hosted real     | Não validada: daemon Docker indisponível e imagem Enterprise licenciada ausente; Compose opcional com profile `langsmith`.     | Studio, traces ao vivo e evaluation ao vivo ficam como follow-up. | Infra                | bloqueada |
| Evaluation offline         | 4 datasets sintéticos versionados, scorer puro determinístico e CLI local; limiar default `0.8`, configurável por dataset.     | Gate reproduzível sem chamada a modelo externo.                   | Time de IA + Usuário | decidida  |
| Persistência               | Traces não são persistidos em PostgreSQL; nenhuma migration adicionada.                                                        | Evita down-migration e dado de usuário nesta fatia.               | OpenCode             | decidida  |
| Contrato da fatia 017      | Apenas metadados de mídia declarados e testados; nenhum fluxo 017 alterado.                                                    | Preserva isolamento entre specs.                                  | OpenCode             | decidida  |
