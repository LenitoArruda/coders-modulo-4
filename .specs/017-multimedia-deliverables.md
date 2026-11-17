# Entregáveis multimídia no chat — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-17
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 6)
> **Depende de:** `.specs/012-expert-chat.md`; usa `.specs/015-knowledge-media.md` quando há referência de mídia
> **Plano:** `.plans/017-multimedia-deliverables-plan.md`

## 1. Contexto e problema

As fatias anteriores cobrem chat com Experts, conexão de fontes e respostas com citações.
Porém, vários papéis do catálogo — principalmente CMO, Customer Hero e Vendas — precisam de
entregáveis visuais: uma imagem para campanha, um thumb de vídeo, um storyboard ou um clipe
curto a partir de um briefing. Hoje a pessoa descreve o que quer, recebe texto do Expert e
precisa sair da plataforma para gerar o material, perdendo contexto e rastreabilidade.

Sem esta fatia, o chat não fecha o ciclo "pergunta → conhecimento → entregável", e os
Experts de marketing e experiência do cliente entregam apenas texto onde o negócio espera
mídia. O custo de não resolver é fricção, troca de ferramentas e perda do histórico do que
foi gerado e por quê.

## 2. Usuários e jobs

- **Pessoa autenticada:** pede ao Expert uma imagem ou um vídeo curto diretamente no chat,
  informa o briefing em linguagem natural e recebe o arquivo gerado com opção de download.
- **CMO / Customer Hero / Vendas:** usam entregáveis visuais para campanhas, histórias de
  sucesso, apresentações e materiais de apoio, mantendo o tom do Expert.
- **Expert (demais papéis):** podem gerar mídia quando fizer sentido no próprio papel, sem
  mudar o comportamento padrão de resposta textual.
- **Time de IA/observabilidade:** acompanha custo, latência e qualidade das gerações para a
  fatia 7.

## 3. Resultado esperado

Ao pedir, por exemplo, "Create an image for the launch post" ou "Generate a short video about
this topic", o Expert interpreta o pedido, confirma os parâmetros essenciais quando falta
informação, gera o arquivo e o anexa à resposta no chat com preview, nome, formato,
tamanho e botão de download. A geração é assíncrona com status visível e falhas são
explicadas sem deixar o chat em estado inconsistente. Toda a copy de interface e as mensagens
de erro são en-US.

Quando o pedido referencia uma fonte de mídia conectada (fatia 4), o Expert pode usá-la como
referência — por exemplo, gerar uma variante visual a partir de uma imagem conectada ou um
clipe a partir de um vídeo de treinamento — respeitando o contrato de recuperação da fatia 5
para citar a origem quando aplicável.

## 4. Métricas de sucesso

| Métrica                                          | Linha de base | Meta                                             |
| ------------------------------------------------ | ------------- | ------------------------------------------------ |
| Pedidos de mídia convertidos em arquivo entregue | 0%            | ≥ 90% dos pedidos válidos                        |
| Latência de geração de imagem                    | —             | p95 < 30 s                                       |
| Latência de geração de vídeo curto               | —             | p95 < 4 min para clipe de até 8 s                |
| Taxa de falha com mensagem legível               | —             | 100% das falhas exibem erro acionável            |
| Arquivos persistidos no histórico                | 0             | 100% das gerações concluídas anexadas à conversa |

## 5. Escopo

### Dentro

- Detecção de intenção de geração de mídia no prompt, preservando o papel e o tom do Expert.
- Geração de imagem via `gpt-image-2` (referência encontrada em websearch, confirmação final em
  decisão aberta) e de vídeo via modelo Gemini estável — identificação final do modelo é decisão
  aberta.
- Parâmetros controlados pelo Expert a partir do briefing: estilo, formato/tamanho da imagem,
  duração e resolução do vídeo, dentro de limites predefinidos.
- Confirmação rápida quando o pedido é ambíguo em ponto crítico (por exemplo, ausência de
  tema ou de formato), sem transformar o chat em formulário longo.
