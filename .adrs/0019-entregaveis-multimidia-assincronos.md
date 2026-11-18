# ADR 0019 — Entregáveis multimídia assíncronos com cota e `bytea`

> **Status:** aceito · **Data:** 2026-11-18
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A spec 017 pede geração de imagem e vídeo a partir do chat, com confirmação quando o briefing está
incompleto, preview, download, retry e cancelamento. A geração é lenta e pode falhar; não pode
bloquear a requisição de chat nem permitir que um usuário consuma recursos ilimitados. Também era
necessário evitar um diretório compartilhado de arquivos, que complicaria isolamento e limpeza.

## Decisão

1. Detectar intenção no envio de mensagem, validar briefing (até `2000` caracteres) e enfileirar
   job assíncrono com estados `queued` → `generating` → `ready`/`failed`/`cancelled`.
2. Usar `gpt-image-2` para imagem e `gemini-omni-1.2-flash` para vídeo (`4/6/8 s`, `720p`), atrás
   de modelos configuráveis por variável de ambiente.
3. Limitar a `20 MB` por arquivo, `3` tentativas e cota por `user_id` de `10` imagens e `2` vídeos
   por hora; retry e cancelamento devolvem cota quando aplicável.
4. Persistir os bytes em `bytea` no PostgreSQL e expor download autenticado por proxy no web,
   negando acesso a outro usuário.
5. Anexar ao resultado a citação `[n]` da última resposta quando ela existir
   (`MediaAttachment.citation`), sem alterar o contrato da spec 016.
6. Controlar com `MULTIMEDIA_DELIVERABLES_ENABLED` (default `false`), cookie equivalente no web.

## Consequências

### Positivas

- Chat responsivo: a geração acontece fora do ciclo da requisição.
- Isolamento por usuário e download autenticado sem volume de arquivos compartilhado.
- Cota e retry evitam abuso e permitem recuperação de falhas transitórias.
- Anexo referencia a fonte usada na resposta, fechando o ciclo conhecimento → entregável.

### Negativas / trade-offs

- Fila e cota são **em memória**: não sobrevivem a restart.
- Jobs não terminais com mais de `10 min` são marcados como falha por timeout.
- A chamada real ao Gemini depende de billing/API habilitados; a validação local foi feita com
  providers fakeados.
- `bytea` aumenta o tamanho do banco e exige política de limpeza a definir.

## Alternativas consideradas

| Alternativa                       | Por que foi descartada                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Geração síncrona na requisição    | Latência imprevisível e risco de timeout no chat                    |
| Disco compartilhado/volume Docker | Isolamento e limpeza mais complexos; `bytea` já é usado para fontes |
| Cota em banco                     | Complexidade adicional para o MVP; store compartilhado é follow-up  |
| Sem citação no anexo              | Perderia a rastreabilidade da fonte pedida pela spec 017            |

## Referências

- [AI.md](../.docs/AI.md)
- [Spec 017](../.specs/017-multimedia-deliverables.md)
- [ADR 0017](./0017-weaviate-local-para-conhecimento.md)
