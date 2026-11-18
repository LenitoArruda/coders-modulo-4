# Plano — Fontes de conhecimento por URL (spec 014)

> Spec: `.specs/014-knowledge-url.md`
> Status: done
> Atualizado em: 2026-11-18

## 1. Contexto

A fatia 013 entregou o contrato de fonte (`Source`, `SourceVersion`, `Chunk`, `Document`) e a
ingestão de PDF/TXT/Markdown com deduplicação por hash, chunks, embeddings e vetores no Weaviate
local. Esta fatia adiciona páginas externas públicas como conector, sem criar um tipo paralelo de
fonte e sem nova migração de esquema.

Decisão de representação: uma página é persistida como fonte `txt` com `mime_type = text/plain+url`.
O texto extraído da página vira `source_files.content`; o SHA-256 desse texto é o `content_hash`.
`sources.normalized_name` agrupa as versões pela URL normalizada; `sources.name` guarda o título
obtido; `source_versions.original_name` guarda a URL para retry. `SourceSummary` passa a expor
`url` somente para fontes com esse marcador de MIME. Nenhuma coluna ou constraint muda.

## 2. Objetivo e critérios de aceite

Mapear os dez critérios da spec para entregas verificáveis:

1. Campo “Add a URL”, rótulo e mensagens em en-US na home privada → UI + Server Action.
2. URL pública com texto: `processing` → `ready`, com título, endereço normalizado e chunks →
   caso de uso que busca, extrai e delega ao pipeline da fatia 013.
3. Reenvio da mesma URL/conteúdo: “Already connected” sem nova versão, chunk ou vetor → dedup por
   hash do texto obtido.
4. Duas URLs com o mesmo conteúdo: apenas uma fonte válida → mesmo hash no escopo do usuário.
5. Esquema inválido ou endereço interno: recusado antes da busca, em inglês → validação de borda e
   política de SSRF no adaptador.
6. Conteúdo alterado na mesma URL: nova `SourceVersion`, anterior desatualizada → agrupamento por
   URL normalizada + hash do conteúdo.
7. Página inacessível/sem texto: versão `failed`, sem vetores, com retry → versão de falha
   persistida e retry que refaz a busca.
8. Dois usuários, mesma URL: fontes e vetores separados → escopo por `userId` em todas as rotas.
9. Exclusão remove URL, versões, chunks e vetores → reuso integral de `DeleteSourceUseCase`.
10. Logs/telemetria sem URL, trecho de página ou hash → campos permitidos enumerados.

## 3. Escopo

### Dentro

- Política de domínio para URL: normalização, remoção de fragmentos/parâmetros de rastreamento,
  bloqueio de esquemas, SSRF (IPs privados/loopback/link-local/metadados, redirecionamentos),
  timeout, limite de tamanho, retries e extração de texto/título HTML sem dependências novas.
- Porta `WebPageFetcherPort` e adaptador HTTP local com redirecionamento manual e validação em
  cada salto.
- Casos de uso: conectar URL, falha persistida, retry com refetch; handler 1:1
  `POST /api/v1/sources/urls`.
- Extensões mínimas e aditivas ao contrato 013: `displayName` no arquivo validado,
  `errorMessage` em nova versão, `updateVersionContentHash` no repositório, `url` no resumo.
- UI: formulário de URL no painel existente, linhas com título/endereço, estados en-US e a11y.
- Server Action, fake API de E2E, testes unitários/integração/E2E e documentação afetada.

### Fora

- Novo tipo `SourceType`, nova migração SQL, down-migration, reset de banco.
- Login em sites de terceiros, `robots.txt`, crawling, mídia, RAG/citações, LangSmith.
- Push, merge, alterações na branch principal ou nas specs 015–018.

## 4. Abordagem técnica

- **Normalização:** aceita só `http`/`https`; remove fragmento, parâmetros `utm_*`, `fbclid`,
  `gclid`, `msclkid`, `ref`; porta padrão e barra final são removidas; alvo lowercase; limite de
  255 caracteres (alinhado ao constraint existente de `sources.name`).
