# Plano — Observabilidade e avaliação com LangSmith local

> Spec: .specs/018-langsmith-local.md
> Status: implementing
> Épico: .plans/012-expert-platform-breakdown.md (fatia 7)

## 1. Contexto

As fatias 012–016 entregam chat, fontes e RAG com citações, mas a telemetria actual
(`expert.chat`, `rag`, `knowledge.sources`) registra apenas identificadores, duração e
desfecho. A spec 018 pede rastreabilidade ponta a ponta, avaliação reproduzível e painel
local, com LangSmith self-hosted e nenhum dado enviado para a nuvem da LangChain.

Restrições verificadas antes do planejamento:

- O LangSmith self-hosted é um **add-on Enterprise** (imagem licenciada). Neste ambiente o
  Docker não responde e não há imagem licenciada, então subir o serviço real e validar
  Studio/CLI contra ele não é possível.
- A aplicação **deve continuar utilizável sem credencial externa**. Portanto a
  instrumentação é desligada por padrão e degrada graciosamente: falha do coletor nunca
  altera chat, RAG ou mídia.
- A fatia 017 (mídia gerada) ainda não está integrada neste worktree. O contrato de span
  de mídia é definido e testado, mas nenhum fluxo da 017 é reimplementado ou alterado.
- Nenhuma migração de banco é necessária: traces não são persistidos no PostgreSQL.

## 2. Objetivo e critérios de aceite

Entregar uma slice transversal `observability` que:

1. emite spans versionados com metadados obrigatórios (expert, conversa, mensagem,
   pseudônimo de usuário, modelo, timestamp, status e latência);
2. inclui metadados de recuperação (`topK`, `threshold`, `scores[]`, `sourceIds[]`,
   `chunksConsidered`) e de geração (`promptVersion`, tokens, custo estimado,
   `finishReason`);
3. define metadados de mídia e fontes sem conteúdo, hash, endereço ou trecho;
4. pseudonimiza `user_id` com HMAC estável e sanitiza PII (e-mail, telefone, tokens) antes
   de emitir, registrando apenas `obs.pii.sanitized`;
5. aponta por padrão para endpoint local e **rejeita** configuração para a nuvem quando a
   instrumentação está ligada (sem fallback automático);
6. descarta spans com aviso `obs.trace.dropped` quando o coletor está fora, sem quebrar a
   requisição do usuário;
7. fornece datasets sintéticos versionados e uma CLI de evaluation determinística, com
   relatório por métrica, comparação com baseline e código de saída inequívoco;
8. documenta operação, contrato, alertas e o caminho de evolução para Kubernetes.

Mapeamento dos critérios de aceite da spec:

| AC da spec                                         | Cobertura neste plano                                                |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| trace completo com expert/conversa/modelo/latência | passos 4 e 5; teste de integração                                    |
| metadados de recuperação                           | passo 5; teste unitário de emissão                                   |
| metadados de mídia                                 | passo 3 (contrato + teste); sem fluxo 017                            |
| PII mascarado e evento de sanitização              | passo 3; testes unitários                                            |
| coletor indisponível → chat normal + aviso         | passo 4; teste do sink com servidor que falha                        |
| CLI de evaluation com comparação                   | passo 6; execução da CLI no QA                                       |
| Studio inspecionar trace                           | **bloqueado** (serviço licenciado/Docker); contrato e docs entregues |
| alerta no painel navegar para traces               | correlação por `traceId` no LGTM existente + docs de operação        |
| config padrão aponta para local                    | passo 2; testes de config                                            |
| painel não exposto publicamente                    | passo 7; Compose em arquivo separado e portas em loopback            |

## 3. Escopo

### Dentro

- Nova slice `observability` na API (domínio, aplicação, infraestrutura, módulo), sem
  endpoints HTTP públicos.
- Configuração por variáveis de ambiente com flag `LANGSMITH_TRACING_ENABLED` (padrão
  `false`), endpoint local padrão, validação de endpoint e sal de pseudonimização.
- Instrumentação de `SendMessageUseCase`, `RetrieveContextUseCase` e
  `LangGraphExpertResponder` por injeção opcional, preservando assinaturas existentes.
