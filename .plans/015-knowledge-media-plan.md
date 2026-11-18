# Plano — Conexão de mídia como conhecimento (spec 015)

> Spec: `.specs/015-knowledge-media.md`
> Status: done
> Atualizado em: 2026-11-18

## 1. Contexto e problema

A fatia 013 entrega ingestão de PDF/TXT/Markdown com `Source`, `SourceVersion`, chunks,
embeddings `text-embedding-3-small` e vetores no Weaviate local. A fatia 015 precisa estender
essa mesma base para imagem (JPEG/PNG), áudio (MP3) e vídeo (MP4), sem criar um pipeline
paralelo: a mídia é convertida em texto por OCR/transcrição local e esse texto segue exatamente
o caminho já existente de chunking, embedding, persistência, deduplicação e exclusão.

Restrições recebidas: worktree `spec/015` criado de `453db9c`, onda 2 paralela com a 014 (URLs)
em outro worktree; nenhum arquivo da 014 ou das specs 014/016–018 pode ser alterado. O `.env`
do worktree não deve ser lido, exibido ou commitado; a chave de embedding continua apenas no
servidor via `SOURCE_OPENAI_API_KEY`.

## 2. Objetivo e critérios de aceite

Mapear os dez critérios da spec para entregas verificáveis:

1. PNG válido enviado por usuário autenticado → versão `processing` e depois `ready` via OCR.
2. MP3 com fala → transcrição fatiada e gravada no Weaviate com o `source_id` da fonte.
3. MP4 com fala → transcrição extraída e versão `ready`.
4. Reenvio do mesmo arquivo → versão reaproveitada, sem chunks/vetores duplicados.
5. MIME/extensão não suportados → recusa em en-US, sem criar fonte.
6. Áudio sem fala → `failed` com "No speech detected", nenhum vetor gravado.
7. Dois usuários com o mesmo arquivo → cada um vê apenas a sua fonte.
8. Exclusão → arquivo, versões, chunks e vetores removidos; histórico de chat preservado.
9. "Try again"/retry → novo job para o mesmo `sourceId`, sem duplicar a fonte.
10. Teclado/leitor de tela → seleção, progresso e erro anunciados e alcançáveis.

## 3. Escopo

### Dentro

- Extensão do domínio `sources` com os tipos `image`, `audio` e `video`, limites por tipo,
  validação de MIME/extensão/magic bytes e duração máxima.
- Porta `MediaTextExtractorPort` e adaptador local baseado em comandos OCR/transcrição
  configuráveis por variáveis de ambiente do servidor, com arquivos temporários removidos
  sempre e metadados de proveniência (`method`, `modelVersion`, `durationSeconds`).
- Reaproveitamento integral de `ConnectSourcesUseCase`, `ProcessSourceVersionUseCase`,
  `DeleteSourceUseCase`, `RetrySourceVersionUseCase`, `chunkText`, embeddings e Weaviate.
- Fases de progresso `extracting`, `chunking`, `embedding` dentro de `processing`, expostas
  na listagem sem trocar o contrato público de status da 013.
- Migração aditiva `0004_knowledge_media.sql` + teste de schema `004_knowledge_media.test.sql`
  (novos valores de `type` e colunas opcionais de mídia; nenhuma migração de dados).
- UI en-US/light-only no painel existente: seleção Image/Audio/Video atrás da flag
  `knowledge_media_enabled` (desligada por padrão), input com `accept` dinâmico,
  duração opcional, fases e erro legível; FAB, rótulos e navegação da 013 preservados.
- Server Actions atualizadas; `bodySizeLimit` do Next ajustado para vídeo.
- Fake API de E2E ampliada e nova suíte `knowledge-media.spec.ts` sem alterar os testes da 013.
- Testes unitários/integração na API e documentação afetada na mesma entrega.

### Fora

- Geração de mídia (fatia 6), citações/RAG (fatia 5), LangSmith (fatia 7) e URLs (fatia 3).
- OCR de frames/slides de vídeo, timestamps, busca em vetores de imagem/vídeo.
- Formatos adicionais (`.webp`, `.wav`, `.mov`, `.avi`, `.mkv`, `.ogg`, HEIC).
- Chamada a OpenAI/Gemini/Veo para OCR ou transcrição nesta fatia; modelos locais específicos
  seguem como decisão aberta (contrato de comando configurável entregue).
- Push, merge, reset, down-migration, alteração da branch principal ou das specs 014/016–018.

## 4. Abordagem técnica

