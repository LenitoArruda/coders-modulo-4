# Respostas com recuperação e citações — Spec

> **Status:** done
> **Atualizado em:** 2026-11-18
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 5)
> **Depende de:** `.specs/012-expert-chat.md`, `.specs/013-knowledge-files.md`
> **Plano:** `.plans/016-rag-citations-plan.md`

## 1. Contexto e problema

As fatias 1 a 4 entregam chat com Experts, fontes de conhecimento (PDF, TXT, Markdown, URL,
imagem, áudio e vídeo) e vetores no Weaviate, mas o Expert da fatia 1 ainda responde sem
consultar esse conhecimento. Na prática, a pessoa conecta documentos e continua recebendo
respostas genéricas, sem saber se o modelo usou o material conectado ou de onde veio cada
afirmação.

Sem esta fatia, o valor do repositório de conhecimento não aparece na resposta: não há
rastreabilidade, não há como conferir a origem e não há sinal de que fontes desatualizadas
estão sendo usadas. Isso corrói a confiança no produto e dificulta a adoção pelos Experts de
negócio (CTO, CMO, Vendas, CS e demais).

## 2. Usuários e jobs

- **Pessoa autenticada:** faz perguntas ao Expert e quer respostas fundamentadas nas fontes
  que ela conectou, com links/nomes para conferir cada trecho, e consegue identificar fontes
  desatualizadas ou de baixa qualidade.
- **Expert (qualquer um dos 9):** deve responder no próprio papel e tom, usando o
  conhecimento disponível quando relevante e dizendo claramente quando não há base para
  responder.
- **Time de produto/IA:** observa recuperação e geração para avaliar qualidade e evolução
  (preparação para a fatia 7).

## 3. Resultado esperado

Ao enviar um prompt no chat, o Expert recupera trechos relevantes das fontes conectadas pelo
mesmo usuário, injeta esses trechos no contexto e responde em formato de chat com citações
inline referenciando `source_id` e `chunk_index`. Cada citação permite abrir o trecho
original (nome da fonte, tipo, página/trecho quando disponível). Se não houver trechos
relevantes acima de um limiar de similaridade, o Expert responde que não encontrou base no
conhecimento conectado, sem inventar citações.

O comportamento continua idêntico ao da fatia 1 para quem não tem fontes conectadas: chat,
sugestões, dropdown de expert e histórico permanecem funcionando.

## 4. Métricas de sucesso

| Métrica                                                               | Linha de base | Meta                                       |
| --------------------------------------------------------------------- | ------------- | ------------------------------------------ |
| Respostas com pelo menos uma citação válida quando há fonte relevante | 0%            | ≥ 90% em conjunto de perguntas de teste    |
| Precisão das citações (trecho citado sustenta a afirmação)            | —             | ≥ 85% avaliado por revisão humana          |
| Taxa de respostas sem base quando não há fonte relevante              | —             | 100% nos casos sem trecho acima do limiar  |
| Latência adicional de recuperação + geração                           | —             | p95 < 4 s para consultas com até 20 chunks |
| Alucinação de citação (citou fonte inexistente)                       | —             | 0%                                         |

## 5. Escopo

### Dentro

- Pipeline de RAG: embedding da pergunta → busca vetorial no Weaviate filtrada por
  `user_id` → seleção dos `k` trechos mais relevantes → montagem do prompt com contexto →
  geração via `gpt-4o-mini`.
- Limiar mínimo de similaridade e top-k configuráveis; quando nenhum trecho passa no limiar,
  o Expert responde sem base.
- Citações inline no formato `[1]`, `[2]` com mapeamento para `source_id`, `chunk_index`,
  nome da fonte, tipo e localização (página, linha ou timestamp quando disponível).
- Painel/lista de fontes citadas abaixo da resposta, abrindo o trecho original em modal ou
  painel lateral.
- Reutilização do histórico de conversa da fatia 1 para manter contexto da conversa.
- Metadados de recuperação registrados na mensagem do assistente, prontos para avaliação e
  LangSmith (fatia 7).
