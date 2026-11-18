# Plano — Entregáveis multimídia no chat (spec 017)

> Spec: `.specs/017-multimedia-deliverables.md`
> Status: done
> Atualizado em: 2026-11-18

## 1. Contexto

As fatias 012–016 entregam chat em persona, fontes (arquivo/URL/mídia), vetores e citações.
Faltava fechar o ciclo "pergunta → conhecimento → entregável": papéis como CMO, Customer Hero e
Vendas precisam de imagem e clipe curto gerados a partir de um briefing no próprio chat, com
preview, metadados, download e rastreabilidade.

Trabalho exclusivo no worktree `C:\Users\Gamer\Desktop\pos graduacao\PROJETOS\spec-017`, branch
`spec/017`, criado de `dd33577` (012–016 já integradas). Nenhuma spec/worktree de 014–018 é
alterado; nenhum merge, push, reset ou down-migration é executado. Nenhum valor de `.env`, chave,
token ou URL sensível é lido, exibido ou versionado.

## 2. Decisões fechadas neste plano

As decisões abertas da spec §15 são resolvidas aqui com valores provisórios configuráveis, para
que a fatia seja implementável sem bloquear o solicitante. Cada constante vive no domínio/ENV e
pode ser ajustada sem mudar contratos.

| Tema                | Decisão                                                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature flag        | `MULTIMEDIA_DELIVERABLES_ENABLED` (API, padrão `false`) e `multimedia_deliverables_enabled` (cookie/env no web, padrão `false`). Desligada, o chat permanece idêntico às fatias 012/016.                                                                                                 |
| Modelo de imagem    | `gpt-image-2`, chamada exclusiva à OpenAI Images REST. ID configurável por `MEDIA_IMAGE_MODEL_ID`. Tamanhos: `1024x1024`, `1024x1536`, `1536x1024`.                                                                                                                                      |
| Modelo de vídeo     | `gemini-omni-1.2-flash` (ID estável atual na documentação do Gemini; o `gemini-omni-1.1-flash` da spec está desatualizado). Configurável por `MEDIA_VIDEO_MODEL_ID`; base da API por `GEMINI_API_BASE_URL`.                                                                              |
| Limites             | Briefing até 2.000 caracteres; vídeo 4/6/8 s (máx. 8) e 720p; imagem nos três tamanhos acima. Pedido acima do limite recebe sugestão en-US e não chama o provedor.                                                                                                                       |
| Cota por usuário    | 10 imagens e 2 vídeos por hora por `user_id`, em memória por processo (mesmo padrão dos rate limits existentes); configurável. Contador devolvido quando o job é cancelado antes de começar.                                                                                             |
| Confirmação         | Intenção detectada por palavras-chave em en-US. Sem tema ou sem tipo ("image" vs "video"), o Expert faz **uma** pergunta curta e não cria job.                                                                                                                                           |
| Referência de mídia | Marcador `[n]` no briefing usa a citação `n` da última mensagem do Expert (contrato da fatia 016); a citação é anexada ao entregável. Reenvio de bytes da fonte ao modelo fica como follow-up (decisão aberta do Time de IA).                                                            |
| Retenção            | Arquivo e metadados na tabela `generated_media`, com cascade de `messages`/`users`; mesma retenção do histórico. Sem job de limpeza nesta fatia.                                                                                                                                         |
| Exibição no chat    | Preview inline na mensagem (`<img>`/`<video>`), metadados (modelo, parâmetros, data, tamanho), `aria-live`, download por rota autenticada do web, "Try again" e "Cancel".                                                                                                                |
| Job assíncrono      | Fila em memória por processo com `AbortController`; estados `queued → generating → ready \\                                                                                                                                                                                              | failed \\ | cancelled`. Reexecução limitada a 3 tentativas via "Try again". Jobs órfãos após restart viram `failed` na primeira leitura. |
| Billing do vídeo    | Nenhuma chamada paga é feita nos testes: providers são fakeados. Validação real de vídeo depende de projeto Google com billing/API ativada e fica registrada como follow-up. Se uma chamada real for bloqueada por billing, a execução para e reporta `RESULTADO: bloqueado` sem commit. |
| Migração            | Aditiva `0006_multimedia_deliverables.sql` + teste `006_multimedia_deliverables.test.sql`. Nenhuma migração de dados; mensagens antigas continuam legíveis.                                                                                                                              |

