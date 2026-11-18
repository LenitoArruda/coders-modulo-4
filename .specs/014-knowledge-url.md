# Fontes de conhecimento por URL — Spec

> **Status:** done
> **Atualizado em:** 2026-11-18
> **Autor:** OpenCode Agent
> **Épico:** `.plans/012-expert-platform-breakdown.md` (fatia 3)
> **Depende de:** `.specs/013-knowledge-files.md`
> **Plano:** `.plans/014-knowledge-url-plan.md`

## 1. Contexto e problema

A fatia 2 permite transformar arquivos locais em contexto para os Experts, mas boa parte do
conhecimento da empresa vive em páginas externas acessíveis por link — documentação, artigos,
changelogs, páginas de produto. Sem esta fatia, a pessoa precisaria baixar esse conteúdo e
reenviá-lo como arquivo para obter o mesmo efeito.

A fatia também evita uma duplicação previsível: sem deduplicação por conteúdo, o mesmo link poderia
ser adicionado várias vezes e gerar vetores redundantes, com citações repetidas quando a fatia 5
entrar. Ela reutiliza o contrato de fonte introduzido na fatia 2, incluindo `SourceVersion`,
versionamento por conteúdo alterado e exclusão de fonte.

## 2. Usuários e jobs

| Usuário                          | Job                                                        | Frequência |
| -------------------------------- | ---------------------------------------------------------- | ---------- |
| Pessoa autenticada com links     | Adicionar páginas externas como contexto dos Experts       | Ocasional  |
| Pessoa que reenvia um link       | Confirmar que o conteúdo já está conectado, sem duplicação | Eventual   |
| Pessoa que informa link inválido | Entender o problema e corrigir o endereço                  | Eventual   |

Permissões: apenas a pessoa autenticada vê e gerencia as próprias conexões de URL; links de uma
conta nunca aparecem em outra.

## 3. Resultado esperado

No mesmo fluxo de adicionar conexões da home privada, a pessoa informa uma URL externa. O sistema
busca o conteúdo público da página, normaliza o endereço, calcula o hash do conteúdo obtido e aplica
a mesma regra de deduplicação da fatia 2: se já existir versão com aquele conteúdo para o usuário,
nada é reprocessado e a interface informa "Already connected"; se for novo conteúdo de uma URL já
conectada, uma nova `SourceVersion` é criada e a anterior é marcada como desatualizada; se for nova,
o texto é dividido em chunks, os embeddings são gerados, os vetores vão para o Weaviate local e a
fonte é registrada.

A pessoa vê a fonte na lista de fontes conectadas com o endereço, o título obtido, o status
(`queued`, `processing`, `ready` ou `failed`), a versão atual e a quantidade de chunks. A inclusão
de status, mensagens, acessibilidade e exclusão segue o padrão da fatia 2.

## 4. Métricas de sucesso

Eventos a serem medidos, sem meta numérica inventada nesta fatia:

- URL enviada, conteúdo obtido, conexão reaproveitada, fonte indexada e fonte com falha.
- Duração da busca e da indexação e quantidade de chunks por página.
- Taxa de falhas de busca por motivo (inacessível, tempo esgotado, conteúdo sem texto).

As metas numéricas de latência e custo ficam como decisão aberta com o solicitante.

## 5. Escopo

### Dentro

- Campo para informar uma URL externa no fluxo de adicionar conexões.
- Validação e normalização do endereço antes da busca.
- Busca do conteúdo público da página com timeout e tratamento de falhas transitórias.
- Aplicação do contrato de fonte da fatia 2: hash do conteúdo, deduplicação por usuário,
  `SourceVersion`, chunks, embeddings, vetores no Weaviate e registro da fonte.
- Criação de nova versão quando o conteúdo de uma URL já conectada muda, com a versão anterior
  marcada como desatualizada.
- Exibição da URL, do título obtido, do status, da versão atual e da quantidade de chunks na lista.
- Reutilização da operação de exclusão da fatia 2 para remover URL, versões, chunks e vetores.
- Mensagens de erro em inglês para link inválido, inacessível, sem texto ou duplicado.

### Fora

- Upload de arquivos (fatia 2) e conexões de imagem, áudio e vídeo (fatia 4).
- Autenticação em sites de terceiros, páginas que exigem login, cookies ou sessão.
- Verificação de `robots.txt` e outras políticas de extração, extração de links internos em
  profundidade e varredura de sites inteiros — ver comportamento provisório na seção 7 e decisão
  aberta na seção 15.
- Uso das fontes pelo chat e citações (fatia 5), geração de mídia (fatia 6) e LangSmith (fatia 7).
- Edição de conteúdo extraído e alterações no catálogo de Experts.

## 6. Fluxos

### Fluxo principal

1. A pessoa autenticada aciona o botão flutuante e escolhe adicionar uma URL.
2. Informa o endereço; o sistema valida e normaliza a URL.
3. Busca o conteúdo público da página, com timeout.
4. Calcula o hash do conteúdo obtido e verifica se o mesmo usuário já possui aquela versão.
5. Se já existir, reaproveita a versão e informa "Already connected".
6. Se a URL já possuir fonte e o conteúdo mudou, cria nova `SourceVersion` e marca a anterior como
   desatualizada; caso contrário, cria a fonte com sua primeira versão.
