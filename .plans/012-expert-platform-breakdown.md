# Breakdown — Plataforma de Experts, conhecimento e chat local

> **Prompt original:** criar os agentes especialistas CTO, CMO, Diretor de Vendas, Diretor de
> Customer Success, Diretor de Customer Hero, CEO, CFO, COO e CPO; home simples com footer
> (dropdown de expert, área de texto e envio) e botão flutuante para adicionar conexões; conexões
> via PDF, TXT, Markdown, imagem (jpg/jpeg/png), vídeo (mp4), áudio (mp3) e URL externa;
> verificar conexão existente, extrair chunks, criar embeddings, gravar no banco de vetores e
> registrar a fonte para deduplicação; sugestões de perguntas por expert; respostas em formato de
> chat; stack LangChain.js/LangGraph/LangSmith/Weaviate instalada localmente via Docker, com
> chamadas externas apenas a OpenAI e Gemini.
> **Criado em:** 2026-11-17
> **Status:** fatia 1 (012) concluída; fatias 2–7 (013–018) aprovadas
> **Primeira spec:** `.specs/012-expert-chat.md`

## 1. Resultado do épico

Uma pessoa autenticada escolhe um dos nove Experts na home, conversa com ele em formato de chat
usando sugestões clicáveis, adiciona conhecimento por arquivos e URLs e recebe respostas apoiadas
nas fontes conectadas, com citações. Toda a stack de agentes e vetores executa localmente via
Docker; apenas as chamadas aos modelos OpenAI e Gemini saem da máquina.

## 2. Fora do épico

- Entidade de workspace ou multi-tenancy: o solicitante decidiu isolar dados por usuário
  autenticado (a hipótese de workspace em `BUSINESS.md` fica suspensa).
- Alterações nas specs de autenticação concluídas (001–010), em e-mails transacionais ou na landing
  pública; o componente de perfil/logout existente é preservado.
- Cobrança, planos, marketplace de Experts, aplicativos mobile nativos e integrações OAuth
  (Notion, Google Drive, Jira etc.) — as conexões deste épico são somente arquivos e URL.
- Escrita de volta nas fontes conectadas, sincronização incremental automática e fine-tuning.
- Edição de Experts pelo usuário final, permissões granulares por documento e papéis administrativos.
- Migração de `LangSmith` para outro provedor de observabilidade; a escolha local é tratada na
  fatia 7 e qualquer troca futura é decisão separada.

## 3. Fatias e ordem de implementação

| Ordem | Spec                                    | Capacidade entregue                                                                  | Depende de     | Status   |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------ | -------------- | -------- |
| 1     | `.specs/012-expert-chat.md`             | Catálogo dos 9 Experts, dropdown no footer, sugestões clicáveis e chat em persona    | auth existente | done     |
| 2     | `.specs/013-knowledge-files.md`         | Botão flutuante, upload de PDF/TXT/MD, dedup por hash, chunks, embeddings e fontes   | 012            | approved |
| 3     | `.specs/014-knowledge-url.md`           | Conexão por URL externa com o mesmo pipeline de deduplicação e indexação             | 013            | approved |
| 4     | `.specs/015-knowledge-media.md`         | Imagem, áudio e vídeo como fontes de conhecimento via OCR/transcrição                | 013            | approved |
| 5     | `.specs/016-rag-citations.md`           | Respostas com recuperação de contexto e citações das fontes conectadas               | 012 + 013      | approved |
| 6     | `.specs/017-multimedia-deliverables.md` | Entregáveis de imagem (`gpt-image-2`) e vídeo (Gemini, ID em decisão aberta) no chat | 012 (+015)     | approved |
| 7     | `.specs/018-langsmith-local.md`         | Rastreabilidade local, depuração no Studio e avaliação das respostas dos Experts     | 012 + 016      | approved |

Status da fatia: `done` (entregue e verificada), `approved` (pronta para executar), `existing`
(reutilizada) ou `planned` (ainda não criada).

## 4. Grafo de dependências

```text
auth existente (001–010)
        │
        ▼
      012 ──┬──► 013 ──┬──► 014
        │    │          └──► 015
        │    └──► 016 ◄──────┘
        │           │
        ├──► 017 ◄──┘ (usa 015 quando a solicitação cita mídia)
        └──► 018 ◄───── 016
```

## 5. Fundação compartilhada

- **Catálogo de Experts:** identidade, papel, escopo, tom e sugestões são introduzidos na fatia 1 e
  reutilizados pelo chat, pela recuperação de contexto, pela geração de mídia e pela avaliação.
- **Contrato de fonte de conhecimento:** `Source` + `SourceVersion` (hash do conteúdo) + chunks +
  embeddings + registro de status + exclusão de fonte é introduzido na fatia 2 e reutilizado por
  URL, mídia, citações e avaliação.
