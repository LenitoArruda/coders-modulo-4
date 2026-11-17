# Conexão de mídia como conhecimento — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-17
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 4)
> **Depende de:** `.specs/013-knowledge-files.md`
> **Plano:** `.plans/015-knowledge-media-plan.md`

## 1. Contexto e problema

`.specs/013-knowledge-files.md` cobre PDF, TXT e Markdown e `.specs/014-knowledge-url.md`
cobre páginas externas, mas o usuário também precisa conectar imagens, áudio e vídeo:
manuais fotografados, whitepapers em slides exportados como imagem, gravações de reuniões,
podcasts, demos e treinamentos em vídeo. Hoje esse conhecimento fica preso em arquivos que o
Expert não consegue consultar, e a pessoa precisa transcrever ou descrever tudo manualmente
antes de perguntar.

Sem esta fatia, o botão flutuante introduzido na fatia 2 continuaria aceitando apenas
PDF, TXT e Markdown, e a promessa de "conectar qualquer fonte" do épico não se sustenta.
O custo de não resolver é retrabalho manual e respostas incompletas dos Experts.

## 2. Usuários e jobs

- **Pessoa autenticada (qualquer papel):** adiciona arquivos de imagem, áudio ou vídeo ao
  repositório de conhecimento, espera que o Expert consiga responder perguntas sobre o conteúdo
  deles com deduplicação e status iguais aos de PDF/TXT/MD, e remove fontes que não devem mais ser
  usadas.
- **Expert (CTO, CMO, Vendas, CS, Customer Hero, CEO, CFO, COO, CPO):** consulta o
  conhecimento extraído da mídia via contrato de recuperação definido na fatia 5, sem
  precisar saber o formato original.

Todos os fluxos são isolados por usuário autenticado, conforme decidido no épico; não há
workspace nesta versão.

## 3. Resultado esperado

Ao selecionar "Image", "Audio" ou "Video" no botão flutuante de conexões, a pessoa envia
um arquivo, vê o progresso de extração e, ao terminar, a fonte aparece na lista de conexões
com status `ready` e o conteúdo extraído está disponível para recuperação. Reenviar o mesmo
arquivo não cria nova versão nem novos vetores.

Formatos aceitos nesta versão: `image/jpeg`, `image/png`, `audio/mpeg` (`.mp3`) e
`video/mp4`. A extração transforma mídia em texto via OCR (imagem) e transcrição (áudio e
vídeo); o texto resultante é fatiado, transformado em embeddings e gravado no Weaviate
usando o mesmo contrato de fonte da fatia 2. Os rótulos do botão e todas as mensagens de
interface são en-US.

## 4. Métricas de sucesso

| Métrica                                  | Linha de base           | Meta                                                                               |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Fontes de mídia processadas com sucesso  | 0                       | 95% dos envios válidos terminam com status `ready`                                 |
| Taxa de deduplicação em reenvio de mídia | 0%                      | 100% dos reenvios do mesmo hash reaproveitam a fonte                               |
| Latência de processamento                | —                       | p95 < 5 min para vídeo de 10 min; p95 < 30 s para imagem e áudio de 5 min          |
| Cobertura de respostas                   | 0 consultas sobre mídia | Consultas sobre mídia conectada retornam trecho extraído em 90% dos casos de teste |

## 5. Escopo

### Dentro

- Extensão do botão flutuante de conexões (fatia 2) com seleção de imagem, áudio e vídeo.
- Validação de tipo MIME e extensão, tamanho máximo por arquivo e duração máxima de mídia.
- Cálculo de hash do arquivo e deduplicação antes de qualquer processamento, reutilizando
  `Source` e `SourceVersion` da fatia 2.
- Extração de texto:
  - imagem: OCR;
  - áudio: transcrição de fala;
  - vídeo: transcrição de fala; trilha visual de slides pode ser tratada como decisão aberta.
- Reaproveitamento integral do pipeline de chunks, embeddings e persistência vetorial da
  fatia 2, incluindo metadados de proveniência.
- Exposição do status público da fatia 2 (`queued`, `processing`, `ready`, `failed`) na lista de
  conexões, com as fases de extração (`extracting`, `chunking`, `embedding`) como detalhe de
  progresso dentro de `processing`.
- Registro de erros de extração com mensagem legível em en-US e possibilidade de nova tentativa.
- Reutilização da operação de exclusão da fatia 2: arquivo original, todas as versões e vetores
  associados são removidos.
