# ADR 0012 — Autenticação própria na API, sem Supabase Auth

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O épico de autenticação exige sign-up, confirmação de conta, sessão única por pessoa (o último
login invalida os anteriores), e-mails de nova sessão, recuperação de senha com token opaco de
uso único e revogação de sessões no reset. Também exige respostas anti-enumeração e controle do
ciclo de vida da sessão a partir da API NestJS.

O Supabase oferece Supabase Auth, mas ele impõe suas próprias tabelas, fluxos e políticas de
sessão. Atender aos requisitos acima exigiria contornar boa parte do componente, misturando o
modelo do Supabase Auth com tabelas de domínio da aplicação. O Supabase/Postgres continua sendo
o banco escolhido para o produto.

## Decisão

Usar **autenticação própria na API NestJS**, emitindo JWT de sessão. O Supabase/Postgres é usado
apenas como banco de dados, com o schema de auth criado em `supabase/migrations/`:

- `users` — conta, e-mail normalizado/único e hash de senha.
- `auth_tokens` — tokens opacos de uso único para confirmação de e-mail e reset de senha,
  persistidos apenas como hash.
- `sessions` — registro server-side das sessões, com expiração e revogação, usado para validar e
  invalidar JWTs.

No ambiente web, o JWT é transportado em cookie `HttpOnly`; o servidor do web encaminha o valor
como `Authorization: Bearer` para a API. O JavaScript do navegador não lê o token. As tabelas de
auth têm RLS habilitado sem policies para `anon`/`authenticated`, e a API opera com a credencial
de servidor.

## Consequências

### Positivas

- Controle total sobre sessão única, revogação, TTL e e-mails transacionais.
- Modelo de dados explícito e testável (constraints, RLS e pgTAP).
- Respostas anti-enumeração e mensagens de erro sob controle da API.
- Sem acoplamento ao modelo de tabelas e fluxos do Supabase Auth.
- O Supabase segue entregando Postgres local reproduzível e storage.

### Negativas / trade-offs

- A aplicação passa a ser dona da superfície de segurança: hash de senha, assinatura/validação
  de JWT, revogação, rate limiting e limpeza de tokens expirados.
- Mais código e testes próprios do que delegar ao Supabase Auth.
- A decisão do algoritmo de hash de senha (bcrypt/argon2) e o custo ficam em aberto na fatia 002.

## Alternativas consideradas

| Alternativa                    | Por que foi descartada                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Supabase Auth                  | Sessão única, e-mails e revogação no reset exigiriam contornar o componente         |
| NextAuth/Auth.js no web        | Foca o front; a API continuaria precisando validar e revogar sessão                 |
| Provedor de identidade externo | Complexidade e custo desproporcionais ao MVP; SSO/login social estão fora do escopo |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#44-modelo-de-dados-de-autenticação)
- [`.specs/001-auth-schema.md`](../.specs/001-auth-schema.md)
- [`.specs/002-auth-session.md`](../.specs/002-auth-session.md)
- [`.plans/001-auth-breakdown.md`](../.plans/001-auth-breakdown.md)