- **Já existente e reaproveitado:** sessão JWT com isolamento por usuário, padrão de vertical
  slices da API, design system light-only, componente de perfil com logout e observabilidade
  OpenTelemetry → Grafana LGTM.

## 6. Decisões do solicitante (fechadas neste breakdown)

| Tema                 | Decisão                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolamento           | Dados isolados por usuário autenticado; não há entidade workspace neste épico.                                                                                            |
| Deduplicação         | Conexão existente é determinada pelo hash do conteúdo do arquivo/URL.                                                                                                     |
| Mídia                | Imagem, áudio e vídeo entram como conhecimento **e** como geração, em fatias separadas.                                                                                   |
| LangSmith            | Abordagem híbrida local: Studio/CLI (incluindo evaluations leves via CLI) + LGTM agora; Evaluation/Deployment com infraestrutura dedicada/Kubernetes depois de validação. |
| Escopo dos 6 Experts | O agente propõe papel, tom e sugestões; o solicitante valida antes da aprovação.                                                                                          |
| Versão da fonte      | Conteúdo alterado gera nova `SourceVersion`; a anterior fica desatualizada e é sinalizada nas citações.                                                                   |
| Exclusão de fonte    | Remover fonte apaga arquivo, versões, chunks e vetores; histórico de chat permanece e a fatia 5 trata a citação órfã.                                                     |
| Sugestões da fatia 1 | Sugestões não dependem de fontes conectadas; versões com fontes entram na fatia 5.                                                                                        |

## 7. Decisões abertas

| Tema                       | Pergunta                                                                                                          | Impacto                                                            | Dono                   | Status |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- | ------ |
| Escopo dos novos Experts   | Os papéis, tons e sugestões propostos para Vendas, CS, Customer Hero, CFO, COO e CPO estão corretos?              | Define o comportamento observable de 6 dos 9 Experts               | Solicitante            | aberta |
| Sentido de "Customer Hero" | A interpretação proposta (voz do cliente, experiência, escalonamento e histórias de sucesso) está correta?        | Muda escopo e sugestões daquele Expert                             | Solicitante            | aberta |
| Modelo de embedding        | Qual modelo de embedding será usado para os chunks (a restrição é execução local, com chamada externa permitida)? | Define contrato de vetores e custo de indexação                    | Engenharia             | aberta |
| Limites operacionais       | Quais são os limites de tamanho de arquivo, duração de mídia e tamanho de prompt?                                 | Define validação, mensagens de erro e proteção de custo            | Solicitante            | aberta |
| Histórico do chat          | O histórico é agrupado por Expert ou é uma única conversa por usuário? (proposta: por Expert)                     | Define a apresentação da home ao trocar de Expert                  | Solicitante            | aberta |
| Fontes por Expert          | Todos os Experts enxergam todas as fontes do usuário ou há permit list por Expert? (proposta: todas)              | Define isolamento lógico e regras de recuperação                   | Solicitante            | aberta |
| ID do modelo de vídeo      | `gemini-omni-flash-preview` foi descontinuado; confirmar `gemini-omni-1.1-flash` como alvo.                       | Evita integrar um modelo indisponível                              | Solicitante/Engenharia | aberta |
| Metas de latência e custo  | Quais são os limites aceitáveis de latência de resposta e custo por interação?                                    | Transforma telemetria em gate de qualidade                         | Solicitante            | aberta |
| Retenção de dados          | Por quanto tempo conversas, fonte original, chunks e embeddings são mantidos?                                     | Define política de privacidade e limpeza                           | Solicitante            | aberta |
| Evolução do LangSmith      | Quando migrar do modo híbrido local para Evaluation/Deployment self-hosted completo?                              | Define necessidade de Kubernetes local e esforço de infraestrutura | Engenharia             | aberta |

## 8. Histórico

- 2026-11-17 — breakdown criado com sete fatias, decisões do solicitante registradas e lacunas
  abertas atribuídas a donos.
- 2026-11-17 — sete specs escritas em `.specs/012` a `.specs/018`, com status `draft`, caminhos
  reais no mapa e dependências apontando apenas para fatias anteriores.
- 2026-11-17 — refinamento das sete specs: `SourceVersion` e exclusão passaram a fazer parte do
  contrato da fatia 2, sugestões da fatia 1 foram reescritas sem depender de fontes e os status
  foram normalizados para `queued`/`processing`/`ready`/`failed`.
- 2026-11-17 — fatia 1 aprovada pelo solicitante; spec 012 passou a `implementing` e o plano de
  execução foi criado em `.plans/012-expert-chat-plan.md`.