- **SSRF:** antes de cada requisição (incluindo redirecionamentos) o hostname é resolvido e todos os
  endereços são verificados; faixas privadas, loopback, link-local, unspecified, multicast e
  metadados são bloqueadas. A conexão usa o IP resolvido com `Host`/SNI originais para reduzir
  rebinding. Redirecionamentos são manuais e limitados; alvos bloqueados encerram a operação.
- **Busca:** `http.request`/`https.request` com timeout de 8 s, no máximo 3 redirecionamentos,
  2 MB de resposta e 1 retry apenas em falha transitória/5xx. Valores configuráveis por DI com
  padrões seguros; `allowPrivateHosts` existe apenas para testes locais do adaptador.
- **Conteúdo:** HTML é tratado como dados não confiáveis; script/style/noscript/comments são
  removidos, entidades comuns são decodificadas e o texto é colapsado. Nenhuma instrução da página
  altera regras da aplicação. Título vem de `<title>` ou do host/caminho.
- **Dados:** reuso de `ConnectSourcesUseCase`, `ProcessSourceVersionUseCase`,
  `DeleteSourceUseCase`, índice único parcial de hash e RLS existente. Falha de busca gera versão
  `failed` com hash derivado da URL (fora do índice único) e mensagem acionável genérica.
- **Retry:** versões com `mime_type = text/plain+url` refazem a busca, atualizam hash/tamanho,
  gravam o texto e reaproveitam `ProcessSourceVersionUseCase`.
- **Observabilidade:** `log("knowledge.sources", ...)` com IDs opacos, `outcome`, `durationMs`,
  `chunkCount` e códigos genéricos. Nada de URL, título, texto, hash, token ou chave.

## 5. Arquivos e áreas afetadas

- `apps/api/src/modules/sources/domain/**` (política, erros, constantes e tipos).
- `apps/api/src/modules/sources/application/**` (porta de busca, casos de uso, extensões 013).
- `apps/api/src/modules/sources/infrastructure/**` (adaptador HTTP, repositório pg, fakes).
- `apps/api/src/modules/sources/interface/**` (handler e mapeamento de erros).
- `apps/api/src/modules/sources/sources.module.ts`, `sources.tokens.ts`, `test/setup-env.ts`.
- `apps/api/src/test/fakes/in-memory-sources.repository.ts`, fake de busca.
- `apps/web/lib/knowledge/types.ts`, `app/app/source-actions.ts`,
  `app/app/_components/knowledge-sources.tsx`.
- `apps/web/app/app/source-actions.spec.ts`, `apps/web/e2e/support/fake-api-server.ts`,
  `apps/web/e2e/knowledge-sources.spec.ts`.
- `.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.docs/BUSINESS.md`, spec e este plano.

## 6. Passos de implementação

- [x] 6.1 Criar este plano e marcar spec/plano como `implementing`.
- [x] 6.2 Domínio: normalização, SSRF, extração, limites e erros + testes unitários.
- [x] 6.3 Porta e adaptador HTTP com redirecionamento seguro + testes com servidor local.
- [x] 6.4 Extensões aditivas ao contrato 013 (repositório, tipos, fake em memória).
- [x] 6.5 Casos de uso de conectar/falha/retry + handler e DI + testes de integração.
- [x] 6.6 Web: tipos, Server Action e painel com formulário de URL + testes de action.
- [x] 6.7 Fake API e E2E: válida, duplicata, conteúdo igual em URLs distintas, conteúdo alterado,
      endereço interno, sem texto, isolamento, exclusão, teclado e responsividade.
- [x] 6.8 Documentação, critérios de aceite da spec e marcação final do plano como `done`.
- [x] 6.9 QA completo e commit local na `spec/014`.

## 7. Riscos e mitigação

