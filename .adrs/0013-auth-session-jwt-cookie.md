# ADR 0013 — Sessão com JWT HS256, registro server-side e cookie HttpOnly

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A fatia 001 criou as tabelas `users`, `auth_tokens` e `sessions`, mas nada emitia, validava ou
revogava sessão. As fatias de confirmação (005) e sign-in (006) precisam de uma fundação única:
JWT assinado pela API, sessão registrada no banco para permitir revogação imediata, cookie
`HttpOnly` no web e um endpoint autenticado (`GET /api/v1/auth/me`) que prove o fluxo de ponta a
ponta. A spec 002 proíbe novas migrações/funções no banco nesta fatia e exige sessão única por
pessoa, contrato de erro estável e nenhum token/PII em logs.

## Decisão

1. **JWT HS256** assinado pela API com `JWT_SECRET` (obrigatório, mínimo de 32 caracteres,
   validado no boot). Claims apenas `sub` (id da pessoa), `sid` (id da sessão), `iat` e
   `exp = iat + SESSION_TTL_SECONDS` (padrão de 7 dias). Qualquer falha de assinatura, formato
   ou expiração vira `InvalidSessionError` no adaptador `jose`.
2. **Registro server-side obrigatório**: toda requisição autenticada consulta a sessão ativa
   (`revoked_at is null` e `expires_at > now`) e confere `sub == sessions.user_id`. Assinatura
   válida **não** basta; sessão revogada deixa de valer imediatamente.
3. **Sessão única com ordem create-then-revoke**: o caso de uso cria a nova sessão e depois
   revoga todas as ativas da pessoa exceto a nova (`id != novo`). A spec descreve
   "revoga anteriores → cria nova"; sem transação no banco (vedada nesta fatia), só a ordem
   invertida garante o invariante sob concorrência: a última revogação sempre remove tudo exceto
   a própria sessão, então duas criações simultâneas nunca deixam duas ativas (o pior caso deixa
   as duas revogadas, exigindo novo sign-in).
4. **Cookie `HttpOnly` no web**, nome `session_token`, `SameSite=Lax`, `Path=/`, `Max-Age` igual
   ao TTL da sessão e `Secure` apenas em produção. A API só aceita `Authorization: Bearer`; o
   servidor do web lê o cookie e monta o header (`apps/web/lib/auth`). O token nunca chega ao
   bundle ou ao JavaScript do navegador.
5. **Namespace `/api/v1`**: o hello passa a `GET /api/v1/hello` e `GET /` deixa de existir
   (404 com o contrato de erro). Caminhos fora do prefixo também respondem o contrato.
6. **Contrato de erro estável** `{ code, message, fieldErrors? }` renderizado por um filtro
   global; o 401 de sessão usa uma mensagem única e não distingue ausência, expiração, revogação
   ou assinatura inválida.
7. **Adaptadores**: `jose@6` (JWT), `@supabase/supabase-js` com credencial `service_role`
   (PostgREST, RLS contornada apenas no servidor) e `nodemailer` (SMTP local/Mailpit exposto em
   `127.0.0.1:54325`).

## Consequências

### Positivas

- Revogação imediata sem esperar a expiração do JWT.
- Token inacessível ao JavaScript, reduzindo o impacto de XSS.
- Política de sessão única pronta e compartilhada pelas fatias 005/006, com e-mail de nova
  sessão e contrato de erro únicos.
- O web passa a consumir a API versionada (`/api/v1`) com um único ponto de ponte de sessão.

### Negativas / trade-offs

- Cada requisição autenticada faz duas leituras no Postgres (sessão e pessoa); o p95 local segue
  dentro da meta, mas o caminho depende do banco.
- A garantia de sessão única é da aplicação, não atômica no banco: o pior interleaving revoga as
  duas sessões (novo login), nunca mantém duas ativas.
- `jose` é ESM-only e a API compila CommonJS; o runtime depende do `require(esm)` do Node ≥ 24/Bun,
  coberto por build e QA manual.
- O segredo `JWT_SECRET` vira requisito de boot: ambientes sem ele falham explicitamente.

## Alternativas consideradas

| Alternativa                                | Por que foi descartada                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| JWT stateless sem registro no banco        | Não permite revogação imediata nem sessão única (spec §9)                              |
| Sessão opaca sem JWT                       | A spec determina JWT com `sub`, `sid`, `iat` e `exp`                                   |
| `@nestjs/jwt`                              | `jose` cobre HS256 com API moderna e já foi escolhido no plano                         |
| Ordem revoke-then-create (literal da spec) | Sob concorrência permite duas sessões ativas; create-then-revoke preserva o invariante |
| Função/RPC transacional no Postgres        | Proibida pela spec §12 nesta fatia; registrada como follow-up                          |
| Supabase Auth                              | ADR 0012: a autenticação é própria da API                                              |

## Follow-ups

- Criar função/RPC transacional (ex.: `create_session_and_revoke_others`) quando a restrição de
  schema for levantada, garantindo atomicidade estrita.
- A fatia 007 adiciona o link de recuperação de senha no e-mail de nova sessão.
- As fatias 005/006 gravam o cookie e validam a inspeção no navegador (não há fluxo público de
  criação de sessão nesta fatia).

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md)
- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [QA.md](../.docs/QA.md)
- [Spec 002 — Auth session](../.specs/002-auth-session.md)
- [ADR 0012 — Auth própria na API](./0012-auth-propria-na-api.md)
