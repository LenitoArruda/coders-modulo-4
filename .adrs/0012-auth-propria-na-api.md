# ADR 0012 — Autenticação própria na API, sem provedor externo

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O épico de autenticação exige sign-up, confirmação de conta, sessão única por pessoa (o último
login invalida os anteriores), e-mails de nova sessão, recuperação de senha com token opaco de
uso único e revogação de sessões no reset. Também exige respostas anti-enumeração e controle do
ciclo de vida da sessão a partir da API NestJS.

Provedores de autenticação prontos impõem suas próprias tabelas, fluxos e políticas de sessão.
Atender aos requisitos acima exigiria contornar boa parte do componente, misturando o modelo do
provedor com tabelas de domínio da aplicação. O PostgreSQL continua sendo o banco escolhido para
o produto.

## Decisão

Usar **autenticação própria na API NestJS**, emitindo JWT de sessão. O PostgreSQL é usado apenas
como banco de dados, com o schema de auth criado em `db/migrations/`:

- `users` — conta, e-mail normalizado/único e hash de senha.
- `auth_tokens` — tokens opacos de uso único para confirmação de e-mail e reset de senha,
  persistidos apenas como hash.
- `sessions` — registro server-side das sessões, com expiração e revogação, usado para validar e
  invalidar JWTs.

No ambiente web, o JWT é transportado em cookie `HttpOnly`; o servidor do web encaminha o valor
como `Authorization: Bearer` para a API. O JavaScript do navegador não lê o token. As tabelas de
auth têm RLS habilitado sem policies públicas, e a API é o único cliente do banco.

O acesso ao banco é detalhado no [ADR 0016](./0016-postgres-nativo.md): `pg` com SQL
parametrizado e migrações versionadas com executor próprio.

## Consequências

### Positivas

- Controle total sobre sessão única, revogação, TTL e e-mails transacionais.
- Modelo de dados explícito e testável (constraints, RLS e testes SQL).
- Respostas anti-enumeração e mensagens de erro sob controle da API.
- Sem acoplamento ao modelo de tabelas e fluxos de um provedor de autenticação.
- O PostgreSQL entrega um banco local reproduzível, sem stack proprietária.

### Negativas / trade-offs

- A aplicação passa a ser dona da superfície de segurança: hash de senha, assinatura/validação
  de JWT, revogação, rate limiting e limpeza de tokens expirados.
- Mais código e testes próprios do que delegar a um provedor de autenticação.
- A decisão do algoritmo de hash de senha (bcrypt/argon2) e o custo ficam em aberto na fatia 002.

## Alternativas consideradas

| Alternativa                    | Por que foi descartada                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Provedor de auth gerenciado    | Sessão única, e-mails e revogação no reset exigiriam contornar o componente         |
| NextAuth/Auth.js no web        | Foca o front; a API continuaria precisando validar e revogar sessão                 |
| Provedor de identidade externo | Complexidade e custo desproporcionais ao MVP; SSO/login social estão fora do escopo |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md#44-modelo-de-dados-de-autenticação)
- [`.specs/001-auth-schema.md`](../.specs/001-auth-schema.md)
- [`.specs/002-auth-session.md`](../.specs/002-auth-session.md)
- [`.plans/001-auth-breakdown.md`](../.plans/001-auth-breakdown.md)