## 3. Escopo

### Dentro

- Novo slice `media` na API (domínio, aplicação, infraestrutura, interface) com portas e 1 handler por endpoint.
- Detecção de intenção, validação de parâmetros, confirmação curta, limites e cota.
- Adaptadores reais OpenAI (imagem) e Gemini (vídeo), ambos com base/modelo configuráveis e sem segredo em log.
- Geração assíncrona com estados, cancelamento, retry limitado e persistência de bytes/metadados.
- Download autenticado e isolado por `user_id`; citação opcional anexada ao entregável.
- Tipos, componente de mídia, polling e ações no web; flag desligada por padrão.
- Fake API e E2E determinístico em portas isoladas **3017** (web) e **3437** (fake API).
- Migração 0006, teste SQL, testes unitários/integração/web, QA completo e documentação afetada.

### Fora

- Edição de mídia, upload da mídia gerada como nova fonte, áudio/TTS, slides/PDF, presets visuais e links públicos.
- Envio de bytes de fonte conectada ao modelo; treinamento; retenção definitiva de arquivos grandes.
- Alterações nas specs/código de 014–018; push, merge, reset, down-migration.
- Chamada real a OpenAI/Gemini durante QA; nenhum valor de `.env` é lido ou exibido.

## 4. Abordagem técnica

- **Domínio (`media/domain`):** tipos `MediaKind`, `MediaStatus`, `MediaAttachment`,
  `MediaParameters`, `MediaErrorCode`; funções puras `detectMediaIntent`, `parseMediaParameters`,
  `mediaPromptForConfirmation`, `mediaPromptForLimit`, `isTerminalStatus`, `nextAttempt`; erros
  tipados com códigos estáveis. Textos de UI/erro em en-US.
- **Aplicação (`media/application`):** portas `MediaGeneratorPort`,
  `MediaGenerationRepositoryPort`, `MediaJobQueuePort`, `MediaQuotaPort`; casos de uso
  `RequestMediaGenerationUseCase` (intenção/validação/cota/enfileiramento),
  `ProcessMediaGenerationUseCase` (provider → bytes → `ready`/`failed`),
  `GetMediaGenerationStatusUseCase`, `CancelMediaGenerationUseCase`,
  `RetryMediaGenerationUseCase` e `DownloadMediaUseCase`.
- **Infraestrutura (`media/infrastructure`):** `OpenAIImageGenerator` (REST `images/generations`,
  `b64_json`), `GeminiVideoGenerator` (`predictLongRunning` + polling de operação + download do
  arquivo), `PostgresMediaGenerationRepository` (`pg` parametrizado + `withDbSpan`), fila em
  memória com `AbortController` e cota em memória.
- **Conversas:** `SendMessageUseCase` recebe dependências opcionais da slice `media`; quando a flag
  está ligada e há intenção, a resposta textual é montada e o job é enfileirado, com
  `expertMessage.media` no estado `queued`. Pedido ambíguo/acima do limite gera só texto.
- **Persistência:** `generated_media` guarda bytes (`bytea`) e metadados por `user_id`/`message_id`;
  `messages.media` referencia o anexo no histórico. Toda leitura/escrita filtra por usuário.
- **Web:** flag lida no servidor (env ou cookie); `MediaAttachment` faz polling do status enquanto
  não terminal, mostra preview/metadados/erro e ações; download passa por route handler que lê o
  cookie `HttpOnly` e repassa Bearer, sem URL pública previsível.
- **Telemetria:** eventos `media_generation.requested/started/completed/failed/cancelled/downloaded`
  com IDs opacos, modelo, parâmetros, custo estimado, duração e desfecho — nunca prompt, bytes,
  nome de arquivo, URL de download, hash ou chave.

## 5. Arquivos e áreas afetadas

### API

- `apps/api/src/modules/media/**` (novo slice completo + `media.tokens.ts`).
- `apps/api/src/modules/conversations/domain/conversation.ts`, `domain/send-message-input.ts`,
  `application/send-message.use-case.ts`, `conversations.module.ts`, `conversations.tokens.ts`.
- `apps/api/src/app.module.ts`, `apps/api/src/modules/shared/config/env.ts`.
- `apps/api/src/test/fakes/**` (gerador fake, repositório fake, fila/cota fake),
  `apps/api/src/test/setup-env.ts`.