- **Contrato único:** `SourceType` ganha `image | audio | video`. `Source`, `SourceVersion`,
  `Chunk`, `Document` e a operação de exclusão da 013 permanecem intactos; metadados de mídia
  são campos opcionais na versão e no resumo.
- **Validação na borda:** MIME + extensão + magic bytes (JPEG `FF D8 FF`, PNG assinatura
  completa, MP3 `ID3`/sync MPEG, MP4 `ftyp` no offset 4). Limites provisórios: 25 MB imagem,
  50 MB áudio, 200 MB vídeo, 60 min de duração; os docs mantêm 10 MB. O multer passa a usar
  o maior limite e a política de domínio aplica o limite por tipo.
- **Deduplicação/versionamento:** SHA-256 dos bytes originais, escopo `userId`, índice único
  parcial existente; nome normalizado apenas agrupa versões.Troca do modelo de extração cria
  nova `SourceVersion` porque o hash da versão inclui a configuração declarada de extração
  quando ela é informada pelo cliente (decisão aberta registrada).
- **Extração:** `MediaTextExtractorPort.extract(file, type, durationSeconds?)` devolve
  `{ text, method, modelVersion, durationSeconds? }`. O adaptador local usa `execFile` com
  comandos configuráveis (`{file}` e `{output}` placeholders), grava o arquivo em diretório
  temporário e remove tudo em `finally`. Sem comando configurado, falha com mens pública
  en-US; nenhuma chave, comando sensível, texto transcrito ou hash entra em log/telemetria.
- **Pipeline:** o caso de uso da 013 continua dono de chunk → embedding → vetor → `ready`.
  Para mídia ele apenas atualiza a fase e persiste a proveniência antes do chunking; falha
  limpa vetores parciais e marca `failed` com mensagem acionável.
- **Observabilidade:** eventos `media.upload.accepted`, `media.source.reused`,
  `media.extraction.started/completed/failed` e `media.source.deleted` com IDs opacos,
  duração de cada etapa e tipo de mídia; nunca conteúdo, nome de arquivo, hash ou chave.
- **Flag:** `knowledge_media_enabled` lida no servidor do web (env ou cookie); padrão `false`.
  Os cenários E2E de mídia ligam a flag com cookie no contexto do navegador, sem alterar a config
  global do Playwright, para preservar as expectativas da suíte da 013.

## 5. Arquivos e áreas afetadas

- `apps/api/src/modules/sources/**` (domínio, portas, aplicação, infraestrutura, interface).
- `apps/api/src/test/fakes/**` (fake de extrator de mídia e ajustes aditivos no repositório).
- `apps/api/src/app.module.ts` ou `sources.module.ts` apenas se necessário para DI.
- `db/migrations/0004_knowledge_media.sql`, `db/tests/004_knowledge_media.test.sql`.
- `apps/web/lib/knowledge/types.ts`, `apps/web/app/app/source-actions.ts`,
  `apps/web/app/app/_components/knowledge-sources.tsx`, `apps/web/app/app/page.tsx`,
  `apps/web/next.config.js` (`bodySizeLimit`), sem alterar `playwright.config.ts`.
