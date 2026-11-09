# Plano — Auth schema

> Spec: `.specs/001-auth-schema.md`
> Status: implementing (verificação de banco pendente — Docker parado)
> Atualizado em: 2026-11-09

## 1. Contexto

O épico de autenticação decidiu usar auth própria na API NestJS, com o Supabase/Postgres apenas
como banco. A fundação já tem Supabase local, `bun run db:migrate` e a migração inicial apenas
com extensões. Ainda não existem tabelas para usuários, tokens opacos ou sessões, então nenhuma
fatia seguinte consegue persistir cadastro, confirmação, login ou recuperação.

Esta spec entrega a base de dados e as regras de integridade que as specs 002 a 008 reutilizam.

## 2. Objetivo e critérios de aceite

Entregar uma migração versionada com `users`, `auth_tokens` e `sessions`, constraints, índices,
RLS sem policies para papéis públicos e acesso restrito à credencial de servidor.

Critérios da spec e onde serão verificados:

| Critério                                                                    | Verificação                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Migração cria as três tabelas com constraints, índices e relacionamentos    | pgTAP `001-auth-schema.test.sql` + `bun run db:migrate`                       |
| E-mail duplicado com variação de caixa é rejeitado                          | pgTAP: insert duplicado com `upper(email)`                                    |
| Token persistido apenas como hash                                           | pgTAP: existe `token_hash`, não existe coluna `token`; unicidade e tamanho    |
| Token usado/expirado não é válido para nova operação                        | pgTAP: consulta de token ativo ignora `used_at` e `expires_at` no passado     |
| Sessão revogada/expirada não aparece como ativa                             | pgTAP: consulta de sessão ativa ignora `revoked_at` e `expires_at` no passado |
| `anon`/`authenticated` não acessam as tabelas; credencial de servidor opera | pgTAP: RLS habilitado, zero policies e privilégios revogados                  |

## 3. Escopo

### Dentro

- Migração versionada `supabase/migrations/20261109000000_auth_schema.sql`.
- Tabelas `users`, `auth_tokens` e `sessions` com PK UUID, FKs e `ON DELETE CASCADE`.
- Constraints de obrigatoriedade, tamanho, formato de e-mail, normalização e `purpose`/`origin`.
- Índices para e-mail case-insensitive, token hash, usuário, token ativo e sessão ativa.
- Trigger de `updated_at` em `users`.
- RLS habilitado nas três tabelas, sem policies para `anon`/`authenticated`.
- Revogação de privilégios de `anon`/`authenticated` e grant explícito para `service_role`.
- Rollback documentado em comentário na migração, na ordem inversa das dependências.
- Testes pgTAP em `supabase/tests/001-auth-schema.test.sql`.
- Script `db:test` no `package.json` da raiz.
- Documentação do modelo de dados em `.docs/ARCHITECTURE.md` e do comando `db:test` em
  `.docs/QA.md`.

### Fora

- Endpoints, casos de uso, repositórios e DTOs de auth; entram nas specs 002 a 008.
- JWT, cookie, sessão de aplicação e `GET /api/v1/auth/me`; spec 002.
- Rotas web, layouts, guard e redirecionamentos; spec 003.
- Porta de e-mail e templates; specs 002, 004 e 007.
- Alteração do algoritmo de hash de senha; decisão da spec 002.
- Supabase Auth, MFA, SSO, login social, refresh token e sign-out.
- Dados reais, seeds de produção e credenciais versionadas.

## 4. Abordagem técnica

- Usar SQL puro na migração, seguindo o padrão da migração inicial e o CLI do Supabase.
- `timestamptz` em todos os timestamps para armazenar UTC.
- `gen_random_uuid()` da extensão `pgcrypto`, já criada em `20261105000000_initial.sql`.
- E-mail: armazenar normalizado em minúsculas e sem espaços; constraint garante a forma e índice
  único em `lower(email)` garante unicidade case-insensitive.
- Token: `token_hash` único, sem coluna para o valor em claro; `purpose` restrito por check.
- Sessão: `origin` restrito por check; `expires_at > created_at`; revogação por `revoked_at`.
- RLS habilitado sem policies; revogar privilégios de `anon`/`authenticated` e conceder DML a
  `service_role` para a API.
- Testes de banco com pgTAP via `supabase test db`, em transação com `rollback`.
- O teste exige Supabase local ativo (`bun run infra:up`) e migrações aplicadas
  (`bun run db:migrate`); se o Docker não estiver disponível, registrar a lacuna no relatório.