- Contratos e utilitários de mídia/fonte prontos para a fatia 017, sem tocar nela.
- CLI de evaluation offline com datasets sintéticos versionados.
- Override de Compose opcional (arquivo separado, portas em loopback) e documentação.
- Testes unitários, de integração e execução da suíte E2E em portas isoladas 3018/3438.

### Fora

- Subir LangSmith self-hosted real, Studio e ingestão via API licenciada (bloqueado).
- Deployment/Deployment em Kubernetes, migração de dados e retenção definitiva (decisões
  abertas da spec).
- Qualquer alteração nas specs/worktrees 014–017, em migration de banco ou na UI do chat.
- Envio de traces para LangSmith Cloud ou para qualquer endpoint público.

## 4. Abordagem técnica

- **Camadas**: `domain` puro (contrato versionado, pseudônimo, sanitizador, custo,
  avaliação), `application` (porta `TraceSinkPort` + `TraceEmitter`), `infrastructure`
  (adaptador HTTP para o endpoint local + no-op + factory), `observability.module.ts` com
  tokens de DI.
- **Emissão**: `TraceEmitter` valida metadados obrigatórios (marca `missing`), sanitiza
  texto, pseudonimiza usuário, calcula custo e chama o sink. Todo erro é capturado e vira
  log `obs.trace.dropped`; nada é lançado para o chamador.
- **Sink HTTP**: fila limitada, flush por tamanho/tempo, `fetch` com timeout, POST
  `{endpoint}/runs` no contrato básico do LangSmith (`id`, `name`, `run_type`,
  `start_time`, `end_time`, `extra.metadata`, `inputs`/`outputs` sem conteúdo sensível).
  Sem dependência nova: usa `fetch` e `node:crypto` nativos.
- **Correlação**: um `traceId` (UUID) gerado por requisição em `SendMessageUseCase` é
  repassado às etapas de recuperação e geração; `conversationId`/`messageId` entram quando
  disponíveis, senão recebem o marcador `missing`.
- **Configuração**: `LANGSMITH_TRACING_ENABLED`, `LANGSMITH_ENDPOINT`,
  `LANGSMITH_API_KEY` (nunca logado), `OBS_USER_PSEUDONYM_SALT` (obrigatório só com a flag
  ligada), `OBS_TRACE_BATCH_SIZE`, `OBS_TRACE_FLUSH_INTERVAL_MS`, `OBS_SCHEMA_VERSION`
  implícito. Endpoint público/cloud é rejeitado na configuração quando ligado.
- **Evaluation**: datasets JSON sintéticos com nome + revisão; scorer determinístico por
  métrica; CLI em TypeScript executada por Bun, com `--baseline` para comparação e códigos
  de saída 0 (ok), 1 (limiar não atendido) e 2 (dataset ausente/inválido).

## 5. Arquivos e áreas afetadas

### Criados

- `apps/api/src/modules/observability/**` (domínio, aplicação, infraestrutura, módulo,
  tokens e testes).
- `scripts/obs-eval.ts`, `eval/datasets/*.json`.
- `docker-compose.langsmith.yml`, `.docs/OBSERVABILITY.md`, este plano.

### Alterados

- `apps/api/src/modules/shared/config/env.ts` e `env.spec.ts`.
- `apps/api/src/modules/conversations/**` (use case, responder, módulo) e
  `apps/api/src/modules/citations/**` (use case, módulo).