- Geração assíncrona com estados `queued`, `generating`, `ready`, `failed` e progresso
  visível na mensagem.
- Anexo no chat com preview, metadados (modelo, parâmetros, data) e botão de download.
- Persistência do arquivo gerado e dos metadados no histórico da conversa da fatia 1.
- Uso opcional de mídia conectada como referência, via contrato da fatia 4 e citação da
  fatia 5 quando houver proveniência.
- Registro de custo, latência e parâmetros para observação/avaliação na fatia 7.
- Testes de geração com prompts controlados, fallback e isolamento entre usuários.

### Fora

- Edição de imagem/vídeo gerados (inpainting, corte, troca de cena) pelo usuário.
- Upload de mídia gerada para o repositório de conhecimento como nova fonte automática.
- Geração de áudio/música ou narração (TTS) — pode evoluir depois.
- Renderização de slides, PDFs ou documentos a partir de mídia gerada.
- Escolha de estilo por interface visual avançada (presets, sliders, biblioteca de estilos).
- Compartilhamento público ou geração de links externos para os arquivos.
- Treinamento de modelos com o conteúdo gerado.
- Definição final de retenção de arquivos gerados — tratada em decisão aberta.

## 6. Fluxos

### Fluxo principal

1. A pessoa autenticada seleciona um Expert e pede uma imagem ou vídeo no chat.
2. O Expert interpreta o briefing, mantém papel/tom e identifica parâmetros ausentes.
3. Se faltar informação crítica, o Expert faz uma pergunta curta de confirmação; caso
   contrário, segue para a geração.
4. O sistema cria a mensagem de mídia com status `queued` e enfileira o job.
5. O job chama o modelo correspondente (`gpt-image-2` para imagem; Gemini estável para
   vídeo), com parâmetros validados e limites aplicados.
6. Ao concluir, o arquivo é armazenado, a mensagem passa a `ready` e o chat exibe preview,
   metadados e botão de download.
7. A mensagem e os metadados são persistidos no histórico da conversa.

### Fluxos alternativos e de exceção

- **Pedido ambíguo:** o Expert faz uma pergunta de confirmação e aguarda a resposta antes de
  gerar, sem criar job.
- **Pedido misto:** o usuário pede texto e mídia na mesma mensagem — o Expert responde o
  texto e inicia a geração, mantendo os dois elementos na mesma conversa.
- **Referência a fonte conectada:** o sistema recupera o trecho/arquivo pela fatia 5, passa
  como referência ao modelo e registra citação quando a origem influencia o resultado.
- **Falha de geração:** mensagem com erro legível em en-US, sem arquivo parcial; botão "Try again"
  reutiliza os parâmetros.
- **Modelo indisponível ou cota excedida:** erro específico, sem retry infinito; registrar
  evento para observabilidade.
- **Conteúdo recusado pelo modelo:** mensagem explicando que o pedido foi recusado e
  sugerindo reformulação, sem expor detalhes internos do filtro.
- **Cancelamento:** o usuário pode cancelar um job em andamento; o parcial é descartado e a
  mensagem é marcada como cancelada.
- **Exclusão da conversa:** arquivos gerados são removidos conforme política de retenção.
- **Download falha:** erro legível e nova tentativa sem regenerar o arquivo.

## 7. Regras e casos de borda

- A geração só acontece mediante intenção clara do usuário; o Expert não gera mídia
  espontaneamente em respostas textuais.
- Parâmetros devem ser validados contra limites: tamanho máximo de imagem, duração máxima de
  vídeo e resolução suportada. Pedidos acima do limite recebem sugestão de ajuste.
- A resposta deve manter o papel/tom do Expert e explicar brevemente o que foi gerado.
- A geração é assíncrona: a interface nunca fica bloqueada esperando o modelo.
- Cada arquivo gerado recebe identificador único e é vinculado ao `user_id` e à mensagem.
- Metadados devem registrar modelo, versão, parâmetros, duração, custo estimado e latência.
- Se a referência conectada for removida durante a geração, a geração prossegue com o que já
  foi recuperado, mas a citação é marcada como fonte removida.