- Testes de validação, deduplicação e extração com mídia de pequeno porte.

### Fora

- Geração de novas imagens ou vídeos a partir de prompts — fatia 6
  (`.specs/017-multimedia-deliverables.md`).
- Citações e trechos na resposta do Expert — fatia 5 (`.specs/016-rag-citations.md`).
- Edição, rotação, corte ou conversão de mídia pelo usuário.
- Indexação de metadados de cenas, falas por timestamp ou busca semântica direta em vetores
  de imagem/vídeo.
- Suporte a formatos adicionais (`.webp`, `.wav`, `.mov`, `.avi`, `.mkv`, `.ogg`, `HEIC`).
- Processamento de arquivos corporativos compartilhados ou de workspace.
- Treinamento/fine-tuning de modelos com a mídia enviada.

## 6. Fluxos

### Fluxo principal

1. A pessoa autenticada abre `/app` e aciona o floating button de conexões.
2. Seleciona "Imagem", "Áudio" ou "Vídeo" e escolhe um arquivo local.
3. A interface valida tipo, extensão, tamanho e duração antes do upload.
4. O sistema calcula o hash do arquivo e consulta `SourceVersion` pelo hash.
5. Se existir versão `ready` ou `processing` para aquele hash, o sistema reutiliza a versão,
   exibe o status atual e não reenvia o arquivo para extração.
6. Se não existir, o arquivo é armazenado, a versão é criada com status `queued` e o job de
   extração é enfileirado, reaproveitando a regra de versão da fatia 2 quando o nome já possuir
   uma fonte.
7. O job permanece em `processing` e passa pelas fases `extracting` (OCR/transcrição), `chunking` e
   `embedding`, gravando os vetores no Weaviate com o mesmo `sourceId` e `sourceVersionId` e com os
   metadados da fatia 2.
8. Ao concluir, a versão passa a `ready` e aparece na lista de conexões com nome, tipo,
   tamanho, data e quantidade de chunks.
9. O Expert passa a poder recuperar o conteúdo extraído via contrato da fatia 2.

### Fluxos alternativos e de exceção

- **Arquivo inválido:** tipo MIME ou extensão fora da lista, acima do tamanho/duração
  máximos, ou corrompido — rejeitar antes do upload, com mensagem específica e sem criar
  fonte.
- **Falha de OCR/transcrição:** registrar erro, marcar versão como `failed`, exibir mensagem
  legível em en-US e oferecer "Try again". A nova tentativa reutiliza o mesmo `sourceId`.
- **Áudio sem fala inteligível:** transcrição vazia — marcar `failed` com mensagem
  "No speech detected"; não gravar vetores vazios.
- **Vídeo sem faixa de áudio:** mesma regra de áudio sem fala, a menos que OCR de frames
  esteja habilitado por decisão aberta.
- **Upload duplicado em concorrência:** duas requisições com o mesmo hash — ambas retornam
  a mesma versão e apenas um job de extração é criado.
- **Exclusão durante processamento:** cancelar o job, remover o arquivo temporário e os
  vetores parciais; a fonte desaparece da lista.
- **Exclusão após processamento:** remover vetores e registro da fonte, preservando o
  histórico de chat por decisão da fatia 1.
- **Serviço de extração indisponível:** manter a fonte em `queued` com retry exponencial
  limitado; após o limite, marcar `failed`.

## 7. Regras e casos de borda

- Hash é calculado sobre os bytes originais do arquivo, com o mesmo algoritmo da fatia 2,
  antes de qualquer transformação.
- O isolamento é por usuário autenticado: o mesmo hash enviado por usuários diferentes
  gera fontes distintas.
- Nomes de arquivo são higienizados para exibição; o nome original nunca é usado como
  chave de deduplicação.
- Limites sugeridos (confirmar com o usuário): 25 MB por imagem, 50 MB por áudio, 200 MB
  por vídeo, 60 min de duração para áudio/vídeo.
- Se o texto extraído for menor que o mínimo definido na fatia 2 para gerar chunks, a fonte
  é marcada como `failed` com mensagem de conteúdo insuficiente.
- Metadados de proveniência devem registrar tipo de mídia, duração (quando aplicável),
  método de extração (OCR/transcrição) e identificadores do modelo/versão usado, para
  rastreabilidade em LangSmith.
- A extração não deve alterar o arquivo original armazenado.
- A troca do modelo de OCR/transcrição para um arquivo já processado cria nova `SourceVersion`,
  conforme o contrato da fatia 2; a versão anterior fica marcada como desatualizada e seus vetores
  só são removidos com a exclusão da fonte.
