# Plano — Auth sign-up

> Spec: `.specs/004-auth-sign-up.md`
> Status: done
> Criado em: 2026-11-09
> Concluído em: 2026-11-10

## 1. Contexto

As fatias 001–003 entregam schema (`users`, `auth_tokens`, `sessions`), infraestrutura de
sessão (JWT + registro server-side + e-mail via SMTP) e as rotas públicas/privadas do web.
`/auth/sign-up` ainda é um placeholder e não existe endpoint de criação de conta, token de
confirmação nem template de e-mail de confirmação. Esta fatia fecha o primeiro fluxo
observável do épico: criar conta, persistir como não confirmada e enviar o link
`/auth/confirm?token=...`, sem criar sessão.

## 2. Objetivo e critérios de aceite

Objetivo: entregar `POST /api/v1/auth/sign-up` e a página pública `/auth/sign-up` com
validação acessível, persistência, token opaco de confirmação, e-mail en-US, reenvio para
e-mail não confirmado, `409` para confirmado e rate limiting básico.

Critérios da spec e onde são verificados:

| Critério (spec §14)                                                        | Evidência planejada                                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Conta não confirmada + e-mail en-US com link `/auth/confirm?token=...`     | `sign-up.use-case.spec.ts`, `confirmation-email.spec.ts`, `sign-up.integration.spec.ts`, E2E          |
| Campos inválidos → sem conta, erros junto aos campos, UI acessível         | `sign-up-input.spec.ts`, `sign-up.integration.spec.ts`, E2E + revisão de `aria-describedby`           |
| Confirmado → `409`; não confirmado → `200` com reenvio sem duplicata       | `sign-up.use-case.spec.ts`, `sign-up.integration.spec.ts`                                             |
| Token de uso único, validado por hash, expira em 24 h, não aparece em logs | `opaque-token.adapter.spec.ts`, `sign-up.use-case.spec.ts`, integração (hash no repositório e e-mail) |
| Sign-up não cria sessão/JWT/cookie e `/app` continua protegido             | integração (sem `set-cookie`/token no corpo) + E2E de rotas existente                                 |
| Excesso de tentativas → `429` sem detalhes internos                        | `sign-up-rate-limiter.spec.ts`, `sign-up.integration.spec.ts`, E2E                                    |
| en-US, light-only, acessível, responsiva, sem senha/token em logs          | E2E (360/768/1280, foco, teclado), revisão de logs, QA manual com Mailpit                             |

## 3. Escopo

### Dentro

- Endpoint público `POST /api/v1/auth/sign-up` com validação de entrada e contrato de erro.
- Caso de uso de sign-up com criação de conta não confirmada e reenvio de confirmação.
- Portas/adaptadores: usuários (busca por e-mail + criação), tokens de auth (criação +
  invalidação), hash de senha e token opaco; template de e-mail de confirmação.
- Rate limiting em memória configurável por IP no endpoint.
- Página `/auth/sign-up` real (Server Component + Server Action + formulário client),
  mantendo o guard de sessão da fatia 003.
- Testes unitários, de integração e E2E; atualização de docs (ARCHITECTURE, QA, ADR,
  `.env.example`) e do planejamento.

### Fora

- Confirmação do token, criação de sessão, JWT/cookie e `/app` autenticado (fatia 005).
- Sign-in, sign-out, refresh, MFA, SSO, login social e “remember me” (fatias 006+).
- Recuperação/reset de senha (fatias 007/008).
- Tela dedicada de reenvio, edição de perfil, multi-tenancy, i18n com troca de idioma.
- Provedor de e-mail de produção e garantias de deliverability.
- Nova migração de schema.

## 4. Abordagem técnica

### API

- `domain/`
  - `sign-up-input.ts`: validação pura dos cinco campos, normalização de e-mail e política de
    senha (8–128, sem composição), com mensagens en-US por campo.
  - `sign-up.errors.ts`: `EmailAlreadyConfirmedError` e `ConfirmationEmailDeliveryError`.
- `application/`
  - `sign-up.use-case.ts`: busca por e-mail; se confirmado → erro de conflito; se não
    confirmado → invalida tokens pendentes, gera novo token e reenvia; se inexistente → hash
    da senha, cria usuário, gera token e envia e-mail. Não cria sessão.
  - `confirmation-email.ts`: template en-US, assunto “Confirm your account”, link
    `${WEB_ORIGIN}/auth/confirm?token=...`, aviso de expiração e de cadastro não reconhecido.
  - Portas: `UsersRepositoryPort` (busca por e-mail/criação), `AuthTokensRepositoryPort`,
    `PasswordHasherPort` (hash/verify) e `OpaqueTokenPort` (geração/hash).