- `apps/api/src/test/setup-env.ts`, `package.json`, `.env.example`, `.gitignore`.
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/DEVELOPMENT.md`,
  `.specs/018-langsmith-local.md`.

## 6. Passos de implementação

- [x] Passo 1 — ler docs, spec, plano, código e confirmar estado do worktree.
- [x] Passo 1.1 — instalar dependências com `bun install --frozen-lockfile`.
- [x] Passo 2 — estender `env.ts`/`env.spec.ts` com as variáveis de observabilidade e
      validação local-only; atualizar `setup-env.ts` e `.env.example`.
- [x] Passo 3 — criar domínio `observability`: contrato de span versionado, pseudônimo,
      sanitizador de PII, estimador de custo e contratos de metadados de mídia/fonte, com
      testes unitários.
- [x] Passo 4 — criar aplicação e infraestrutura: `TraceSinkPort`, `TraceEmitter`, sink
      HTTP com fila/flush/falha graciosa, no-op e factory; módulo e tokens.
- [x] Passo 5 — instrumentar chat, recuperação e geração por injeção opcional; teste de
      integração com sink em memória e teste do adaptador HTTP contra servidor local.
- [x] Passo 6 — criar datasets sintéticos, scorer determinístico e CLI `obs:eval`; testar
      relatório, baseline, códigos de saída e ausência de dataset.
- [x] Passo 7 — adicionar override de Compose opcional, scripts e documentação operacional;
      atualizar ARCHITECTURE/QA/DEVELOPMENT/spec com decisões e bloqueios.
- [x] Passo 8 — QA completo: `db:migrate`, `db:test`, `lint`, `types:check`, `test`,
      `build`, `test:e2e` em portas 3018/3438; corrigir regressões. Gates de banco
      registrados como bloqueados por ausência de Postgres local.
- [x] Passo 9 — finalizar plano/spec como `done`, commit local Conventional Commits com o
      trailer exigido, árvore limpa e relatório final.

## 7. Riscos e mitigação

| Risco                           | Mitigação                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Instrumentação quebrar chat/RAG | injeção opcional, `TraceEmitter` nunca lança, flag desligada por padrão                      |
| Vazamento de PII                | pseudonimização HMAC + sanitização antes do sink; testes com e-mail/token sintéticos         |
| Endpoint cloud acidental        | validação local-only na config com erro explícito                                            |
| Overhead no caminho crítico     | emissão assíncrona em fila limitada; sem `await` no fluxo do usuário                         |
| Serviço licenciado indisponível | fallback no-op + documentação do bloqueio; nenhum commit de config inventada como "validada" |
| Conflito com a 017              | contrato de mídia apenas declarado e testado; nenhum arquivo da 017 tocado                   |

## 8. Plano de testes

- **Unitário**: pseudônimo estável e sem PII; sanitizador de e-mail/telefone/token; custo por
  modelo e arredondamento; validação de metadados obrigatórios/marcador `missing`;
  configuração padrão local, rejeição de endpoint cloud, flag desligada; scorer e CLI.
- **Integração**: `TraceEmitter` + sink em memória a partir de `SendMessageUseCase` (span
  raiz com expert/conversa/modelo/latência) e `RetrieveContextUseCase` (scores/sourceIds);
  adaptador HTTP contra servidor local (sucesso e falha → `obs.trace.dropped`).
- **Contrato**: payload do sink contém `extra.metadata.schemaVersion = 1` e nenhum campo
  proibido (`prompt`, `answer`, `email`, `password`, `apiKey`, `sessionToken`).
- **E2E**: suíte completa do web em portas isoladas 3018/3438 para regressão; nenhum novo
  cenário de UI porque a spec exclui redesign da interface.

## 9. QA manual

1. Com flag desligada, envia prompt no chat: resposta normal e nenhum span emitido.
2. Com flag ligada e coletor local fake ativo: envia prompt e verifica span raiz, spans de
   recuperação/geração e correlation por `traceId`.
3. Com flag ligada e coletor fora: resposta normal e aviso `obs.trace.dropped` em log.
4. Injeta e-mail/token sintético no prompt: span sem PII e evento `obs.pii.sanitized`.
5. Aponta `LANGSMITH_ENDPOINT` para host público com flag ligada: boot falha com erro claro.
6. Executa `bun run obs:eval` com e sem `--baseline`: relatório por métrica, diff e códigos
   0/1/2 conforme esperado.
7. Executa a suíte E2E isolada e confere ausência de regressão nos fluxos 012–016.

## 10. Rollout e rollback

- Rollout: habilitar `LANGSMITH_TRACING_ENABLED` somente quando o coletor local licenciado
  estiver disponível; manter `LANGSMITH_API_KEY` apenas no servidor.
- Rollback: desligar a flag (ou remover o override de Compose). Chat, RAG e fontes
  permanecem idênticos; nenhuma migração ou dado de usuário é alterado.
- Seguir como follow-up (decisões abertas da spec): versão/licença do LangSmith, backend de
  armazenamento, retenção, conteúdo em spans, limiares de evaluation, gate de deploy e
  evolução para Kubernetes.