7. Gera chunks e embeddings, grava os vetores e registra a versão como `ready`.
8. A lista de fontes passa a mostrar o resultado.

### Fluxos alternativos e de exceção

- URL malformada ou com esquema não permitido: recusada antes da busca, com mensagem em inglês.
- Endereço que aponta para rede interna ou loopback: recusado por segurança, sem tentativa de busca.
- Página inacessível, redirecionada para login ou com tempo esgotado: versão `failed`, com mensagem
  acionável e sem vetores gravados.
- Página sem texto extraível: versão `failed` com orientação para usar outra URL ou um arquivo.
- Conteúdo alterado desde a última conexão: nova versão da mesma fonte, conforme o contrato da
  fatia 2; a versão anterior é sinalizada como desatualizada na fatia 5.
- Mesmo conteúdo veiculado em URLs diferentes: considerado duplicata pelo hash do conteúdo.
- Pessoa remove a fonte: URL, versões, chunks e vetores são apagados conforme a fatia 2; o histórico
  de chat permanece e a citação órfã é tratada na fatia 5.

## 7. Regras e casos de borda

- A URL normalizada agrupa versões em uma `Source`; o hash do conteúdo obtido identifica a versão e
  determina a deduplicação, nunca a string da URL.
- A normalização remove fragmentos e parâmetros de rastreamento irrelevantes; o conteúdo obtido é a
  base do hash.
- Até a decisão sobre `robots.txt`, a busca considera apenas conteúdo público e trata falha de acesso
  como erro; não há verificação de política de extração nem varredura de sites.
- Somente esquemas públicos HTTP e HTTPS são aceitos; endereços de redes privadas, loopback e
  metadados de nuvem são bloqueados antes de qualquer requisição.
- Redirecionamentos são seguidos apenas dentro de limites seguros; um redirecionamento para endereço
  bloqueado encerra a operação com erro.
- Timeout, limite de tamanho de resposta e tentativas são configuráveis; valores ficam como decisão
  aberta com dono de Engenharia.
- Conteúdo de página externa é tratado como não confiável: instruções nele não alteram regras do
  Expert nem da plataforma.
- Nenhum endereço, trecho de página ou hash é registrado em log ou telemetria; esta última usa
  identificadores opacos.
- A versão só é marcada como `ready` quando busca, chunks, embeddings, vetores e registro terminam.

## 8. Dados e contratos

- Entrada: string de URL informada pela pessoa.
- Saída: registro de fonte com identificador, URL normalizada, título obtido, versão atual e, por
  versão, hash do conteúdo, status, quantidade de chunks e data/hora; vetores no Weaviate com
  `sourceId` e `sourceVersionId`.
- Estado: `queued`, `processing`, `ready` ou `failed`, com mensagem acionável em inglês quando
  aplicável.
- Reutilização integral do contrato de fonte da fatia 2 — `Source`, `SourceVersion`, `Chunk`,
  `Document` e exclusão — sem criar um tipo paralelo de fonte.
- Retenção do conteúdo obtido, de versões antigas, chunks e embeddings segue a decisão aberta da
  fatia 2.
- Erros seguem o contrato global `{ code, message, fieldErrors? }`, sem detalhes internos.

## 9. Permissões e segurança

- Somente sessão ativa pode adicionar URLs e listar fontes; a API valida o Bearer em toda operação.
- Isolamento por usuário em registro de fonte e vetores.
- Validação na borda bloqueia esquemas não permitidos e endereços internos (proteção contra SSRF).
- Chaves de API usadas na geração de embeddings ficam apenas no servidor.
- Nenhum conteúdo de página, URL completa ou hash é gravado em log ou mensagem de erro.

## 10. Requisitos não funcionais

- **Execução:** busca, loaders e Weaviate executam localmente via Docker; chamadas externas são a
  busca da própria URL e os modelos contratados.
- **Concorrência:** duas adições do mesmo conteúdo não geram duas fontes válidas.
- **Resiliência:** falha de uma URL não impede o processamento de outras adições na mesma sessão.
- **Observabilidade:** cada URL registra duração, desfecho e quantidade de chunks, sem endereço,
  conteúdo ou hash; metas numéricas de latência e custo estão em aberto.
- **Acessibilidade e responsividade:** campo e lista operáveis por teclado, foco visível, contraste
  AA, alvos de toque de ao menos 44×44 px e layout funcional em 360 px, 768 px e 1280 px.
- **Idioma:** textos de produto em en-US; documentação interna em PT-BR.

## 11. Dependências e riscos

- Depende da fatia 2 (`.specs/013-knowledge-files.md`) para o contrato de fonte, o botão flutuante
  e a lista de status; depende indiretamente da fatia 1 pela home privada.
- **Restrição do solicitante:** conexões são apenas arquivos e URL externa; nada de OAuth nesta
  fatia.