## 5. Arquivos e áreas afetadas

- `supabase/migrations/20261109000000_auth_schema.sql` (novo)
- `supabase/tests/001-auth-schema.test.sql` (novo)
- `package.json` (script `db:test`)
- `.docs/ARCHITECTURE.md` (modelo de dados e auth própria)
- `.docs/QA.md` (comando `db:test`)
- `.adrs/0012-auth-propria-na-api.md` (decisão de auth própria)
- `.adrs/README.md` (índice de ADRs)
- `.plans/001-auth-schema-plan.md` (este arquivo)
- `.specs/001-auth-schema.md` (status)

## 6. Passos de implementação

- [x] 1. Criar a migração com `users`, trigger de `updated_at`, `auth_tokens` e `sessions`.
- [x] 2. Adicionar constraints, índices, RLS, revogações, grant para `service_role` e rollback
      comentado.
- [x] 3. Criar o teste pgTAP cobrindo tabelas, constraints, unicidade, cascata, token/sessão
      ativos, RLS e privilégios.
- [x] 4. Adicionar o script `db:test` e documentá-lo em `.docs/QA.md`.
- [x] 5. Atualizar `.docs/ARCHITECTURE.md` com o modelo de dados e a decisão de auth própria.
- [x] 6. Rodar lint, tipos, testes e build. `db:migrate`/`db:test` ficam pendentes: o Docker
      Desktop está parado e o serviço não pôde ser iniciado no ambiente.
- [x] 7. Entregar relatório e executar `commit-and-push`.

## 7. Riscos e mitigação

| Risco                                                      | Mitigação                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| RLS habilitado sem policy pode bloquear a API              | Grant explícito para `service_role`, que tem `bypassrls`; testar privilégios                     |
| Unicidade case-insensitive divergir da normalização da API | Constraint `email = lower(email)` + índice único em `lower(email)`                               |
| Migração falhar em banco com dados                         | Ambiente local descartável; migração só cria objetos novos                                       |
| Docker indisponível no ambiente                            | Testes pgTAP documentados; registrar a lacuna e não declarar verificação de banco como executada |
| `auth_tokens` crescer sem limite                           | Índices por usuário/purpose; limpeza fica para uma entrega futura                                |

## 8. Plano de testes

- **pgTAP (`bun run db:test`):**
  - tabelas e colunas essenciais existem;
  - índice único de e-mail e rejeição de duplicata com variação de caixa;
  - e-mail em maiúsculas e com espaços rejeitado por check;
  - `purpose` e `origin` inválidos rejeitados;
  - `token_hash` único, obrigatório e sem coluna de token em claro;
  - token usado/expirado fora da consulta de token ativo;
  - sessão revogada/expirada fora da consulta de sessão ativa;
  - cascata ao excluir usuário;
  - `updated_at` alterado no update;
  - RLS habilitado, zero policies e privilégios de `anon`/`authenticated` revogados.
- **Migração manual:** banco limpo → `bun run db:migrate`; reaplicar e confirmar que não recria
  nem perde dados.

## 9. QA manual

1. Ação: `bun run infra:up`.
   Esperado: Supabase local e LGTM sobem; Studio responde em `http://127.0.0.1:54323`.
   Resultado: bloqueado — Docker Desktop parado (`com.docker.service` Stopped) e sem permissão
   para iniciar o serviço no ambiente.
2. Ação: `bun run db:migrate`.
   Esperado: migração aplicada com sucesso.
   Resultado: bloqueado — `ECONNREFUSED 127.0.0.1:54322` (Supabase local não está ativo).
3. Ação: `bun run db:test`.
   Esperado: todos os testes pgTAP passam.
   Resultado: bloqueado — mesma causa do item 2.
4. Ação: abrir o Studio e inspecionar `users`, `auth_tokens` e `sessions`.
   Esperado: tabelas, constraints, índices e RLS visíveis.
   Resultado: bloqueado — depende de `infra:up`.

## 10. Rollout e rollback

- Não há usuários existentes; a migração cria o schema do zero.
- Aplicar no ambiente local com `bun run db:migrate`.
- Rollback local documentado na migração:
  `drop table public.sessions; drop table public.auth_tokens; drop table public.users; drop function public.set_updated_at();`
- Não há feature flag. Dados locais são descartáveis.
