# ADR 0007 — Observabilidade com OpenTelemetry e Grafana LGTM

> **Status:** aceito · **Data:** 2026-11-05
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

Ingestão de documentos e respostas de IA são fluxos difíceis de depurar sem correlação entre
logs, métricas e traces. A observabilidade precisa existir desde o dia 0, mas sem montar e
operar cada backend separadamente na fundação.

## Decisão

Instrumentar a API com **OpenTelemetry SDK 0.301.0**, emitindo logs estruturados em JSON com
`requestId`, métricas `http.server.*` e traces. A exportação usa **OTLP gRPC** em
`localhost:4317` (HTTP em `4318`) para a imagem all-in-one **`grafana/otel-lgtm:0.39.0`**, que
sobe via Docker Compose e expõe o Grafana em `http://localhost:3010` com acesso anônimo local.
O serviço é identificado por `service_name="coders-modulo-4-api"`.

## Consequências

### Positivas

- Logs, métricas e traces em um único lugar, com correlação por trace.
- Configuração mínima e versões fixadas.
- Diagnóstico disponível antes das features de produto.
- Ambiente local próximo do fluxo OTLP padrão.

### Negativas / trade-offs

- A imagem LGTM é pesada e o primeiro download demora.
- A configuração é local/demonstração; autenticação de produção não está definida.
- Exige manter a instrumentação e os atributos consistentes.

## Alternativas consideradas

| Alternativa                        | Por que foi descartada                            |
| ---------------------------------- | ------------------------------------------------- |
| Loki, Tempo e Prometheus separados | Mais configuração e manutenção na fundação        |
| APM SaaS                           | Custo e dependência externa antes do produto      |
| Sem observabilidade nesta fase     | Contraria o requisito de diagnosticar ingestão/IA |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#5-fluxo-de-dados-alvo)
- [QA.md](../.docs/QA.md)
- [`docker-compose.yml`](../docker-compose.yml)