### Web

- `apps/web/lib/expert-chat/types.ts`, `apps/web/lib/multimedia/flags.ts` (novo).
- `apps/web/app/app/chat-actions.ts`, `apps/web/app/app/media-actions.ts` (novo),
  `apps/web/app/app/api/media/[mediaId]/download/route.ts` (novo),
  `apps/web/app/app/page.tsx`, `apps/web/app/app/_components/expert-chat.tsx`,
  `apps/web/app/app/_components/media-attachment.tsx` (novo).

### Banco, E2E e documentação

- `db/migrations/0006_multimedia_deliverables.sql`, `db/tests/006_multimedia_deliverables.test.sql`.
- `.env.example`.
- `apps/web/e2e/support/fake-api-server.ts`, `apps/web/e2e/multimedia-deliverables.spec.ts` (novo).
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/BUSINESS.md`, `.specs/017-multimedia-deliverables.md`,
  este plano.

## 6. Passos de implementação

- [x] 6.1 Ler docs, spec, planos de referência e código; validar DoR e fechar decisões abertas neste plano.
- [x] 6.2 Marcar spec e plano como `implementing`.
- [x] 6.3 Domínio `media` (tipos, detecção, parâmetros, limites, mensagens, erros) + testes unitários.
- [x] 6.4 Portas, migração 0006 e teste SQL; executar `db:migrate`/`db:test` quando o banco estiver disponível.
- [x] 6.5 Repositório `pg`, fila, cota e adaptadores OpenAI/Gemini + testes com servidor HTTP local e fakes.
- [x] 6.6 Casos de uso (request/process/status/cancel/retry/download) + testes unitários.
- [x] 6.7 Handlers HTTP, DI, integração com `SendMessageUseCase`, env e flag + testes de integração.
- [x] 6.8 Web: tipos, flag, ações, route handler de download, componente de mídia e polling + testes.
- [x] 6.9 Fake API ampliada e suíte E2E de mídia com portas 3017/3437.
- [x] 6.10 Documentação afetada e critérios de aceite da spec atualizados.
- [x] 6.11 QA completo (`db:migrate`, `db:test`, `lint`, `types:check`, `test`, `build`, `test:e2e`) e commits locais em `spec/017`.
- [x] 6.12 Marcar spec e plano como `done` e entregar relatório final.

Cada critério de aceite da spec é coberto por ao menos um teste listado no §8.

## 7. Riscos e mitigação

| Risco                             | Mitigação                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Billing/API do Google bloqueada   | Nenhuma chamada real nos gates; provider fakeado. Se uma chamada real for necessária e falhar por billing, parar e reportar bloqueio. |
| Custo abusivo                     | Cota por usuário, limites de tamanho/duração/resolução e retry máximo de 3 tentativas.                                                |
| Prompts ambíguos                  | Pergunta única de confirmação; nenhum job criado.                                                                                     |
| Recusa do provedor                | Código `CONTENT_REFUSED` mapeado para mensagem en-US sem detalhes do filtro.                                                          |
| Vazamento de segredo/conteúdo     | Chave só no servidor; logs só com IDs, modelo, parâmetros, duração, custo e desfecho.                                                 |
| Isolamento entre usuários         | `user_id` do guard em toda query e no download; 404 para outro usuário.                                                               |
| Concorrência/cancelamento         | `AbortController` por job; `update ... where status in ('queued','generating')` e verificação de posse antes de gravar resultado.     |
| Conflito com fatias paralelas     | Nenhum arquivo de 014–018 é tocado; fatia 016 reusada via cit helper, sem alterar a slice.                                            |
| Migração indisponível no ambiente | Registrar o bloqueio de Docker/Postgres e prosseguir com os demais gates; não inventar validação.                                     |

## 8. Plano de testes

- **Unitário API:** detecção de intenção (inclui "sem tipo" e "sem tema"), parsing/limites, mensagens
  de confirmação/sugestão, transições de estado, cota, cancelamento, retry, montagem de metadados e
  isolamento. Adaptadores testados contra servidor HTTP local com chave de teste (nunca real).
- **Integração API:** envio com flag on/off, `queued → ready`, falha sem arquivo parcial, download
  autenticado e 404 para outro usuário, cancelamento, retry e citação anexada.
- **SQL:** colunas/constraints/índices de `generated_media` e `messages.media`, cascade e leitura de
  mensagens antigas sem o campo novo.
- **Web (Vitest):** flag, ações de status/cancel/retry e mapeamento de erros en-US.
- **E2E (Playwright, portas 3017/3437):** imagem, vídeo, confirmação, limite, falha com "Try again",
  status e preview, download, recarga da conversa, citação, isolamento, teclado/foco e
  360/768/1280 px sem rolagem horizontal.
- **Regressão:** suítes de auth, chat, fontes, mídia como conhecimento e citações permanecem verdes.

## 9. QA manual

1. Flag desligada: pedir imagem → resposta textual padrão, sem anexo.
2. Flag ligada: pedir "create a launch image for social media" → status `queued → generating → ready`,
   preview com `alt`, metadados e download.
3. Pedir vídeo curto → clipe anexado com duração ≤ 8 s e resolução 720p.
4. Pedido sem tema/tipo → pergunta curta, nenhum job.
5. Pedido acima do limite → sugestão de ajuste, nenhuma chamada ao provedor.
6. Falha/cota/recusa → mensagem en-US acionável e "Try again" sem arquivo parcial.
7. Recarregar conversa → anexo e metadados permanecem; download funciona.
8. Outro usuário tenta baixar → acesso negado (404).
9. Referência `[n]` → citação aparece junto ao entregável.
10. Teclado/leitor de tela e 360/768/1280 px sem rolagem horizontal.

## 10. Rollout e rollback

- Flag desligada por padrão; habilitar primeiro imagem, depois vídeo (após validar billing/limites).
- Rollback: desligar a flag; mensagens antigas com mídia continuam baixáveis até a retenção do histórico.
- Migração é aditiva; nenhuma migração down é executada.

## 11. Evidências e pendências

Executado em 2026-11-18 no worktree isolado `spec-017`, branch `spec/017`, a partir de `dd33577`.
Nenhum merge, push, reset, down-migration ou chamada paga foi feito; specs/worktrees de 014–018
não foram alterados.

| Gate                                                            | Resultado real                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                 | ok — 544 pacotes                                                                  |
| `bun run db:migrate`                                            | bloqueado — Postgres/Docker indisponível (`ECONNREFUSED 127.0.0.1:5433`)          |
| `bun run db:test`                                               | bloqueado — mesma causa; nenhuma validação SQL foi inventada                      |
| `bun run lint`                                                  | ok — 3 tarefas Turbo                                                              |
| `bun run types:check`                                           | ok — 3 tarefas Turbo                                                              |
| `bun run test`                                                  | ok — API: 78 arquivos / 517 testes; web: 13 arquivos / 156 testes                 |
| `bun run build`                                                 | ok — `api` + `web`; rota `/app/media/[mediaId]/content` compilada                 |
| `bunx playwright test --config=playwright.multimedia.config.ts` | ok — 5/5 cenários da spec 017 em 46,4 s, portas isoladas 3017 (web) e 3437 (fake) |
| `git diff --check`                                              | ok — sem erros de whitespace                                                      |

O arquivo temporário `apps/web/playwright.multimedia.config.ts` foi usado somente para o gate E2E
isolado e removido antes dos commits. A suíte E2E padrão não foi reexecutada em 3000/3434 para não
colidir com worktrees paralelos.

**Commits locais em `spec/017` (Conventional Commits + trailer de coautoria):**

- `9dc494e` — `feat(media): add multimedia deliverables pipeline` (API, migration 0006, teste SQL e
  `.env.example`).
- `2cd905f` — `feat(web): show multimedia deliverables in expert chat` (componente, ações, rota de
  download, fake API e E2E).
- Commit final de documentação/spec/plano — aplicado após este registro.

**Pendências de rollout (fora desta fatia):**

- Validar `db:migrate`/`db:test` com Postgres/Docker disponível.
- Validar billing/limites da API Google e a chamada real de vídeo antes de habilitar a flag.
- Enviar os bytes da fonte citada ao modelo (hoje a citação é apenas anexada ao entregável).

Nenhuma chave, token, prompt, trecho, hash, URL sensível, bytes de arquivo ou valor de `.env` foi
lido, exibido ou registrado neste documento.
