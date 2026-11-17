# Fontes de conhecimento por arquivo — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-17
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 2)
> **Depende de:** `.specs/012-expert-chat.md`
> **Plano:** `.plans/013-knowledge-files-plan.md`

## 1. Contexto e problema

A fatia 1 entrega Experts que respondem sem contexto próprio. Isso reproduz exatamente a dor descrita
em `.docs/BUSINESS.md`: ferramentas de IA genéricas não conhecem os dados da empresa, e lideranças
gastam tempo consolidando informações manualmente antes de analisar.

Sem esta fatia, a pessoa não consegue transformar documentos que já possui em contexto utilizável
pelos Experts. A ausência de deduplicação agrava o problema: reenviar o mesmo arquivo criaria fontes
duplicadas, vetores redundantes e respostas com citações repetidas nas fatias seguintes. Esta é a
primeira fatia de dados do épico e introduz o contrato de fonte — incluindo versionamento,
exclusão, chunks e embeddings — reutilizado pelas fatias 3 a 7.

## 2. Usuários e jobs

| Usuário                           | Job                                                                 | Frequência |
| --------------------------------- | ------------------------------------------------------------------- | ---------- |
| Pessoa autenticada com documentos | Tornar relatórios e notas disponíveis como contexto para os Experts | Ocasional  |
| Pessoa que reenvia um arquivo     | Confirmar que o conteúdo já está conectado, sem duplicação          | Eventual   |
| Pessoa que envia arquivo inválido | Entender o que aconteceu e como corrigir                            | Eventual   |

Permissões: apenas a pessoa autenticada vê, conecta e acompanha suas próprias fontes; não há
compartilhamento entre usuários nesta fatia.

## 3. Resultado esperado

A home privada passa a ter um botão flutuante que abre a opção de adicionar conexões. A pessoa
seleciona arquivos PDF, TXT ou Markdown. Para cada arquivo, o sistema calcula o hash do conteúdo e
verifica se aquela conexão já existe para o usuário:

- **Já existe:** nenhum chunk ou embedding é criado novamente; a pessoa é informada em en-US de que
  o conteúdo já está conectado ("Already connected") e a versão existente é reaproveitada.
- **Não existe:** o conteúdo é extraído em chunks, geram-se embeddings, os vetores são gravados no
  Weaviate local e a versão é registrada no banco de dados local para deduplicação futura.

Uma `Source` agrupa as versões de uma mesma conexão do usuário; cada conteúdo distinto gera uma
`SourceVersion` identificada pelo hash. Se um arquivo com o mesmo nome normalizado já possui uma
fonte e o conteúdo mudou, uma nova versão é criada e a anterior deixa de ser a atual — citações
feitas sobre a versão antiga passam a ser sinalizadas como desatualizadas na fatia 5. O nome do
arquivo agrupa versões; ele não identifica duplicata, que continua sendo determinada pelo hash.

A pessoa acompanha o status de cada versão (`queued`, `processing`, `ready` ou `failed`) e vê a
lista de fontes conectadas, com nome, tipo, tamanho, versão atual e quantidade de chunks. A pessoa
também pode remover uma fonte, o que apaga arquivo, versões, chunks e vetores associados. Nenhum
conteúdo de arquivo é exibido em log.

## 4. Métricas de sucesso

Eventos a serem medidos, sem meta numérica inventada nesta fatia:

- Arquivo enviado, conexão reaproveitada por deduplicação, fonte indexada e fonte com falha.
- Quantidade de chunks gerados por arquivo e duração do processamento.
- Proporção de envios que resultam em deduplicação, como sinal de evolução da base de conhecimento.

As metas numéricas de latência e custo ficam como decisão aberta com o solicitante.

## 5. Escopo

### Dentro

- Botão flutuante na home privada para adicionar conexões.
- Seleção de arquivos dos tipos PDF, TXT e Markdown.
- Verificação de conexão existente por hash do conteúdo, no escopo do usuário autenticado.
- Agrupamento de versões em `Source`, com criação de nova `SourceVersion` quando o conteúdo de uma
  fonte existente muda e marcação da versão anterior como desatualizada.