- Tratamento de fontes desatualizadas: exibir aviso quando a `SourceVersion` citada não for mais a
  versão atual da fonte, conforme o contrato da fatia 2.
- Tratamento de citação órfã: quando a fonte tiver sido excluída pela fatia 2, manter o texto da
  citação no histórico e desabilitar o link com aviso em en-US, sem recriar a fonte.
- Testes de recuperação, citação, citação órfã e fallback sem fonte.

### Fora

- Reordenação com modelos cross-encoder ou reranking avançado — pode evoluir depois.
- Busca híbrida (keyword + vetorial) e filtros por tipo de fonte na interface.
- Citações em respostas de geração de imagem/vídeo da fatia 6.
- Treinamento/fine-tuning com as conversas.
- Compartilhamento de citações fora da plataforma.
- Suporte a múltiplos idiomas de prompt além dos já previstos na fatia 1.
- Definição final de políticas de retenção de logs de prompt/resposta — tratada na fatia 7.

## 6. Fluxos

### Fluxo principal

1. A pessoa autenticada seleciona um Expert e envia um prompt (digitado ou sugestão).
2. O sistema gera o embedding do prompt e consulta o Weaviate filtrando por `user_id`.
3. Os `k` trechos com similaridade acima do limiar são selecionados e ordenados.
4. O sistema monta o prompt do Expert com: papel/tom (fatia 1), histórico recente da
   conversa, trechos recuperados numerados e instrução para citar usando `[n]`.
5. O modelo `gpt-4o-mini` gera a resposta em formato de chat.
6. A interface renderiza a resposta com citações inline clicáveis e a lista de fontes
   citadas abaixo.
7. A mensagem do assistente é persistida no histórico com metadados de recuperação e
   citações.

### Fluxos alternativos e de exceção

- **Sem fontes conectadas:** pular a recuperação e responder como na fatia 1, sem bloco de
  fontes.
- **Nenhum trecho acima do limiar:** o Expert responde explicitamente que não encontrou base
  no conhecimento conectado e sugere conectar uma fonte ou reformular a pergunta; nenhuma
  citação é exibida.
- **Poucos trechos relevantes:** responder com os trechos disponíveis e sinalizar que a base
  é limitada.
- **Fonte desatualizada:** se o trecho pertence a `SourceVersion` que não é a atual, exibir aviso
  ao lado da citação.
- **Fonte excluída durante a conversa:** o histórico mantém a citação como texto, mas o link
  para o trecho original é desabilitado com mensagem "Source removed".
- **Falha no Weaviate:** registrar erro, responder que a busca falhou e oferecer nova
  tentativa; não inventar citações.
- **Falha na geração (OpenAI):** erro legível no chat, sem salvar resposta parcial como se
  fosse válida.
- **Prompt muito longo:** limitar histórico e trechos ao budget de tokens, priorizando os
  trechos mais recentes e relevantes.

## 7. Regras e casos de borda

- Toda recuperação é obrigatoriamente filtrada por `user_id`; nunca misturar fontes de
  usuários diferentes.
- O modelo deve citar apenas trechos efetivamente injetados no prompt; citação fora do
  intervalo `[1..k]` é inválida e deve ser removida ou gerar aviso.
- Trechos duplicados ou com overlap muito alto devem ser deduplicados antes da injeção.
- Ordem das citações deve seguir a ordem de relevância definida na recuperação, não a ordem
  de aparição no texto.
- Se o prompt pedir explicitamente para ignorar fontes, o sistema ainda recupera, mas pode
  responder sem citações — decisão aberta.
- Citações não podem conter dados sensíveis de metadados internos (por exemplo, caminho
  absoluto do arquivo no servidor).
- Respostas devem manter o papel e o tom do Expert selecionado, mesmo quando baseadas em
  trechos técnicos.
- Limiar e top-k são configurações centrais, não por expert, nesta versão.
- Mensagens do assistente sem citação devem ser distinguíveis no histórico como
  "sem fonte"/"com fonte" para facilitar avaliação.

## 8. Dados e contratos