- **Risco — SSRF:** URL fornecida pelo usuário pode apontar para serviços internos; mitigação:
  validação de esquema, bloqueio de redes privadas e limites em redirecionamentos.
- **Risco — conteúdo instável:** páginas mudam sem aviso; mitigação: regra de versão do contrato da
  fatia 2 e sinalização da versão desatualizada na fatia 5.
- **Risco — termos de uso:** nem toda página autoriza extração automatizada; o comportamento
  provisório é buscar apenas conteúdo público e respeitar falhas de acesso, até decisão sobre
  `robots.txt` na seção 15.

## 12. Rollout e migração

- Sem feature flag: o campo de URL passa a existir junto ao fluxo de conexões da fatia 2.
- Nenhuma migração de esquema além da decorrente do contrato de fonte já introduzido.
- Rollback desativa apenas a opção de URL; fontes de arquivo e vetores já gravados permanecem.
- `.docs/ARCHITECTURE.md` e `.docs/BUSINESS.md` devem refletir URL externa como conector suportado
  na mesma entrega.

## 13. Estratégia de teste

- Unitário: normalização de URL, bloqueio de esquemas e endereços internos, decisão de deduplicação.
- Integração: página pública simulada, redirecionamento seguro, link inacessível, sem texto,
  duplicata por conteúdo e duas URLs com o mesmo conteúdo.
- E2E (Playwright): adicionar URL válida, ver status, reenviar a mesma URL, reenviar conteúdo igual
  em outra URL e tentar endereço interno.
- Segurança: testes de SSRF com loopback, links de metadados e redirecionamentos para rede privada.
- Regressão: suítes de auth, chat e conexões por arquivo permanecem verdes.

## 14. Critérios de aceite

- [x] Dado um usuário autenticado no fluxo de conexões, quando escolhe adicionar URL, então encontra
      um campo para informar o endereço com rótulo e mensagens em inglês.
- [x] Dado uma URL pública com texto, quando é adicionada, então a versão aparece em
      `queued`/`processing` e ao concluir passa a `ready`, com título, endereço normalizado e
      quantidade de chunks.
- [x] Dado uma conexão de URL já existente para o mesmo usuário, quando a mesma URL é reenviada com
      o mesmo conteúdo, então nenhuma versão, chunk ou embedding novo é criado e a interface informa
      "Already connected".
- [x] Dado duas URLs diferentes com o mesmo conteúdo, quando ambas são adicionadas, então apenas uma
      fonte válida permanece para aquele usuário.
- [x] Dado um endereço com esquema não permitido ou que aponta para rede interna, quando é enviado,
      então é recusado antes de qualquer busca, com mensagem em inglês.
- [x] Dado uma URL já conectada cujo conteúdo mudou, quando é processada novamente, então uma nova
      `SourceVersion` é criada e a anterior é marcada como desatualizada.
- [x] Dado uma página inacessível ou sem texto extraível, quando o processamento termina, então a
      versão aparece como `failed`, sem vetores gravados, e pode ser tentada novamente.
- [x] Dado dois usuários, quando cada um adiciona a mesma URL, então cada um possui sua própria
      fonte, sem compartilhamento de registro ou vetores.
- [x] Dado uma fonte de URL conectada, quando a pessoa a exclui, então URL, versões, chunks e vetores
      são removidos conforme a fatia 2 e o histórico de chat permanece.
- [x] Dado qualquer URL processada, quando inspecionados logs e telemetria, então nenhum endereço,
      trecho de página ou hash aparece registrado.

## 15. Decisões e questões abertas

| Tema                | Decisão ou pergunta                                                                                       | Impacto                                                        | Dono        | Status   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------- | -------- |
| Critério de dedup   | Hash do conteúdo obtido, no escopo do usuário; nome da URL não identifica duplicata.                      | Define quando uma conexão de URL é considerada existente.      | Solicitante | decidida |
| Reuso de contrato   | URL usa a mesma fonte da fatia 2, sem tipo paralelo.                                                      | Evita divergência entre formatos de fonte e citações futuras.  | Engenharia  | decidida |
| Conteúdo alterado   | Conteúdo diferente em URL já conectada cria nova `SourceVersion`, conforme contrato da fatia 2.           | Define histórico e convivência de vetores antigos.             | Solicitante | decidida |
| Parâmetros de busca | Timeout, tamanho máximo de resposta e número de redirecionamentos permitidos.                             | Define resiliência e exposição a páginas lentas ou maliciosas. | Engenharia  | aberta   |
| Robots e termos     | Verificar `robots.txt` antes de buscar? Até decisão: apenas conteúdo público e falha de acesso como erro. | Pode reduzir cobertura de fontes, porém evita uso indevido.    | Solicitante | aberta   |
| Exclusão de fonte   | Reutilizar a exclusão da fatia 2: URL, versões, chunks e vetores removidos; histórico de chat preservado. | Define regras de limpeza e gestão.                             | Solicitante | decidida |
| Metas de qualidade  | Latência e custo máximos aceitáveis por página processada.                                                | Permite transformar telemetria em gate de aceite.              | Solicitante | aberta   |