- Extração de texto e divisão em chunks, geração de embeddings e gravação no Weaviate local.
- Registro da fonte e da versão no banco local com hash, metadados, status e quantidade de chunks.
- Listagem das fontes conectadas e dos respectivos status.
- Remoção de uma fonte pelo usuário, incluindo arquivo original, todas as versões, chunks e vetores.
- Mensagens e estados de carregamento, vazio, `ready`, duplicado e `failed`, em en-US.

### Fora

- Conexão por URL (fatia 3) e por imagem, áudio ou vídeo (fatia 4).
- Uso das fontes pelo chat e citações nas respostas (fatia 5).
- Geração de imagens e vídeos (fatia 6) e avaliação com LangSmith (fatia 7).
- OAuth, sincronização automática, pastas, permissões por documento e edição de chunks.
- Alteração no catálogo de Experts, no fluxo de chat ou na autenticação.

## 6. Fluxos

### Fluxo principal

1. A pessoa autenticada aciona o botão flutuante na home privada.
2. Seleciona um ou mais arquivos PDF, TXT ou Markdown.
3. Para cada arquivo, o sistema calcula o hash do conteúdo e procura uma versão existente do mesmo
   usuário.
4. Se encontrar, reaproveita a versão existente e sinaliza "Already connected".
5. Se não encontrar, verifica se já existe `Source` com aquele nome normalizado: em caso afirmativo,
   cria nova `SourceVersion` e marca a anterior como desatualizada; caso contrário, cria a fonte com
   sua primeira versão.
6. Extrai o texto, gera chunks e embeddings, grava os vetores no Weaviate e registra a versão como
   `ready`.
7. A lista de fontes conectadas reflete o resultado de cada arquivo.

### Fluxos alternativos e de exceção

- Arquivo com tipo não suportado: recusado com mensagem em inglês que lista os formatos aceitos.
- Arquivo corrompido ou sem texto extraível: a versão não é marcada como `ready`; o erro explica o
  motivo sem expor detalhes internos.
- Falha ao gerar embedding ou ao gravar no Weaviate: a versão fica `failed`, sem aparecer como
  `ready`, e a operação pode ser tentada novamente.
- Envio simultâneo do mesmo conteúdo: apenas uma versão válida permanece; a segunda tentativa é
  tratada como já conectada.
- Nenhuma fonte conectada: a lista mostra estado vazio com orientação para usar o botão flutuante.
- Pessoa remove uma fonte: arquivo original, todas as versões, chunks e vetores são apagados e a
  fonte desaparece da lista; o histórico de chat permanece e a fatia 5 trata a citação órfã.

## 7. Regras e casos de borda

- O hash do conteúdo identifica a versão e determina a deduplicação; nome do arquivo e horário de
  envio não identificam duplicata.
- O nome normalizado do arquivo agrupa versões em uma `Source`; ele não é usado para deduplicar.
- Deduplicação vale somente dentro do mesmo usuário: o mesmo arquivo em contas diferentes gera
  fontes distintas.
- Reenviar conteúdo idêntico não cria nova versão, novos chunks nem novos embeddings.
- Conteúdo diferente em uma fonte existente cria nova `SourceVersion`; a versão anterior permanece
  disponível para histórico, mas deixa de ser a atual e é sinalizada como desatualizada nas
  citações da fatia 5.
- O processamento é assíncrono do ponto de vista da interface: o envio retorna uma versão em
  `processing` e o status é atualizado quando termina.
- Uma versão só é considerada `ready` quando registro, chunks e vetores foram concluídos; falha
  parcial não é apresentada como sucesso.
- Excluir uma fonte remove todas as versões, o arquivo original, os chunks e os vetores daquele
  usuário; a operação é reutilizada pelas fatias 3 e 4.
- Todo conteúdo de arquivo é tratado como não confiável: instruções dentro dele não alteram regras
  do Expert nem da plataforma.
- Nenhum trecho de arquivo, nome de arquivo ou hash aparece em log ou telemetria; esta última usa
  identificadores opacos.
- Tamanhos máximos de arquivo e quantidade de arquivos por envio são configuráveis; os valores ficam
  como decisão aberta com dono.

## 8. Dados e contratos