- `infrastructure/`
  - `scrypt-password-hasher.adapter.ts`: `node:crypto.scrypt` (N=2^15, r=8, p=1, salt 16 B,
    chave 32 B) em formato PHC-like; sem dependência nativa nova.
  - `crypto-opaque-token.adapter.ts`: 32 bytes aleatórios em base64url; hash SHA-256 em hex.
  - `supabase-users.repository.ts`: `findByEmail` (case-insensitive) e `create` com
    `email_confirmed_at` nulo.
  - `supabase-auth-tokens.repository.ts`: criação do token e invalidação (`used_at`) dos
    pendentes do mesmo usuário/purpose.
- `interface/`
  - `auth.controller.ts`: `POST sign-up` público; `GET me` continua com `SessionGuard` no
    método. Mapeia erros de domínio para `400/409/429/503` no contrato existente.
  - `sign-up-rate-limiter.ts`: janela deslizante em memória por IP, limites via env.
  - `error-contract.ts`: `fieldErrors` passa a `Record<string, string>` (uma mensagem por
    campo), conforme o exemplo da spec 004; teste existente atualizado.

### Configuração

- `CONFIRMATION_TOKEN_TTL_SECONDS` (padrão 86400), `SIGN_UP_RATE_LIMIT_MAX` (padrão 5) e
  `SIGN_UP_RATE_LIMIT_WINDOW_SECONDS` (padrão 60), validados em `loadEnv`.
- Novos tokens de DI em `auth.tokens.ts`; `WEB_ORIGIN` injetado para montar o link.

### Web

- `app/auth/sign-up/page.tsx`: mantém `redirectSignedInUserToApp()` e renderiza o formulário
  real no `AuthCard`.
- `app/auth/sign-up/actions.ts`: Server Action (`"use server"`) que monta o JSON e chama
  `fetchApiWithSession` no servidor; API_BASE_URL nunca vai ao browser.
- `app/auth/sign-up/sign-up-form.tsx`: client component com `useActionState`, labels visíveis,
  erros por campo com `aria-describedby`, resumo com `role="alert"`, loading/disabled,
  estado de sucesso e link para sign-in. `noValidate` para que a validação da API seja a
  fonte de verdade sem mensagens nativas divergentes.
- `lib/auth/sign-up.ts`: contrato do endpoint, parsing tipado da resposta e mensagens de erro
  por status; testado em Vitest (`lib/auth/sign-up.spec.ts`).
- E2E: a API fake do Playwright ganha `POST /api/v1/auth/sign-up` determinístico para validar
  o fluxo de UI sem tocar no banco compartilhado. A inspeção do e-mail no Mailpit local e o
  hash do token ficam cobertos por integração (fake de e-mail) e QA manual, seguindo o padrão
  já documentado em `QA.md` (E2E não depende do banco/credenciais compartilhados).

## 5. Arquivos e áreas afetadas

Criados (API): `domain/sign-up-input.ts`, `domain/sign-up.errors.ts`,
`application/sign-up.use-case.ts`, `application/confirmation-email.ts`,
`application/ports/auth-tokens-repository.port.ts`,
`application/ports/password-hasher.port.ts`, `application/ports/opaque-token.port.ts`,
`infrastructure/scrypt-password-hasher.adapter.ts`,
`infrastructure/crypto-opaque-token.adapter.ts`,
`infrastructure/supabase-auth-tokens.repository.ts`, `interface/sign-up-rate-limiter.ts`,
specs correspondentes, `test/fakes/in-memory-auth-tokens.repository.ts`,
`test/fakes/fake-password-hasher.ts`, `test/fakes/fake-opaque-token.ts`,
`interface/sign-up.integration.spec.ts`.

Criados (web): `app/auth/sign-up/actions.ts`, `app/auth/sign-up/sign-up-form.tsx`,
`lib/auth/sign-up.ts`, `lib/auth/sign-up.spec.ts`, `e2e/sign-up.spec.ts`.

Criados (docs): `.adrs/0014-hash-de-senha-com-scrypt.md`.

Alterados: `auth.module.ts`, `auth.tokens.ts`, `auth.controller.ts`, `users-repository.port.ts`,
`supabase-users.repository.ts`, `shared/config/env.ts`, `shared/interface/error-contract.ts`
(+ spec), `test/fakes/in-memory-users.repository.ts`, `test/setup-env.ts`,
`app/auth/sign-up/page.tsx`, `e2e/support/fake-api-server.ts`, `.env.example`,
`.docs/ARCHITECTURE.md`, `.docs/QA.md`, `.adrs/README.md`, a spec 004 (status).