| Risco                       | Mitigação                                                                      |
| --------------------------- | ------------------------------------------------------------------------------ |
| SSRF por DNS rebinding      | Conexão ao IP resolvido com `Host`/SNI originais; validação em cada salto.     |
| Página com conteúdo hostil  | Texto tratado como dado; tags ativas removidas; nada é interpretado.           |
| Duplicação sob concorrência | Índice único parcial existente e conversão de conflito em “Already connected”. |
| Falha de busca sem versão   | Versão `failed` persistida com hash derivado da URL, fora do índice único.     |
| Retry de falha de busca     | Refetch antes de reusar o processamento assíncrono da fatia 013.               |
| URL longa demais            | Limite de 255 caracteres na borda, alinhado ao schema existente.               |
| Log com dados sensíveis     | Campos permitidos enumerados e testes de regressão.                            |

## 8. Plano de testes

- Unitário (Vitest/API): normalização, parâmetros de rastreamento, esquemas bloqueados,
  faixas de IP privadas/loopback/metadados, redirecionamento seguro, extração de título/texto,
  decisão de dedup, falha persistida e retry.
- Integração (Vitest + Supertest): `POST /sources/urls` autenticado, duplicata, conteúdo igual em
  URLs diferentes, conteúdo alterado, endereço interno, sem texto, isolamento e exclusão.
- E2E (Playwright): fluxo completo no painel com a fake API, incluindo 360/768/1280 px e teclado.
- Regressão: suítes de auth, chat e conexões por arquivo permanecem verdes.

## 9. QA manual

1. Abrir `/app` com sessão e conferir o campo “Add a URL” no painel.
2. Adicionar uma página pública simulada e acompanhar `processing` → `ready`.
3. Reenviar a mesma URL e outra URL com o mesmo conteúdo: “Already connected”.
4. Reenviar URL com conteúdo alterado: nova versão.
5. Tentar `http://127.0.0.1/...` e `file:///etc/passwd`: mensagens em inglês, sem busca.
6. Tentar página inacessível e sem texto: `failed` com retry funcional.
7. Excluir a fonte e confirmar remoção de versões/chunks/vetores.
8. Inspecionar logs: sem URL, título, texto, hash, token ou chave.

## 10. Rollout e rollback

- Sem feature flag: o campo passa a existir junto ao fluxo de conexões da fatia 013.
- Rollback: desregistrar o handler/caso de uso de URL; fontes já gravadas permanecem.
- Nenhuma migração adicional é executada.

## 11. Evidências e pendências

- `bun install --frozen-lockfile`: ok (544 pacotes).
- `bun run lint`: ok — 3 tarefas bem-sucedidas (1 em cache), 1m2,692s.
- `bun run types:check`: ok — 3 tarefas bem-sucedidas (1 em cache), 1m33,203s.
- `bun run test`: ok — 2 tarefas, 4m33,172s; API 66 arquivos/442 testes, web 11 arquivos/147 testes.
- `bun run build`: ok — 2 tarefas, 31,807s.
- `bun run test:e2e` (`apps/web`, `--workers=1`): 147 testes; 144 passaram na execução completa e os
  3 testes pré-existentes que expiraram por timeout do Next dev (`confirm-account` e `expert-chat`,
  nenhum da fatia 014) passaram isoladamente na repetição (3/3). Os 11 fluxos de URL passaram na
  execução completa, incluindo 360/768/1280 px e operação por teclado.
- `bun run db:migrate` / `bun run db:test`: bloqueados no ambiente local — Docker não está
  instalado/em execução; a porta 5433 recusa conexão e a 5432 rejeita a autenticação. Esta fatia
  não cria migração: reaproveita o esquema da fatia 013.
- Critérios de aceite: 10/10 marcados na spec; spec e plano com status `done`.
- Decisões abertas mantidas: limites definitivos de busca, `robots.txt` e metas de latência/custo.
- Commit de implementação: `2516a7c3bda15fddfdac611610de47779403c56e` (`spec/014`).
- Commit de evidências: ver `git log -1 --format=%H` nesta branch (registro final do relatório).
