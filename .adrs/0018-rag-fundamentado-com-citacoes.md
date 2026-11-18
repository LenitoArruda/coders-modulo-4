# ADR 0018 — RAG fundamentado com citações e rollout por flag

> **Status:** aceito · **Data:** 2026-11-18
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A partir da spec 012, o chat respondia usando apenas a persona do Expert, sem consultar a base de
conhecimento. Com a base vetorial disponível (ADR 0017), era necessário decidir como incorporar
contexto sem transformar trechos recuperados em instruções, como tornar a resposta verificável e
como lançar a mudança sem alterar o comportamento de quem ainda não queria RAG.

## Decisão

1. Recuperar com `RAG_TOP_K = 5` e `RAG_THRESHOLD = 0.35`, limitar o contexto a
   `RAG_MAX_CONTEXT_CHARS = 6000` e o histórico a `RAG_MAX_HISTORY_MESSAGES = 6`.
2. Gerar a resposta com marcadores inline `[n]`; persistir `Citation`, `RetrievalMetadata` e
   `AnswerStatus` na mensagem e renderizar o drawer de fontes no web.
3. Tratar todo conteúdo recuperado como **dados não confiáveis**: instruções encontradas em
   arquivo/URL/mídia não podem alterar persona, ferramentas ou permissões. Marcadores órfãos são
   descartados (`GroundedAnswer.invalidCitationNumbers`) e geram `rag.citation.invalid`.
4. Degradar com segurança: falha do vetorial produz resposta sem citações e status
   `retrieval_unavailable`; ausência de correspondência produz `no_match` sem inventar fontes.
5. Controlar o rollout com `RAG_CITATIONS_ENABLED` (default `false`). As flags de mídia como
   conhecimento e entregáveis são independentes.
6. Medir localmente com a evaluation offline determinística da spec 018; metas numéricas em
   ambiente real permanecem como pendência explícita.

## Consequências

### Positivas

- Respostas verificáveis, com fonte, versão, localização e sinais de fonte antiga/removida.
- Ativação incremental por flag, sem mudar o contrato da rota de chat.
- Prompt injection e alucinação de citações têm tratamento explícito no domínio.

### Negativas / trade-offs

- Mais uma etapa de latência (embedding da consulta + busca) antes da geração.
- Citações precisam ser reconciliadas entre resposta textual e anexo de mídia (spec 017).
- Metas de fidelidade e p95 ainda não foram medidas em ambiente com modelo e banco reais.

## Alternativas consideradas

| Alternativa                                  | Por que foi descartada                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Responder apenas com a persona (spec 012)    | Não permitiria fundamentação nem rastreabilidade                     |
| Injetar todo o conteúdo das fontes no prompt | Inviável em custo/limite de contexto e aumentaria risco de injection |
| Citações sem persistência                    | Não sobreviveriam a reload da conversa                               |
| Lançar sem flag                              | Mudaria o comportamento de todos os usuários de uma vez              |

## Referências

- [AI.md](../.docs/AI.md)
- [Spec 016](../.specs/016-rag-citations.md)
- [OBSERVABILITY.md](../.docs/OBSERVABILITY.md)