## 6. Passos de implementação

- [x] 1. Configuração: envs novas, tokens de DI e `.env.example`.
- [x] 2. Domínio: validação do sign-up e erros tipados, com testes.
- [x] 3. Portas + adaptadores: hasher scrypt, token opaco, repositórios Supabase, com testes.
- [x] 4. Template de e-mail de confirmação, com teste.
- [x] 5. Caso de uso de sign-up (criar/reenviar), com testes.
- [x] 6. Controller público + rate limiter + mapeamento de erros, com testes de integração.
- [x] 7. Web: contrato/parsing, Server Action, formulário e página, com testes de lib.
- [x] 8. E2E: API fake de sign-up e cenários de formulário/acessibilidade.
- [x] 9. Docs: ARCHITECTURE, QA, ADR 0014, índice de ADRs.
- [x] 10. QA completo, QA manual do fluxo e Mailpit, commit local na branch `spec/004`.

## 7. Riscos e mitigação

| Risco                                          | Mitigação                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hash de senha lento e impacto no p95 de 1 s    | scrypt N=2^15 (≈50–100 ms) medido no QA; e-mail local rápido; sem dependência nativa          |
| Reenvio duplicar conta ou reutilizar token     | Caminho de reenvio não cria usuário; invalida pendentes antes de inserir o novo token         |
| Falha de e-mail deixar estado inconsistente    | Conta não confirmada é reutilizável; retry do sign-up invalida o token pendente e reenvia     |
| Rate limit em memória não ser distribuído      | “Básico” e local nesta fatia; limites configuráveis e follow-up para store compartilhado      |
| E2E sem banco não inspecionar Mailpit          | Cobertura de link/token/hash na integração + QA manual no Mailpit local                       |
| Divergência de `fieldErrors` (array vs string) | Alinhar ao exemplo da spec 004 (`string`) e atualizar o teste do contrato                     |
| Exposição de token/PII em logs                 | Logs só com `userId`/`outcome`; nenhum payload, e-mail ou token; repositórios logam só código |

## 8. Plano de testes

- **Unitário API:** validação de campos (trim, limites, e-mail normalizado, política de senha,
  confirmação); hasher (hash != senha, verify, salts distintos); token opaco (entropia,
  hash determinístico); template (assunto, link, expiração, escape); caso de uso (criar,
  reenviar, confirmado, falha de e-mail); rate limiter (limite, janela, chave).
- **Integração API:** `POST /api/v1/auth/sign-up` 201/200/400/409/429/503; sem cookie/JWT no
  sucesso; hash persistido em vez de senha; token em hash e expiração; e-mail com link;
  invalidação do token anterior; ausência de campos sensíveis na resposta.
- **Web (Vitest):** parsing do contrato de sucesso/erro por status e mensagens en-US.
- **E2E:** erros por campo acessíveis; sucesso; `409`; `429`; responsividade 360/768/1280;
  teclado/foco e light-only.
- **Manual:** sign-up real contra API + Supabase local, inspeção do Mailpit em
  `http://127.0.0.1:54324`, conferência de que não há cookie de sessão e que `/app` segue
  protegido.

## 9. QA manual

1. `bun run db:migrate` (sem reset) e `bun run dev`.
2. Abrir `/auth/sign-up`, enviar formulário vazio → erros por campo com foco no resumo.
3. Preencher dados válidos com e-mail único → mensagem de sucesso e nenhum cookie
   `session_token`.
4. Abrir o Mailpit local → e-mail “Confirm your account” com link `/auth/confirm?token=...`.
5. Repetir o sign-up com o mesmo e-mail → `200` com a mesma mensagem e sem duplicata.
6. Repetir com e-mail confirmado manualmente no banco → `409`.
7. Disparar mais de 5 tentativas em 60 s → `429` com mensagem genérica.
8. Verificar teclado, foco visível, 360/768/1280 px, light-only e textos en-US.

## 10. Rollout e rollback

- Sem migração e sem feature flag; substitui o placeholder de `/auth/sign-up`.
- Rollback: reverter o commit da spec. Contas criadas no ambiente local são descartáveis.
- Comunicação: documentação e testes na mesma mudança; follow-ups para rate limit
  distribuído e provedor de e-mail de produção.