- **Entrada:** `prompt`, `expertId`, `conversationId`, `user_id` e histórico recente.
- **Saída:** mensagem do assistente com `content`, `citations[]`, `retrieval` e `status`.
- **Estrutura de citação:**
  `{ citationNumber, sourceId, sourceVersionId, chunkIndex, sourceName, sourceType,
 location, snippet, isStale, sourceRemoved }`.
  `isStale` é `true` quando `sourceVersionId` não é a versão atual da fonte; `sourceRemoved` é
  `true` quando a fonte foi excluída e o trecho original não pode mais ser aberto.
- **Metadados de recuperação:** `queryEmbeddingModel`, `vectorIndex`, `topK`, `threshold`,
  `scores[]`, `latencyMs`, `chunksConsidered`, sem hash de conteúdo.
- **Armazenamento:** histórico de conversa da fatia 1 estendido com `citations` e
  `retrieval`; vetores e fontes permanecem nas fatias 2 a 4.
- **Eventos observáveis:** `rag.retrieval.started`, `rag.retrieval.completed`,
  `rag.retrieval.no_match`, `rag.generation.started`, `rag.generation.completed`,
  `rag.citation.invalid`.
- **Retenção:** igual à do histórico de chat da fatia 1; metadados de recuperação seguem a
  política definida na fatia 7.

## 9. Permissões e segurança

- A recuperação só acessa fontes do `user_id` autenticado; filtro obrigatório no Weaviate.
- O trecho exibido na citação deve ser o mesmo usado no prompt, sem reformulação que possa
  alterar o sentido.
- Não exibir caminhos de sistema de arquivos, tokens ou metadados internos na interface.
- Prompts e trechos injetados são dados não confiáveis: instruções dentro de fontes
  conectadas não podem alterar o papel do Expert nem a política de citação.
- Limitar tamanho do prompt e quantidade de histórico para evitar abuso de custo.
- Registrar erros sem incluir conteúdo integral de prompts sensíveis em logs compartilhados.

## 10. Requisitos não funcionais

- Latência p95 < 4 s para recuperação + geração com até 20 chunks.
- Busca vetorial com filtro por usuário deve usar índice adequado no Weaviate.
- Geração via `gpt-4o-mini`; embeddings reutilizam o modelo definido na fatia 2.
- Degradação graciosa: falha do vetorial não impede o chat básico da fatia 1.
- Acessibilidade: citações são botões/links com texto descritivo, `aria-label` e foco
  visível; painel de fonte pode ser fechado por `Esc`.
- Observabilidade: cada mensagem assistida registra identificadores de conversa, expert,
  fontes e latências de recuperação/geração para a fatia 7.

## 11. Dependências e riscos

- **Depende de:** fatia 1 (chat, experts, histórico) e fatia 2 (contrato de fonte, chunks,
  embeddings, Weaviate); fatias 3 e 4 ampliam a base de fontes, mas não são pré-requisito
  técnico para o mecanismo de citação.
- **Bloqueia:** fatia 7, que avalia e observa recuperação e geração.
- **Riscos:**
  - citações incorretas reduzem confiança mais do que ausência delas — validar com conjunto
    de perguntas e respostas de referência;
  - prompts muito longos elevam custo e latência — controlar budget de tokens;
  - fontes desatualizadas podem gerar respostas obsoletas — sinalizar versão antiga;
  - injeção de prompt via documento conectado — tratar conteúdo recuperado como dados.

## 12. Rollout e migração

- Habilitar RAG e citações com a flag `RAG_CITATIONS_ENABLED`, desligada por padrão; quando
  desligada, o chat se comporta exatamente como na fatia 1.
- A migração `0004_rag_citations.sql` é aditiva: mensagens antigas seguem sem citações; novas
  mensagens passam a incluir os campos opcionais quando a recuperação é executada.
- Rollback: desligar a flag; histórico com citações continua legível, mas novas respostas
  voltam ao modo fatia 1.
- Comunicação: explicar que o Expert agora procura nas fontes conectadas e mostra de onde
  tirou cada informação.

## 13. Estratégia de teste

- **Unitário:** montagem do prompt, numeração de citações, validação de intervalo,
  deduplicação de chunks, detecção de fonte antiga.