- `apps/web/e2e/support/fake-api-server.ts`, `apps/web/e2e/knowledge-media.spec.ts`.
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/BUSINESS.md`, `.specs/015-knowledge-media.md`,
  este plano.

## 6. Passos de implementação

- [x] 6.1 Ler docs, spec, plano 013 e código; confirmar ambiente e instalar dependências.
- [x] 6.2 Criar/atualizar este plano e marcar spec/plano como `implementing`.
- [x] 6.3 Domínio: tipos de mídia, limites, magic bytes, duração, mensagens e erros + testes.
- [x] 6.4 Migração 0004 e teste SQL; rodar `bun run db:migrate`.
- [x] 6.5 Porta de extração de mídia, adaptador local e fakes + testes.
- [x] 6.6 Repositório `pg` com metadados/fases e isolamento + testes; casos de uso + testes.
- [x] 6.7 Request handlers/DI e integração HTTP com mídia; validação da borda.
- [x] 6.8 Web: tipos, actions, painel com seleção de mídia/flag, limites e `bodySizeLimit`.
- [x] 6.9 E2E: fake API ampliada, suíte de mídia e não regressão da suíte da 013.
- [x] 6.10 Documentação afetada e critérios de aceite da spec.
- [x] 6.11 QA completo (db, lint, tipos, testes, build, E2E) e commits locais em `spec/015`.
- [x] 6.12 Marcar spec e plano como `done` e entregar relatório final.

Cada critério de aceite é coberto por ao menos um teste listado no plano de testes (§8).

## 7. Riscos e mitigação

| Risco                                               | Mitigação                                                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo local de OCR/transcrição ausente no ambiente | Contrato configurável por comando; sem comando, falha explícita em en-US; cobertura funcional com fake nos testes; decisão aberta registrada. |
| Upload disfarçado                                   | MIME + extensão + magic bytes validados antes de persistir.                                                                                   |
| Vídeo longo estourar memória                        | Limite de 200 MB/60 min e streaming não implementado nesta fatia (decisão aberta).                                                            |
| Vetores órfãos                                      | Falha e exclusão chamam `deleteVersion`/`deleteSource` antes de mexer nos registros.                                                          |
| Concorrência                                        | Índice único parcial da 013 continua válido para mídia.                                                                                       |
| Conteúdo sensível em log                            | Telemetria só com IDs, tipo, fases, duração e desfecho.                                                                                       |
| Colisão com a 014                                   | Nenhum arquivo da 014 tocado; migração ownada por esta spec; coordenação só via portas da 013.                                                |
| Limites/flag ainda em decisão aberta                | Constantes centralizadas e flag desligada por padrão; follow-up registrado na spec.                                                           |

## 8. Plano de testes

- Unitário (Vitest/API): magic bytes, limites por tipo, duração, higienização de nome, hash,
  transições de fase, proveniência, "No speech detected", retry, isolamento e logs sem PII.
- Integração (Vitest + Supertest): upload image/audio/video com extrator fake, dedup, concorrência,
  tipo inválido, falha de extração, exclusão e retry com fakes de repositório/embedding/vetor.
- Banco (`bun run db:test`): valores de `type`, colunas opcionais, índice único por hash e cascade.
- Web (Vitest): actions com mídia, validação de duração/tamanho e mensagens en-US.
- E2E (Playwright): seleção Image/Audio/Video, status até `ready`, dedup, inválido, sem fala,
  retry, exclusão, isolamento, teclado/foco e 360/768/1280 px sem rolagem horizontal.
- Regressão: suítes de auth, chat, navegação e fontes da 013 permanecem verdes.

## 9. QA manual

1. Com flag ligada, abrir `/app`, FAB e conferir Image/Audio/Video com foco visível.
2. Enviar PNG/MP3/MP4 pequenos: status `processing` → `ready`, com fases anunciadas.
3. Reenviar o mesmo arquivo: "Already connected", sem nova versão.
4. Enviar `.exe` e MP3 sem fala: mensagens en-US específicas, sem fonte pronta/vetores.
5. Usar "Try again" na falha: mesmo `sourceId`, nova versão pronta.
6. Excluir fonte: lista atualizada, chat preservado.
7. Inspecionar logs: sem transcrição, nome de arquivo, hash ou chave de API.
8. Verificar 360/768/1280 px e navegação por teclado.

## 10. Rollout e rollback

- Flag `knowledge_media_enabled` desligada por padrão; rollback é desligá-la e ocultar as opções.
- Migração é aditiva; nenhuma migração down é executada.
- Fontes já processadas continuam disponíveis para consulta e exclusão.

## 11. Evidências e pendências

Executado em `spec/015` (worktree `C:\Users\Gamer\Desktop\pos graduacao\PROJETOS\spec-015`),
sem ler, exibir ou versionar `.env`. Banco isolado em `127.0.0.1:55433` somente para validação.

| Comando               | Resultado                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `bun run db:migrate`  | ok — 4 migrações aplicadas; rerun final: "nenhuma migração pendente"                      |
| `bun run db:test`     | ok — 4 arquivos (`001`, `002`, `003`, `004_knowledge_media.test.sql`)                     |
| `bun run lint`        | ok — todos os pacotes                                                                     |
| `bun run types:check` | ok — todos os pacotes                                                                     |
| `bun run test`        | ok — API 67 arquivos / 442 testes; web 12 arquivos / 142 testes                           |
| `bun run build`       | ok — `api` + `web`, 10,83 s                                                               |
| `bun run test:e2e`    | ok — 146/146 testes em execução isolada (portas 3015/3435); detalhes em `.docs/QA.md` §12 |

Commit local: `3d29102 feat: connect image, audio and video as knowledge sources` (sem push/merge).
Evidência detalhada, incluindo o resultado final do E2E, está em `.docs/QA.md` §12.

Seguem como decisões abertas do solicitante: modelos locais de OCR/transcrição, OCR de frames de
vídeo, limites definitivos, idioma da transcrição, mídia por URL e retenção de arquivos volumosos.
O adaptador local é configurável por comando; sem comando configurado a falha é explícita em en-US.
