# Auth schema — Spec

> **Status:** implementing
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Plano:** `.plans/001-auth-schema-plan.md`

## 1. Contexto e problema

Esta é a primeira fatia do épico de autenticação. O banco local já existe, mas não há tabelas de usuários, tokens ou sessões. Sem esse schema, nenhuma das fatias seguintes consegue persistir cadastro, confirmação, login ou recuperação de senha.

A decisão do épico é usar **auth própria na API NestJS**, com o Supabase/Postgres apenas como banco. Não há Supabase Auth, nem tabelas gerenciadas pelo Supabase Auth. Esta fatia entrega a base de dados e as regras de integridade que todas as outras fatias reutilizam.

## 2. Usuários e jobs

| Usuário                 | Job                                                                        | Frequência           |
| ----------------------- | -------------------------------------------------------------------------- | -------------------- |
| Desenvolvedor(a)        | Aplicar a migração, resetar o banco local e validar constraints            | A cada ambiente novo |
| Pessoa que se cadastra  | Ter seus dados persistidos com segurança, sem perceber a estrutura interna | Indireta             |
| Engenharia de segurança | Auditar que senhas e tokens não são persistidos em claro                   | Eventual             |

Permissões: esta fatia não expõe rota pública nem endpoint. As tabelas são acessíveis apenas pela API com credencial de servidor; o navegador não acessa o banco diretamente.

## 3. Resultado esperado

Uma migração versionada cria as tabelas `users`, `auth_tokens` e `sessions`, com constraints, índices, timestamps e relacionamentos. O banco local pode ser migrado e resetado de forma reproduzível. E-mails são únicos de forma case-insensitive, senhas são persistidas apenas como hash, tokens são persistidos apenas como hash e sessões têm expiração e revogação explícitas.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de migração.

## 5. Escopo

### Dentro

- Migração versionada com as tabelas `users`, `auth_tokens` e `sessions`.
- Campos de nome, sobrenome, e-mail normalizado, hash de senha, confirmação de e-mail e timestamps em `users`.
- Tokens opacos com `purpose` (`email_confirmation` e `password_reset`), hash, expiração e uso único em `auth_tokens`.
- Sessões com identificador, usuário, criação, expiração, revogação e origem (`sign_up_confirmation` ou `sign_in`).
- Constraints de unicidade, obrigatoriedade, tamanho e relacionamento com `ON DELETE CASCADE`.
- Índices para busca por e-mail, token hash, usuário e sessão ativa.
- RLS habilitado nas tabelas de auth, sem policies para `anon` ou `authenticated`; a API acessa com credencial de servidor.
- Documentação do modelo de dados em `.docs/ARCHITECTURE.md` e atualização do `.env.example` se a conexão exigir variável nova.
- Testes de migração, constraints e rollback.

### Fora

- Endpoints de sign-up, confirmação, sign-in, forgot-password e reset-password; eles entram nas fatias 004 a 008.
- JWT, cookie, sessão de aplicação e `GET /api/v1/auth/me`; isso entra na fatia 002.
- Rotas web, layouts, guard e redirecionamentos; isso entra na fatia 003.
- Porta de e-mail, templates e envio de mensagens; a porta entra na fatia 002 e os templates nas fatias 004 e 007.
- Supabase Auth, MFA, SSO, login social, refresh token e sign-out.
- Dados reais, seeds de produção e credenciais versionadas.

## 6. Fluxos

### Fluxo principal — preparar o banco

1. A pessoa desenvolvedora sobe o Supabase local com `bun run infra:up`.
2. Aplica as migrações com `bun run db:migrate`.
3. A migração cria as tabelas, constraints, índices e relacionamentos.
4. A API consegue persistir usuários, tokens e sessões nas fatias seguintes.

### Fluxos alternativos e de exceção

- Banco já migrado: aplicar novamente não recria tabelas nem perde dados.
- Rollback: a migração de descida remove as tabelas na ordem inversa das dependências.
- Violação de unicidade de e-mail: o banco rejeita a segunda linha com o mesmo e-mail normalizado.
- Token expirado ou usado: a linha permanece para auditoria, mas não é considerada válida pelas consultas.
- Sessão revogada: a linha permanece com `revoked_at` preenchido e não é considerada ativa.
- Exclusão de usuário: tokens e sessões relacionados são removidos em cascata.

## 7. Regras e casos de borda