- **Integração:** pergunta com fonte relevante, sem fonte, com fonte excluída e com falha do
  Weaviate; isolamento entre usuários.
- **Avaliação:** conjunto de perguntas com respostas e citações de referência; medir
  precisão de citação e taxa de fallback.
- **E2E:** digitar e clicar em sugestão, ver citações inline, abrir painel da fonte, fechar
  com `Esc` e conferir persistência no histórico.
- **Manual:** documento com instruções maliciosas, prompt muito longo, fonte desatualizada,
  desconexão do vetorial durante a resposta.
- **Dados de teste:** fontes pequenas com trechos numerados e respostas esperadas,
  incluindo caso sem correspondência.

## 14. Critérios de aceite

- [x] Dado um usuário com fontes conectadas, quando ele envia uma pergunta sobre o conteúdo,
      então o Expert responde com pelo menos uma citação válida `[n]`.
- [x] Dado uma citação exibida, quando o usuário clica nela, então o trecho original da fonte
      é aberto com nome, tipo e localização.
- [x] Dado um usuário sem fontes conectadas, quando ele envia uma pergunta, então o Expert
      responde como na fatia 1 e nenhum bloco de fontes é exibido.
- [x] Dado um prompt sem trecho relevante acima do limiar, quando o Expert responde, então
      ele afirma não ter encontrado base e não exibe citações.
- [x] Dado um trecho recuperado de `SourceVersion` antiga, quando ele é citado, então a
      interface exibe aviso de fonte desatualizada.
- [x] Dado uma fonte excluída após uma resposta citada, quando a conversa é recarregada, então o
      texto da citação permanece, o link é desabilitado e a interface exibe "Source removed".
- [x] Dado dois usuários autenticados, quando um faz pergunta sobre fonte do outro, então a
      recuperação não retorna essa fonte.
- [x] Dado o Weaviate indisponível, quando o usuário envia uma pergunta, então o sistema
      exibe erro legível e oferece nova tentativa, sem inventar citações.
- [x] Dado um documento conectado com instrução para ignorar o papel do Expert, quando ele é
      recuperado, então o Expert mantém papel, tom e regras de citação.
- [x] Dado uma resposta com citações, quando a conversa é recarregada, então as citações e os
      metadados de recuperação continuam disponíveis no histórico.
- [x] Dado um usuário usando teclado, quando ele percorre as citações, então cada uma tem
      texto descritivo, foco visível e o painel pode ser fechado com `Esc`.

## 15. Decisões e questões abertas

| Tema                      | Decisão                                                                                                                     | Impacto                                     | Dono                 | Status   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- | -------- |
| Parâmetros de recuperação | `RAG_TOP_K = 5` e `RAG_THRESHOLD = 0.35` (certainty do Weaviate), ambos configuráveis.                                      | Afeta precisão, cobertura e custo.          | Time de IA + Usuário | decidida |
| Formato da citação        | `[n]` inline, com citações válidas também listadas no painel lateral de fontes.                                             | Define renderização no chat e no histórico. | Usuário              | decidida |
| Abertura do trecho        | Painel lateral (drawer), com nome, tipo, localização e trecho exato; fechamento por `Esc`.                                  | Define UX e acessibilidade.                 | Usuário              | decidida |
| Fonte desatualizada       | Aviso "Outdated source" na citação quando `SourceVersion` não é a atual; sem bloqueio nem reprocessamento automático.       | Define política de confiança.               | Usuário + Time de IA | decidida |
| Prompt contra fontes      | A recuperação sempre ocorre com a flag ligada; mensagem e trechos são dados não confiáveis e não alteram regras de citação. | Evita conflito com a fundamentação.         | Usuário              | decidida |
| Modelo de embedding       | `text-embedding-3-small`, o mesmo da fatia 013, também para a consulta.                                                     | Garante compatibilidade dos vetores.        | Time de IA           | decidida |
| Orçamento de tokens       | Até 6 mensagens recentes e 6.000 caracteres de contexto recuperado por resposta.                                            | Controla custo e latência.                  | Time de IA           | decidida |