- Ao excluir uma fonte, vetores parciais de jobs cancelados também devem ser removidos.
- Diferente da fatia 2, aqui não há "conteúdo inline": mídia é sempre arquivo; links para
  vídeo/áudio seguem como decisão aberta.

## 8. Dados e contratos

- **Entrada:** arquivo binário com `Content-Type`, nome original, tamanho e (para áudio/vídeo)
  duração.
- **Contrato reutilizado:** `Source`, `SourceVersion`, `Chunk`, `Document` e a operação de exclusão
  da fatia 2, acrescidos de `mediaType`, `durationSeconds`, `extractionMethod` e
  `extractionModelVersion`.
- **Armazenamento:** arquivo original em volume local do Docker; texto extraído e vetores no
  Weaviate, com `sourceId`, `sourceVersionId`, `userId`, `chunkIndex` e o hash da versão da fonte
  usado apenas para deduplicação, nunca em log ou telemetria.
- **Estados da fonte:** `queued`, `processing`, `ready`, `failed`, conforme a fatia 2; as fases
  `extracting`, `chunking` e `embedding` são detalhes de progresso de `processing`.
- **Eventos observáveis:** `media.upload.accepted`, `media.source.reused`,
  `media.extraction.started`, `media.extraction.completed`, `media.extraction.failed`,
  `media.source.deleted`.
- **Retenção:** igual à definida para fontes na fatia 2; decisão aberta específica para
  retenção de arquivos de mídia volumosos.

## 9. Permissões e segurança

- Somente usuários autenticados podem enviar, listar, reprocessar e excluir fontes de mídia.
- Cada fonte, arquivo e vetor pertence a um `user_id`; consultas e exclusões devem filtrar
  por esse identificador.
- Validar `Content-Type` e magic bytes para evitar upload disfarçado de outro formato.
- Limitar tamanho, duração e número de envios por usuário para evitar abuso de armazenamento
  e custo de transcrição.
- Não exibir logs com conteúdo de transcrições em claro em ambientes compartilhados;
  registrar apenas metadados e identificadores.
- Arquivos temporários de processamento devem ser removidos ao concluir ou falhar.

## 10. Requisitos não funcionais

- Processamento assíncrono, com retorno imediato do upload e atualização de status na UI.
- OCR e transcrição executados localmente via Docker, sem chamada a OpenAI/Gemini nesta
  fatia; modelos locais específicos ficam como decisão aberta.
- p95 de latência conforme métricas: 30 s para imagem/áudio curto, 5 min para vídeo de
  10 min.
- Reexecuções de extração devem ser idempotentes: mesmo hash e mesma versão não duplicam
  chunks nem vetores.
- Acessibilidade: seleção de arquivo com `<label>`, status anunciado via `aria-live`, erros
  associados ao campo e navegação por teclado.
- Observabilidade: cada job registra `sourceId`, `sourceVersionId`, tipo de mídia, duração e duração
  de cada etapa, sem hash de conteúdo, prontos para LangSmith (fatia 7).

## 11. Dependências e riscos

- **Depende de:** fatia 2 (`.specs/013-knowledge-files.md`) para contrato de fonte, hash,
  chunks, embeddings e exclusão; fundação de autenticação e storage local.
- **Bloqueia parcialmente:** fatia 6 quando houver geração a partir de mídia referenciada.
- **Riscos:**
  - modelos de OCR/transcrição locais podem ter precisão insuficiente em áudio ruidoso ou
    imagens de baixa qualidade — medir com conjunto de amostras e registrar confiança;
  - vídeos longos podem estourar memória — impor limites e processar em janelas;
  - custo de armazenamento e reprocessamento — deduplicação e limites por usuário;
  - mudança de modelo de extração invalida vetores antigos — criar nova `SourceVersion` conforme o
    contrato da fatia 2 e sinalizar a anterior como desatualizada.

## 12. Rollout e migração

- Habilitar os três novos tipos de conexão atrás de flag `knowledge_media_enabled`,
  desligada por padrão até validação dos modelos locais.
- Nenhuma migração de dados: a fatia 2 já define o contrato de fonte; esta fatia apenas
  adiciona campos opcionais de mídia.
- Rollback: desligar a flag e ocultar as opções de mídia; fontes já processadas continuam
  disponíveis para consulta e exclusão.
- Comunicação: avisar que vídeos e áudios são transcritos e que a qualidade depende da
  clareza da fala.

