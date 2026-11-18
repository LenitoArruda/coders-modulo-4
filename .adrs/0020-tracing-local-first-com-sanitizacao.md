# ADR 0020 — Tracing local-first com sanitização e evaluation offline

> **Status:** aceito · **Data:** 2026-11-18
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

Observar chat, recuperação e geração é necessário para diagnosticar latência, custo e qualidade.
Ao mesmo tempo, esses fluxos contêm prompt, resposta, trechos de documentos e identificadores de
usuário. Enviar isso a um SaaS externo — ou exigir uma stack licenciada para desenvolver — criaria
risco de privacidade e bloquearia a entrega. A spec 018 precisava de um caminho executável sem
dependência de imagem Enterprise nem de daemon Docker disponível.

## Decisão

1. Manter dois subsistemas independentes: OpenTelemetry nativo (logs/métricas/traces no LGTM) e
   spans customizados no formato de ingestão do LangSmith, desligados por padrão
   (`LANGSMITH_TRACING_ENABLED=false`).
2. Quando ligado, o sink aceita **apenas** endpoint local (loopback, Docker DNS ou RFC1918),
   exigindo chave e salt; URL pública, protocolo inválido ou credenciais embutidas falham no boot.
3. Aplicar política de metadados, sanitização recursiva de chaves/padrões proibidos e
   pseudonimização HMAC-SHA256 do `userId` antes de qualquer envio. `inputs` e `outputs` vazios.
4. Tornar a emissão assíncrona e não bloqueante: falha do coletor vira log `obs.trace.dropped` e
   nunca interrompe o fluxo do usuário.
5. Substituir a evaluation ao vivo por scorer puro e determinístico, quatro datasets sintéticos
   versionados e CLI `bun run obs:eval` com limiar default `0.8`, `--baseline` e códigos 0/1/2.
6. Registrar explicitamente como bloqueados Studio, traces ao vivo, persistência/retention e
   validação com a stack licenciada.

## Consequências

### Positivas

- Nenhum prompt, resposta, PII ou segredo sai do ambiente por padrão.
- Desenvolvimento e CI são determinísticos, sem dependência de serviço externo.
- A flag permite habilitar observação de IA sem alterar rotas ou contratos de API.
- O gate offline detecta regressões antes de mudanças de prompt/modelo.

### Negativas / trade-offs

- `requestId` HTTP, `traceId` OTel e `traceId` local ainda não são unificados.
- A fila do sink é um array em memória sem limite/backpressure; só há log de drop.
- Builders de metadados de mídia/fontes não são chamados nos fluxos reais.
- Não há painéis de custo/RAG/mídia nem alertas; a validação ao vivo segue bloqueada.

## Alternativas consideradas

| Alternativa                                       | Por que foi descartada                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| LangSmith SaaS com tracing sempre ligado          | Exporia prompt/resposta e dependeria de credencial externa no desenvolvimento |
| Exigir stack self-hosted licenciada para entregar | Imagem Enterprise e daemon Docker indisponíveis na máquina de desenvolvimento |
| Logar prompt/resposta para debug                  | Viola a política de privacidade do projeto                                    |
| Métricas de domínio em OTel desde já              | Ampliaria o escopo da fatia; sinais hoje existem como atributos de log/span   |

## Referências

- [OBSERVABILITY.md](../.docs/OBSERVABILITY.md)
- [AI.md](../.docs/AI.md)
- [Spec 018](../.specs/018-langsmith-local.md)
- [ADR 0007 — Observabilidade com OpenTelemetry e LGTM](./0007-observabilidade-otel-lgtm.md)