- `users.email` é obrigatório, normalizado para minúsculas, sem espaços nas extremidades, com limite de 254 caracteres e único de forma case-insensitive.
- `users.first_name` e `users.last_name` são obrigatórios, com limite de 100 caracteres cada.
- `users.password_hash` é obrigatório e armazena apenas hash forte; nunca a senha em claro.
- `users.email_confirmed_at` é nulo enquanto a conta não for confirmada e recebe timestamp UTC quando a confirmação acontece.
- `auth_tokens.purpose` aceita apenas `email_confirmation` e `password_reset`.
- `auth_tokens.token_hash` é único e armazena apenas o hash do token opaco; o valor em claro nunca é persistido.
- `auth_tokens.expires_at` é obrigatório; confirmação usa 24 horas e reset usa 1 hora por padrão.
- `auth_tokens.used_at` marca o consumo; token com `used_at` preenchido não pode ser reutilizado.
- `sessions.origin` aceita apenas `sign_up_confirmation` e `sign_in`.
- `sessions.expires_at` é obrigatório; o padrão proposto é 7 dias, configurável.
- `sessions.revoked_at` marca revogação explícita; sessão revogada não é ativa.
- Uma sessão é considerada ativa quando `revoked_at` é nulo e `expires_at` está no futuro.
- Timestamps são armazenados em UTC.
- Nenhuma tabela de auth é exposta ao navegador; o acesso passa pela API.
- Nenhum dado sensível aparece em logs, seeds ou arquivos versionados.

## 8. Dados e contratos

### `users`

| Campo                | Regra                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `id`                 | Identificador único, gerado pelo banco                               |
| `first_name`         | Obrigatório, até 100 caracteres                                      |
| `last_name`          | Obrigatório, até 100 caracteres                                      |
| `email`              | Obrigatório, normalizado, único case-insensitive, até 254 caracteres |
| `password_hash`      | Obrigatório, apenas hash                                             |
| `email_confirmed_at` | Nulo até a confirmação; timestamp UTC depois                         |
| `created_at`         | Timestamp UTC de criação                                             |
| `updated_at`         | Timestamp UTC da última alteração                                    |

### `auth_tokens`

| Campo        | Regra                                                  |
| ------------ | ------------------------------------------------------ |
| `id`         | Identificador único, gerado pelo banco                 |
| `user_id`    | Referência a `users`, obrigatória, `ON DELETE CASCADE` |
| `purpose`    | `email_confirmation` ou `password_reset`               |
| `token_hash` | Único, obrigatório, apenas hash                        |
| `expires_at` | Obrigatório, timestamp UTC                             |
| `used_at`    | Nulo até o consumo; uso único                          |
| `created_at` | Timestamp UTC de criação                               |

### `sessions`

| Campo        | Regra                                                  |
| ------------ | ------------------------------------------------------ |
| `id`         | Identificador único, gerado pelo banco                 |
| `user_id`    | Referência a `users`, obrigatória, `ON DELETE CASCADE` |
| `origin`     | `sign_up_confirmation` ou `sign_in`                    |
| `created_at` | Timestamp UTC de criação                               |
| `expires_at` | Obrigatório, timestamp UTC                             |
| `revoked_at` | Nulo até a revogação                                   |

### Migração e acesso

- A migração é versionada em `supabase/migrations/` e aplicada por `bun run db:migrate`.
- A migração tem descida segura para o ambiente local.
- As tabelas têm RLS habilitado e nenhuma policy para `anon` ou `authenticated`.
- A API acessa o banco com credencial de servidor, nunca com a chave anônima.

## 9. Permissões e segurança

- O navegador não acessa as tabelas de auth diretamente.
- A chave anônima do Supabase não tem permissão de leitura ou escrita nas tabelas de auth.
- Senhas e tokens são persistidos apenas como hash forte.
- Tokens não aparecem em logs, seeds, fixtures versionadas ou mensagens de erro.
- A exclusão de usuário remove tokens e sessões em cascata, evitando registros órfãos.
- Não há dados reais nem credenciais de produção na migração.

## 10. Requisitos não funcionais

- A migração aplica em até 5 s no ambiente local.
- A migração é idempotente e pode ser reaplicada sem perda de dados.
- As constraints e índices não impedem o uso normal das fatias seguintes.
- O schema é compatível com o Postgres do Supabase local e com a versão usada em produção.
- A documentação do modelo de dados fica em `.docs/ARCHITECTURE.md`.