- Não exibir prompt completo do usuário em logs compartilhados; registrar resumo e IDs.
- Arquivos gerados não entram automaticamente no Weaviate.
- Conteúdo gerado é tratado como resultado, não como fonte de verdade para citações.

## 8. Dados e contratos

- **Entrada:** `prompt`, `expertId`, `conversationId`, `user_id`, parâmetros opcionais e
  referências opcionais a fontes (`sourceId`, `chunkIndex`).
- **Saída:** mensagem do assistente com `content` textual, `media` anexado e `status`.
- **Estrutura de mídia:**
  `{ mediaId, kind: 'image' | 'video', uri, mimeType, sizeBytes, width, height,
 durationSeconds, modelId, modelVersion, parameters, createdAt, citation? }`.
- **Estados:** `queued`, `generating`, `ready`, `failed`, `cancelled`.
- **Armazenamento:** arquivos em volume local do Docker; metadados no histórico de conversa.
- **Eventos observáveis:** `media_generation.requested`, `media_generation.started`,
  `media_generation.completed`, `media_generation.failed`, `media_generation.cancelled`,
  `media_generation.downloaded`.
- **Retenção:** igual à do histórico de chat, com decisão aberta específica para arquivos
  grandes gerados.

## 9. Permissões e segurança

- Somente o `user_id` autenticado pode ver, baixar e excluir os arquivos gerados em sua
  conversa.
- Rotas de download devem validar autenticação e posse do arquivo; não usar URLs públicas
  previsíveis.
- Validar e limitar parâmetros e tamanho do briefing para evitar custo abusivo.
- Aplicar filtros de segurança do provedor e tratar recusas com mensagem legível.
- Referências a fontes conectadas devem respeitar o isolamento por usuário da fatia 5.
- Não permitir que conteúdo de fontes conectadas altere parâmetros de geração ou o papel do
  Expert.
- Registrar custo e modelo por geração para controle de orçamento.

## 10. Requisitos não funcionais

- Geração de imagem via `gpt-image-2`, com chamada exclusiva à OpenAI.
- Geração de vídeo via Gemini estável (ID final em decisão aberta), com chamada exclusiva ao
  Google; todo o resto roda local em Docker.
- p95 de latência: 30 s para imagem; 4 min para vídeo curto de até 8 s.
- Jobs assíncronos com retry limitado e cancelamento; sem bloqueio da interface.
- Acessibilidade: preview com `alt` descritivo, status anunciado via `aria-live`, download
  com texto claro e navegação por teclado.
- Observabilidade: registrar modelo, parâmetros, custo, latência e resultado para a fatia 7.
- Limites de cota por usuário para conter custo de OpenAI/Gemini.

## 11. Dependências e riscos

- **Depende de:** fatia 1 (chat, Experts, histórico); fatia 4 quando houver referência de
  mídia; fatia 5 quando a referência precisar ser citada.
- **Bloqueia:** nada diretamente; alimenta a fatia 7 com eventos de geração.
- **Riscos:**
  - custo imprevisível de vídeo — limitar duração, resolução e cota por usuário;
  - ID/modelo de vídeo pode mudar — manter configuração externa e decisão aberta;
  - recusas de segurança podem frustrar usuários — mensagens claras e sugestão de
    reformulação;
  - prompts ambíguos geram resultados ruins — confirmação curta antes de gerar;
  - arquivos gerados podem crescer — retenção e limpeza definidas em decisão aberta.

## 12. Rollout e migração

- Flag `multimedia_deliverables_enabled`, desligada por padrão; quando desligada, o Expert responde
  apenas texto, como nas fatias anteriores.
- Habilitar primeiro geração de imagem; vídeo entra em seguida após validação do modelo e
  dos limites de custo.
- Nenhuma migração de dados: mensagens com `media` são um campo opcional no histórico.
- Rollback: desligar a flag; mensagens antigas com mídia continuam baixáveis até a política
  de retenção.
- Comunicação: deixar claro que imagem usa OpenAI, vídeo usa Gemini e que há limites de
  duração e cota.

