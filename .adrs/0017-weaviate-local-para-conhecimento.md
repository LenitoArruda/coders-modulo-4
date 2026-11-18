# ADR 0017 — Weaviate local e pipeline único de embeddings para conhecimento

> **Status:** aceito · **Data:** 2026-11-18
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

As fatias 013–015 precisam transformar três formatos muito diferentes — arquivo (PDF/TXT/Markdown),
URL pública e mídia convertida em texto por OCR/transcrição local — em uma base pesquisável por
similaridade. Sem um índice vetorial, cada fatia precisaria implementar sua própria busca e o chat
não teria contexto fundamentado. O projeto já roda PostgreSQL local, mas não possui extensão
vetorial configurada e o Compose expõe apenas a porta HTTP do Weaviate.

## Decisão

1. Usar **Weaviate local** no Compose, na porta HTTP 8080, com `vectorizer: none` e distância
   cosine. A classe `KnowledgeChunk` recebe vetores já calculados pela aplicação.
2. Padronizar o embeddings no modelo da fatia 013 (`text-embedding-3-small`, 1536 dimensões),
   reutilizando-o na consulta da fatia 016.
3. Implementar o adaptador por **REST/GraphQL** (sem gRPC), pois o Compose não publica a porta
   50051 e o cliente v3 exigiria esse protocolo.
4. Unificar o pipeline: validar → extrair texto → deduplicar por hash no escopo do usuário →
   fatiar em chunks → gerar embeddings → gravar chunk e vetor. URL e mídia reaproveitam o mesmo
   contrato de `Source`/`SourceVersion`; a mídia acrescenta apenas as colunas de
   `0004_knowledge_media.sql`.
5. Persistir o arquivo original em `bytea` no PostgreSQL (`0003`/`0004`), de modo que exclusão
   remova fonte, versões, chunks e vetores de forma coordenada.
6. Manter `WEAVIATE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` e `WEAVIATE_DISTANCE` como
   configuração; default de URL em loopback.

## Consequências

### Positivas

- Um único contrato de fonte serve a três canais de entrada diferentes.
- Busca por similaridade fica isolada atrás de portas, com repositório PostgreSQL para metadados.
- Sem dependência de extensão vetorial no PostgreSQL nem de cliente gRPC.
- Dedup por hash evita reprocessamento e vetores duplicados.

### Negativas / trade-offs

- Dois storages para manter (PostgreSQL + Weaviate) exigem rotina de exclusão coordenada.
- A indisponibilidade do Weaviate degrada o chat para respostas sem citações.
- Limites definitivos de upload, retenção e metas de latência/custo seguem em aberto.
- O Compose local não é uma política de produção; provedor/versão gerenciados são decisão futura.

## Alternativas consideradas

| Alternativa                       | Por que foi descartada                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Extensão vetorial no PostgreSQL   | Exigiria nova imagem/extensão e mudança no executor de migrações                         |
| Weaviate com vectorizer integrado | Vetores precisam usar o mesmo modelo da consulta e permanecer controlados pela aplicação |
| Cliente gRPC do Weaviate          | Porta 50051 não publicada no Compose                                                     |
| Busca por palavra-chave           | Não atende à recuperação semântica exigida pela spec 016                                 |

## Referências

- [AI.md](../.docs/AI.md)
- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md)
- [Spec 013](../.specs/013-knowledge-files.md), [014](../.specs/014-knowledge-url.md), [015](../.specs/015-knowledge-media.md)