## 11. Dependências e riscos

| Dependência ou risco                 | Impacto                                | Mitigação                                                 | Dono       |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------- | ---------- |
| Supabase local e CLI                 | Sem banco, a migração não roda         | `bun run infra:up` e `bun run db:migrate` documentados    | Engenharia |
| Migração aplicada em banco com dados | Pode falhar ou perder dados            | Migração nova, sem alteração destrutiva; rollback testado | Engenharia |
| Unicidade case-insensitive           | E-mails com maiúsculas podem duplicar  | Normalização na API e constraint no banco                 | Engenharia |
| RLS mal configurado                  | Exposição de dados de auth             | RLS habilitado e teste de acesso anônimo negado           | Segurança  |
| Tokens persistidos em claro          | Comprometimento de confirmação e reset | Persistir apenas hash e testar                            | Segurança  |
| Sessões sem revogação                | Sessão antiga continua válida          | `revoked_at` e consulta de sessão ativa                   | Engenharia |

## 12. Rollout e migração

- Não há usuários existentes; a migração cria o schema do zero.
- A migração é aplicada no ambiente local e versionada no repositório.
- Não há feature flag nesta entrega.
- Rollback: reverter a migração e o commit; nenhum dado real é perdido no ambiente local.
- Comunicação: atualizar `.docs/ARCHITECTURE.md` na mesma mudança.

## 13. Estratégia de teste

- **Migração:** aplicar em banco limpo, reaplicar e executar rollback.
- **Constraints:** e-mail duplicado com variação de caixa, campos obrigatórios, limites de tamanho e `purpose` inválido.
- **Cascata:** excluir usuário e confirmar remoção de tokens e sessões.
- **Tokens:** persistir token e confirmar que apenas o hash está armazenado; marcar `used_at` e impedir reutilização.
- **Sessões:** criar sessão ativa, expirar, revogar e confirmar que apenas a ativa é retornada.
- **Acesso:** tentar ler as tabelas com a chave anônima e confirmar negação.
- **Manual:** inspecionar o schema no Supabase Studio e conferir índices e relacionamentos.

## 14. Critérios de aceite

- [ ] Dado um banco local limpo, quando `bun run db:migrate` é executado, então `users`, `auth_tokens` e `sessions` existem com constraints, índices e relacionamentos.
- [ ] Dado um e-mail já cadastrado, quando outra conta tenta usar o mesmo e-mail com variação de maiúsculas/minúsculas, então o banco rejeita a duplicata.
- [ ] Dado um token de confirmação ou reset, quando ele é persistido, então apenas o hash é armazenado e o valor em claro não aparece no banco.
- [ ] Dado um token usado ou expirado, quando a API tenta validá-lo, então ele não é considerado válido para uma nova operação.
- [ ] Dada uma sessão revogada ou expirada, quando a API consulta sessões ativas, então ela é excluída do resultado.
- [ ] Dado o navegador ou a chave anônima, quando tenta acessar as tabelas de auth diretamente, então o acesso é negado e somente a API com credencial de servidor consegue operar.

## 15. Decisões e questões abertas

| Tema                          | Decisão ou pergunta                                                                     | Impacto                                              | Dono       | Status                  |
| ----------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ----------------------- |
| Motor de auth                 | Auth própria na API NestJS; Supabase/Postgres apenas como banco                         | Define o schema e evita dependência do Supabase Auth | Engenharia | fechada (2026-11-09)    |
| Acesso ao banco               | RLS habilitado sem policies para `anon`/`authenticated`; API usa credencial de servidor | Protege as tabelas de auth                           | Segurança  | fechada (2026-11-09)    |
| E-mail único                  | Normalizado e único case-insensitive                                                    | Evita duplicatas                                     | Engenharia | fechada (2026-11-09)    |
| TTL dos tokens                | Confirmação 24 h; reset 1 h; uso único                                                  | Define expiração e validação                         | Engenharia | fechada (default)       |
| TTL da sessão                 | 7 dias, configurável                                                                    | Define expiração e frequência de novo login          | Engenharia | aberta (não bloqueante) |
| Estratégia de banco de testes | Postgres descartável via Supabase local ou repositório fake                             | Afeta testes de migração e integração                | Engenharia | aberta (não bloqueante) |