## 13. Estratégia de teste

- **Unitário:** detecção de intenção, validação de parâmetros, montagem de metadados,
  transições de estado.
- **Integração:** geração de imagem e vídeo com mocks das APIs, persistência do arquivo,
  download autenticado, cancelamento e retry.
- **Contrato:** referência a fonte conectada gera citação válida da fatia 5 quando aplicável.
- **E2E:** pedir imagem, ver status até `ready`, abrir preview, baixar, recarregar conversa e
  confirmar anexo; repetir para vídeo.
- **Manual:** pedido ambíguo, parâmetro acima do limite, recusa do modelo, falha de cota e
  fonte removida durante geração.
- **Dados de teste:** prompts controlados com saídas pequenas, mocks de provedor e arquivos
  temporários limpos ao final.

## 14. Critérios de aceite

- [ ] Dado um usuário autenticado, quando ele pede "create a launch image for social media",
      então o Expert gera uma imagem com `gpt-image-2` e a exibe no chat com preview e download.
- [ ] Dado um usuário autenticado, quando ele pede um vídeo curto sobre um tema, então o
      modelo Gemini gera um clipe dentro do limite de duração e o anexo aparece no chat.
- [ ] Dado um pedido sem informação crítica, quando o Expert processa o prompt, então ele faz
      uma pergunta curta de confirmação e não inicia geração.
- [ ] Dado um job em andamento, quando o usuário acompanha a mensagem, então o status muda de
      `queued` para `generating` e, ao concluir, para `ready`.
- [ ] Dado uma falha de geração, quando o erro ocorre, então a mensagem exibe erro legível em
      en-US e oferece "Try again" sem arquivo parcial.
- [ ] Dado um pedido acima do limite de duração ou tamanho, quando o sistema valida, então o
      Expert sugere um ajuste e não envia a requisição ao modelo.
- [ ] Dado um usuário autenticado, quando ele recarrega a conversa, então os arquivos gerados
      continuam disponíveis para download com seus metadados.
- [ ] Dado outro usuário autenticado, quando ele tenta baixar o arquivo gerado, então o acesso
      é negado.
- [ ] Dado um pedido que referencia uma imagem conectada, quando a geração usa essa
      referência, então a citação da fonte aparece junto ao entregável.
- [ ] Dado um usuário usando leitor de tela, quando a mídia é exibida, então o preview tem
      texto alternativo e o status é anunciado.

## 15. Decisões e questões abertas

| Tema                 | Decisão ou pergunta                                                                                                             | Impacto                                     | Dono                 | Status |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- | ------ |
| Modelo de vídeo      | Confirmar `gemini-omni-1.1-flash` (referência estável encontrada) como ID final; `gemini-omni-flash-preview` foi descontinuado. | Define compatibilidade, custo e qualidade.  | Usuário + Time de IA | aberta |
| Modelo de imagem     | Confirmar `gpt-image-2` como definitivo e tamanhos suportados.                                                                  | Define parâmetros e custo por imagem.       | Usuário              | aberta |
| Limites de geração   | Definir duração máxima do vídeo, resolução e tamanho da imagem.                                                                 | Controla latência e custo.                  | Usuário + Time de IA | aberta |
| Cota por usuário     | Quantas imagens/vídeos por período?                                                                                             | Evita abuso e estouro de orçamento.         | Usuário              | aberta |
| Confirmação          | Quando o Expert deve perguntar antes de gerar?                                                                                  | Equilibra fricção e qualidade do resultado. | Usuário              | aberta |
| Referência de mídia  | Como exatamente usar imagem/vídeo conectado como referência?                                                                    | Define contrato com as fatias 4 e 5.        | Time de IA           | aberta |
| Retenção de arquivos | Por quanto tempo manter mídia gerada no storage local?                                                                          | Impacta storage, custo e privacidade.       | Usuário              | aberta |
| Exibição no chat     | Preview inline, galeria na conversa ou ambos?                                                                                   | Impacta UX e acessibilidade.                | Usuário              | aberta |