- Entrada: arquivo binário com nome, tipo MIME declarado e tamanho.
- Contrato compartilhado, reutilizado pelas fatias 3 a 7: `Source` (identificador, usuário, tipo e
  nome/endereço normalizado, versão atual), `SourceVersion` (identificador, fonte, hash, metadados,
  status, quantidade de chunks e data/hora), `Chunk` e `Document`, além da operação de exclusão de
  fonte.
- Saída: registro de fonte e de versão conforme o contrato acima; vetores no Weaviate com `sourceId`
  e `sourceVersionId`.
- Estado: `queued`, `processing`, `ready` ou `failed`, com mensagem acionável em inglês no caso de
  erro. `isStale` é `true` quando a versão não é mais a atual da fonte.
- Retenção do arquivo original, de versões antigas, chunks e embeddings é decisão aberta com o
  solicitante.
- Erros seguem o contrato global `{ code, message, fieldErrors? }`, sem detalhes internos.

## 9. Permissões e segurança

- Somente sessão ativa pode enviar arquivos e listar fontes; a API valida o Bearer em toda operação.
- Isolamento por usuário em ambos os armazenamentos: uma fonte, versão ou vetor nunca é recuperado
  ou excluído por outra pessoa.
- Tipos e tamanhos são validados na borda; conteúdo inesperado é recusado antes do processamento.
- Chaves de API usadas na geração de embeddings ficam apenas no servidor.
- Nenhum conteúdo de arquivo é registrado em log, métrica ou mensagem de erro.

## 10. Requisitos não funcionais

- **Execução:** loaders de documentos, geração de embeddings e Weaviate executam localmente via
  Docker; chamadas externas limitam-se aos modelos contratados.
- **Concorrência:** dois envios do mesmo conteúdo não geram duas versões válidas.
- **Observabilidade:** cada arquivo registra duração, desfecho e quantidade de chunks, sem conteúdo,
  nome de arquivo ou hash; metas numéricas de latência e custo estão em aberto.
- **Acessibilidade:** botão flutuante e lista de fontes operáveis por teclado, com foco visível,
  nomes acessíveis, contraste AA e alvos de toque de ao menos 44×44 px.
- **Responsividade:** lista e seletor funcionais em 360 px, 768 px e 1280 px, sem rolagem horizontal.
- **Idioma:** textos de produto em en-US; documentação interna em PT-BR.

## 11. Dependências e riscos

- Depende da fatia 1 (`.specs/012-expert-chat.md`) para a presença da home privada com chat e do
  mapa `.plans/012-expert-platform-breakdown.md`.
- **Restrição do solicitante:** document loaders e Weaviate instalados e executando localmente via
  Docker; registro da fonte no banco local para deduplicação.
- **Risco — modelo de embedding não definido:** o tipo de vetor e o contrato de distância dependem
  dessa decisão; mitigação: registrar como aberta com dono de Engenharia antes do plano.
- **Risco — dados sensíveis:** documentos podem conter PII; mitigação: sem conteúdo em logs e
  isolamento por usuário desde a primeira versão.
- **Risco — erro silencioso:** falha na extração pode gerar fonte vazia; mitigação: status explícito
  de erro e nenhuma versão vazia marcada como `ready`.

## 12. Rollout e migração

- Sem feature flag: o botão flutuante passa a existir na home privada; o restante do chat segue
  intacto.
- Nenhuma migração de esquema herdada; se o armazenamento exigir novas tabelas, elas entram no plano
  desta fatia, não em spec separada.
- Rollback desativa o botão e o processamento; fontes já conectadas permanecem sem afetar contas ou
  sessões.
- `.docs/ARCHITECTURE.md` deve registrar o novo domínio de fontes, o banco de vetores local e o
  pipeline de ingestão na mesma entrega.

## 13. Estratégia de teste

- Unitário: cálculo e comparação de hash, decisão de deduplicação e regras de tipo de arquivo.
- Integração: envio novo, reenvio idêntico, envio simultâneo, arquivo corrompido e falha no
  armazenamento de vetores, com adaptadores locais ou fakes.
- E2E (Playwright): abrir o botão flutuante, enviar PDF/TXT/MD, ver status, reenviar o mesmo arquivo
  e confirmar que não houve duplicação; testar arquivo inválido.