## 13. Estratégia de teste

- **Unitário:** validação de MIME/extensão/tamanho/duração, cálculo de hash, higienização de
  nome, transição de estados da fonte.
- **Integração:** upload → extração → chunks → Weaviate com imagem, áudio e vídeo pequenos;
  deduplicação; cancelamento e exclusão; isolamento entre usuários.
- **Contrato:** o mesmo `source_id`/`chunk` consumido pela fatia 2 é lido sem alterações
  pela recuperação da fatia 5.
- **E2E:** selecionar cada tipo no floating button, acompanhar status até `ready`, excluir e
  confirmar remoção da lista.
- **Manual:** áudio com ruído, vídeo sem fala, imagem com texto miúdo, reenvio duplicado em
  duas abas.
- **Dados de teste:** fixtures pequenas versionadas ou geradas (imagem com texto, áudio com
  fala sintética, vídeo com poucos segundos), sem conteúdo sensível.

## 14. Critérios de aceite

- [ ] Dado um usuário autenticado, quando ele seleciona "Imagem" e envia um PNG válido, então
      a fonte aparece na lista e termina com status `ready` após OCR.
- [ ] Dado um usuário autenticado, quando ele envia um MP3 com fala, então uma transcrição é
      extraída, fatiada e gravada no Weaviate com o `source_id` da fonte.
- [ ] Dado um usuário autenticado, quando ele envia um MP4 com fala, então uma transcrição é
      extraída e a fonte termina com status `ready`.
- [ ] Dado uma fonte de mídia já processada, quando o mesmo arquivo é enviado novamente,
      então a fonte existente é reutilizada e nenhum chunk/vetor duplicado é criado.
- [ ] Dado um arquivo com tipo MIME não suportado, quando o usuário tenta enviá-lo, então o
      upload é rejeitado com mensagem específica e nenhuma fonte é criada.
- [ ] Dado um áudio sem fala inteligível, quando a extração termina, então a versão é marcada
      como `failed` com a mensagem "No speech detected" e nenhum vetor é gravado.
- [ ] Dado dois usuários autenticados, quando ambos enviam o mesmo arquivo, então cada um vê
      apenas a sua própria fonte na lista de conexões.
- [ ] Dado um usuário autenticado, quando ele exclui uma fonte de mídia, então arquivo original,
      versões, chunks e vetores associados são removidos, a fonte desaparece da lista e o histórico
      de chat permanece.
- [ ] Dado um erro de extração, quando o usuário clica em "Try again", então um novo job é iniciado
      para o mesmo `sourceId` sem duplicar a fonte.
- [ ] Dado um usuário usando teclado, quando ele percorre o floating button e envia mídia,
      então seleção, progresso e erro são anunciados e alcançáveis.

## 15. Decisões e questões abertas

| Tema                       | Decisão ou pergunta                                                                                                                     | Impacto                                                          | Dono                 | Status   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------- | -------- |
| Modelos de OCR/transcrição | Quais modelos locais usar para imagem, áudio e vídeo?                                                                                   | Define precisão, dependências e consumo de recursos no Docker.   | Usuário + Time de IA | aberta   |
| Trilha visual do vídeo     | Além da fala, devemos aplicar OCR em frames/slides do vídeo?                                                                            | Aumenta cobertura de conteúdo, porém eleva custo e complexidade. | Usuário              | aberta   |
| Limites operacionais       | Confirmar 25 MB imagem, 50 MB áudio, 200 MB vídeo e 60 min de duração.                                                                  | Define rejeição no upload e dimensionamento do storage.          | Usuário              | aberta   |
| Mídia por URL              | Há suporte a links de áudio/vídeo ou apenas upload de arquivo?                                                                          | Amplia fontes, mas exige download seguro e validação de tipo.    | Usuário              | aberta   |
| Idioma da transcrição      | Transcrever em pt-BR, en-US ou detectar automaticamente?                                                                                | Afeta precisão e consistência dos embeddings.                    | Usuário              | aberta   |
| Retenção de mídia          | Por quanto tempo manter o arquivo original após a extração?                                                                             | Impacta storage, custo e privacidade.                            | Usuário              | aberta   |
| Versionamento da extração  | Troca do modelo de OCR/transcrição cria nova `SourceVersion` da fatia 2; a anterior fica desatualizada, sem reprocessamento automático. | Garante consistência, mas pode gerar custo de reindexação.       | Time de IA           | decidida |
