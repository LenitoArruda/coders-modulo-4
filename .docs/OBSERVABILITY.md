# Observabilidade e avaliação local — spec 018

> Status: **implementação local-first entregue; stack LangSmith self-hosted não validada**.
> Atualizado em: 2026-11-18.

Este documento descreve o que esta fatia realmente entrega, como habilitar a instrumentação e
como executar as evaluations offline. Nenhum valor de `.env`, chave, token, URL sensível, hash ou
conteúdo de prompt é registrado aqui.

## 1. Estado e bloqueios conhecidos

| Item                                            | Estado                       | Motivo                                                   |
| ----------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| Instrumentação de chat, recuperação e geração   | entregue e testada           | spans emitidos por injeção opcional                      |
| Coletor HTTP local + fallback gracioso          | entregue e testado           | sink `POST {endpoint}/runs` com `x-api-key`              |
| Sanitização e pseudonimização                   | entregue e testada           | HMAC-SHA256 com sal server-side                          |
| Evaluation offline determinística               | entregue e testada           | 4 datasets sintéticos versionados, CLI com baseline      |
| LangSmith self-hosted real                      | **bloqueado**                | daemon Docker indisponível na máquina de desenvolvimento |
| Studio e validação ao vivo de traces/grafo      | **bloqueado**                | depende da imagem Enterprise licenciada do self-hosted   |
| CLI de evaluation ao vivo contra LangSmith      | **bloqueado**                | mesma dependência; substituída pela CLI offline local    |
| Alertas no painel LGTM para `obs.trace.dropped` | não implementado nesta fatia | fora do contrato testado; evento de log já emitido       |

`docker-compose.langsmith.yml` é um **template opcional**, protegido pelo profile `langsmith`, que
exige `LANGSMITH_IMAGE` e `LANGSMITH_API_KEY` fornecidos por quem possui a licença. Ele não é
usado pelo `bun run infra:up` padrão e não deve ser interpretado como configuração validada.

## 2. Configuração

Variáveis lidas por `apps/api/src/modules/shared/config/env.ts` (consumir apenas `.env.example`
como referência; nunca versionar `.env`):

| Variável                    | Default                 | Finalidade                                           |
| --------------------------- | ----------------------- | ---------------------------------------------------- |
| `LANGSMITH_TRACING_ENABLED` | `false`                 | liga/desliga a emissão de spans                      |
| `LANGSMITH_ENDPOINT`        | `http://127.0.0.1:1980` | coletor local; apenas loopback/Docker DNS/RFC1918    |
| `LANGSMITH_API_KEY`         | —                       | obrigatória somente com a flag ligada; nunca logada  |
| `OBS_USER_PSEUDONYM_SALT`   | —                       | obrigatória somente com a flag ligada; usada no HMAC |

Regras de validação:

- endpoint público/cloud, protocolo diferente de HTTP(S) e credenciais embutidas na URL são
  rejeitados no boot quando a flag está ligada;
- com a flag desligada, o sink é `NoopTraceSink` e nenhuma variável adicional é exigida;
- falha do coletor nunca interrompe chat, RAG ou geração: o erro vira log `obs.trace.dropped`.

## 3. Contrato do span (schema v1)

Campos obrigatórios em `extra.metadata`: `traceId`, `conversationId`, `messageId`, `expertId`,
`userPseudonym`, `modelId`, `timestamp`, `status`, `latencyMs`. Campos ausentes recebem o marcador
`missing` e geram o evento `obs.trace.missing_metadata` sem falhar a requisição.

Metadados por etapa:

- **recuperação:** `topK`, `threshold`, `scores[]`, `sourceIds[]`, `chunksConsidered`;
- **geração:** `promptVersion`, `tokensIn`, `tokensOut`, `estimatedCost`, `finishReason`;
- **mídia:** `mediaKind`, `modelId`, `parameters`, `sizeBytes`, `durationSeconds`;
- **fontes:** `sourceId`, `sourceVersionId`, `extractionMethod` — sem hash, endereço ou trecho.

Payload enviado ao coletor: `id`, `name`, `run_type`, `start_time`, `end_time`, `status`, `tags`,
`extra.metadata`, `inputs: {}` e `outputs: {}`. Mapeamento de `run_type`: `chat`/`media`/`source`
→ `chain`, `retrieval` → `retriever`, `generation` → `llm`.

Segurança:

- `userPseudonym = HMAC-SHA256(salt, userId)` — estável por usuário, sem e-mail/nome;
- sanitização recursiva remove chaves proibidas (`prompt`, `answer`, `content`, `email`,
  `password`, `apiKey`, `sessionToken`, `authorization`, `url`, `address`, `hash`, `raw`) e
  mascara e-mail/telefone/token, registrando apenas `obs.pii.sanitized`;
- nenhum prompt, resposta, PII, chave ou conteúdo de arquivo é enviado ao coletor por padrão;
- emissão é assíncrona em fila limitada, com flush por intervalo/tamanho configuráveis.

Isolamento: não há workspace nesta fatia; toda correlação é por usuário autenticado, conversa e
mensagem. A fatia 017 é representada apenas por contrato/metadados de mídia — nenhum fluxo dela
foi alterado.

## 4. Evaluation offline

Datasets versionados em `eval/datasets/` (nome + revisão string, casos sintéticos):

| Dataset                 | Métrica             | Limiar default |
| ----------------------- | ------------------- | -------------- |
| `expert-answer-quality` | `answer_quality`    | 0.8            |
| `citation-fidelity`     | `citation_fidelity` | 0.8            |
| `rag-no-answer`         | `no_answer`         | 0.8            |
| `multimedia-intent`     | `media_intent`      | 0.8            |

Execução:

```bash
bun run obs:eval
bun run obs:eval --dataset eval/datasets/expert-answer-quality.json
bun run obs:eval --baseline eval/reports/baseline.json
bun run obs:eval --out eval/reports/current.json
```

Códigos de saída: `0` = todos os limiares atendidos; `1` = pelo menos um limiar não atendido;
`2` = dataset ausente/inválido ou baseline inválido. O relatório mostra score, limiar, `PASS`/`FAIL`
e `delta` por métrica quando `--baseline` é informado. Nenhum modelo externo é chamado: o scorer é
puro e determinístico, adequado para gate local antes de mudanças de prompt/modelo.

`eval/reports/` é ignorado pelo Git para evitar versionar relatórios gerados.

## 5. Verificação manual (quando a stack licenciada existir)

1. com a flag desligada, enviar prompt no chat: resposta normal e nenhum span;
2. com a flag ligada e coletor local ativo: conferir span raiz + recuperação + geração com o mesmo
   `traceId`;
3. com a flag ligada e coletor fora: resposta normal e `obs.trace.dropped` em log;
4. injetar e-mail/token sintético: span sem PII e evento `obs.pii.sanitized`;
5. apontar endpoint público com a flag ligada: boot falha com erro claro;
6. rodar `bun run obs:eval` com e sem `--baseline` e conferir exit codes 0/1/2;
7. abrir o trace no Studio e conferir o grafo — **não executável nesta fatia** (ver §1).

## 6. Decisões abertas (fora desta fatia)

Versão/licença do LangSmith, backend de armazenamento, retenção, conteúdo de prompt/resposta em
spans, limiares por suite, gate de deploy automático e evolução para Kubernetes. Ver
[`.specs/018-langsmith-local.md`](../.specs/018-langsmith-local.md), seção 15.