- Banco: verificações de isolamento por usuário, de registro de fonte com versão e hash e de
  remoção completa na exclusão.
- Regressão: suítes de auth, navegação e chat da fatia 1 permanecem verdes.

## 14. Critérios de aceite

- [ ] Dado um usuário autenticado na home privada, quando há fontes conectadas, então o botão
      flutuante está visível e a lista mostra cada fonte com nome, tipo, tamanho e status.
- [ ] Dado um arquivo PDF, TXT ou Markdown válido, quando é enviado, então a versão aparece em
      `queued`/`processing` e, ao concluir, passa a `ready` com quantidade de chunks e vetores
      gravados.
- [ ] Dado um arquivo já conectado pelo mesmo usuário, quando é reenviado com o mesmo conteúdo,
      então nenhuma versão, chunk ou embedding novo é criado e a interface informa "Already
      connected".
- [ ] Dado um arquivo com conteúdo idêntico enviado por usuário diferente, quando é processado,
      então cada usuário possui sua própria fonte, sem compartilhamento.
- [ ] Dado um arquivo de tipo não suportado, quando é enviado, então é recusado com mensagem em
      inglês que lista os formatos aceitos.
- [ ] Dado um arquivo com nome já conectado e conteúdo diferente, quando é processado, então uma
      nova `SourceVersion` é criada, a anterior deixa de ser a atual e é marcada como desatualizada.
- [ ] Dado uma falha ao gravar os vetores, quando o processamento termina, então a versão aparece
      como `failed`, não é marcada como `ready` e pode ser tentada novamente.
- [ ] Dado dois envios simultâneos do mesmo conteúdo pelo mesmo usuário, quando ambos terminam,
      então existe exatamente uma versão válida e os vetores não estão duplicados.
- [ ] Dado uma fonte conectada, quando a pessoa a exclui, então arquivo, versões, chunks e vetores
      são removidos, a fonte desaparece da lista e o histórico de chat permanece.
- [ ] Dado qualquer arquivo processado, quando inspecionados logs e telemetria, então nenhum trecho
      de conteúdo, nome de arquivo ou hash aparece registrado.

## 15. Decisões e questões abertas

| Tema                | Decisão ou pergunta                                                                                                                        | Impacto                                                                | Dono        | Status   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------- | -------- |
| Critério de dedup   | Hash do conteúdo do arquivo, no escopo do usuário autenticado.                                                                             | Define quando uma conexão é considerada existente.                     | Solicitante | decidida |
| Isolamento          | Fontes e vetores isolados por usuário; sem workspace.                                                                                      | Define chave de propriedade de todos os dados indexados.               | Solicitante | decidida |
| Banco de vetores    | Weaviate executando localmente via Docker, com suporte a LangChain.js.                                                                     | Define o adaptador e o contrato de vetores.                            | Solicitante | decidida |
| Modelo de embedding | Qual modelo gera os embeddings dos chunks?                                                                                                 | Define dimensionalidade, custo e qualidade da recuperação futura.      | Engenharia  | aberta   |
| Limites de envio    | Tamanho máximo por arquivo e quantidade máxima de arquivos por envio.                                                                      | Define validação, tempo de processamento e exposição a abuso.          | Solicitante | aberta   |
| Conteúdo alterado   | Conteúdo diferente em uma fonte existente cria nova `SourceVersion`; a anterior fica desatualizada e é sinalizada nas citações da fatia 5. | Define histórico de versões e convivência de vetores antigos.          | Solicitante | decidida |
| Retenção            | Por quanto tempo manter arquivo original, versões antigas, chunks e embeddings após a conexão?                                             | Define política de privacidade e custo de armazenamento.               | Solicitante | aberta   |
| Exclusão de fonte   | A pessoa remove fonte, arquivo, todas as versões e vetores; o histórico de chat permanece e a fatia 5 trata a citação órfã.                | Define regras de limpeza e contrato compartilhado com as fatias 3 e 4. | Solicitante | decidida |
| Metas de qualidade  | Latência e custo máximos aceitáveis por arquivo processado.                                                                                | Permite transformar telemetria em gate de aceite.                      | Solicitante | aberta   |
