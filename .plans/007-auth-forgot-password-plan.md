# Plano — Auth forgot password

> Spec: `.specs/007-auth-forgot-password.md`
> Status: done
> Criado em: 2026-11-10
> Concluído em: 2026-11-10

## 1. Contexto

As fatias 001–004 entregaram schema (`users`, `auth_tokens`, `sessions`), infraestrutura de
sessão (JWT + e-mail SMTP), as rotas públicas/privadas do web e o sign-up com e-mail de
confirmação. `/auth/forgot-password` ainda é um placeholder que não envia e-mail e não existe
token de reset. Sem esta fatia, quem esquece a senha não tem saída.

Esta fatia entrega somente a **solicitação** de recuperação: resposta genérica
anti-enumeração, token opaco de uso único com hash em repouso e TTL de 1 hora, e-mail en-US com
link `/auth/reset-password?token=...`. A validação do token e a troca de senha ficam na fatia 008.

## 2. Objetivo e critérios de aceite

Objetivo: entregar `POST /api/v1/auth/forgot-password` e a página pública
`/auth/forgot-password` com formulário acessível, rate limiting básico, emissão/invalidação de
tokens de reset e e-mail de recuperação, sem revelar se o e-mail existe.

Critérios da spec e onde são verificados:

| Critério (spec §14)                                                                                 | Evidência planejada                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E-mail válido → `200` com a mesma mensagem, exista ou não a conta                                   | `request-password-reset.use-case.spec.ts`, `forgot-password.integration.spec.ts`, E2E      |
| Conta existente → e-mail en-US com link, token de uso único, TTL 1 h, invalida anterior             | `reset-password-email.spec.ts`, integração (hash/expiração/invalidação), QA manual Mailpit |
| E-mail inexistente → `200` genérico e nenhum e-mail                                                 | `request-password-reset.use-case.spec.ts`, integração                                      |
| Conta não confirmada → `200` genérico e e-mail enviado                                              | caso de uso + integração                                                                   |
| E-mail inválido → `400` com erro de campo, sem token nem e-mail                                     | `forgot-password-input.spec.ts`, integração, E2E                                           |
| Falha no envio → resposta genérica, falha registrada sem PII, nova tentativa possível               | caso de uso (email fake com falha) + integração                                            |
| Rate limiting, e-mail de nova sessão com link, UI en-US/light-only/acessível, sem token/PII em logs | rate limiter spec, `create-session.use-case.spec.ts`, E2E, QA manual e revisão de logs     |

## 3. Escopo

### Dentro

- Endpoint público `POST /api/v1/auth/forgot-password` com resposta genérica e contrato de erro.
- Validação pura de e-mail, caso de uso de solicitação de reset e template de e-mail en-US.
- Token opaco de reset com hash em repouso, TTL configurável (padrão 1 h), uso único e
  invalidação do token pendente anterior.
- Rate limiting em memória configurável por IP e por e-mail normalizado.
- Página `/auth/forgot-password` real (Server Component + Server Action + formulário client),
  pública e acessível com sessão ativa.
- Atualização do template de e-mail de nova sessão para incluir o link de recuperação.
- Testes unitários, de integração e E2E; atualização de docs (ARCHITECTURE, QA,
  `.env.example`) e do planejamento.

### Fora

- Página `/auth/reset-password`, validação do token, troca de senha, revogação de sessões e
  e-mail de sucesso (fatia 008).
- Sign-in/sign-out, refresh token, MFA, SSO, login social, passkeys e “remember me”.
- Troca de senha autenticada, reenvio dedicado de confirmação e histórico de senhas.
- Provedor de e-mail de produção, notificações por outros canais e multi-tenancy.
- Nova tabela ou migração de schema.

## 4. Abordagem técnica

### API

- `domain/`
  - `forgot-password-input.ts`: validação pura do e-mail (ausente, formato, limite de 254) com
    normalização e mensagens en-US por campo.
- `application/`
  - `request-password-reset.use-case.ts`: busca por e-mail normalizado; conta inexistente apenas
    registra o resultado sem PII; conta existente gera token, persiste o hash, invalida os
    tokens pendentes anteriores e envia o e-mail. Falha de e-mail é registrada e engolida para
    manter a resposta genérica.
  - `reset-password-email.ts`: template en-US, assunto “Reset your password”, link
    `${WEB_ORIGIN}/auth/reset-password?token=...`, expiração de 1 h e orientação para ignorar.
  - `new-session-email.ts`: passa a receber a URL de recuperação e a incluí-la no texto/HTML.
  - `ports/auth-tokens-repository.port.ts`: nova operação `invalidateUnusedExcept`, usada no
    padrão create-then-revoke para não deixar dois tokens válidos sob concorrência.
- `infrastructure/`
  - `supabase-auth-tokens.repository.ts`: implementa a invalidação de todos os tokens pendentes
    exceto o hash recém-criado (`neq token_hash`).
- `interface/`
  - `auth.controller.ts`: `POST forgot-password` público, valida, aplica rate limit por IP e por
    e-mail e sempre responde `{ message }` genérico no sucesso.
  - `forgot-password-rate-limiter.ts`: janela deslizante em memória por chave (IP/e-mail),
    limites via env e `Retry-After`.
- `create-session.use-case.ts` recebe `WEB_ORIGIN` para montar o link de recuperação do e-mail de
  nova sessão.

### Configuração

- `RESET_TOKEN_TTL_SECONDS` (padrão 3600), `FORGOT_PASSWORD_RATE_LIMIT_MAX` (padrão 5) e
  `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS` (padrão 60), validados em `loadEnv`.
- Novos tokens de DI em `auth.tokens.ts`; providers no `auth.module.ts`.

### Web

- `app/auth/forgot-password/page.tsx`: substitui o placeholder, mantém a rota pública e o
  heading “Forgot your password?”; sem guard, para funcionar com sessão ativa.
- `app/auth/forgot-password/actions.ts`: Server Action (`"use server"`) que chama a API pelo
  servidor; `API_BASE_URL` e cookie nunca vão ao browser.
- `app/auth/forgot-password/forgot-password-form.tsx`: client component com `useActionState`,
  label visível, erro por campo com `aria-describedby`, resumo `role="alert"` com foco,
  loading/disabled e estado de sucesso `role="status"` que substitui o formulário.
- `lib/auth/forgot-password.ts`: contrato do endpoint, parsing tipado e mensagens en-US por
  status; testado em Vitest.
- E2E: a API fake do Playwright ganha `POST /api/v1/auth/forgot-password` determinístico para
  validar a UI sem tocar no banco compartilhado. A inspeção do Mailpit e o hash do token ficam
  cobertos por integração e QA manual.

## 5. Arquivos e áreas afetadas

Criados (API): `domain/forgot-password-input.ts` (+ spec),
`application/request-password-reset.use-case.ts` (+ spec),
`application/reset-password-email.ts` (+ spec),
`interface/forgot-password-rate-limiter.ts` (+ spec),
`interface/forgot-password.integration.spec.ts`.

Criados (web): `app/auth/forgot-password/actions.ts`,
`app/auth/forgot-password/forgot-password-form.tsx`, `lib/auth/forgot-password.ts` (+ spec),
`e2e/forgot-password.spec.ts`.

Criados (docs): este plano.

Alterados (API): `auth.module.ts`, `auth.tokens.ts`, `auth.controller.ts`,
`application/create-session.use-case.ts` (+ spec), `application/new-session-email.ts`,
`application/ports/auth-tokens-repository.port.ts`,
`infrastructure/supabase-auth-tokens.repository.ts` (+ spec),
`test/fakes/in-memory-auth-tokens.repository.ts`, `modules/shared/config/env.ts`.

Alterados (web): `app/auth/forgot-password/page.tsx`, `e2e/support/fake-api-server.ts`.

Alterados (docs): `.env.example`, `.docs/ARCHITECTURE.md`, `.docs/QA.md`, a spec 007 (status).

## 6. Passos de implementação

- [x] 1. Configuração: envs novas, tokens de DI, providers e `.env.example`.
- [x] 2. Domínio: validação do e-mail de recuperação, com testes.
- [x] 3. Porta/adaptador: `invalidateUnusedExcept` no repositório Supabase e no fake, com testes.
- [x] 4. Template de e-mail de recuperação, com teste.
- [x] 5. Caso de uso de solicitação de reset, com testes (existente, inexistente, não confirmada,
      falha de e-mail e concorrência).
- [x] 6. Rate limiter e controller público, com testes de integração.
- [x] 7. E-mail de nova sessão com link de recuperação, com testes atualizados.
- [x] 8. Web: contrato/parsing, Server Action, formulário e página, com testes de lib.
- [x] 9. E2E: API fake e cenários de formulário/acessibilidade.
- [x] 10. Docs (ARCHITECTURE, QA, `.env.example`), QA completo e QA manual com Mailpit.
- [x] 11. Commit local na branch `spec/007` (sem push/merge).

## 7. Riscos e mitigação

| Risco                                                  | Mitigação                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Enumeração de contas por status/corpo/tempo            | Mesmo `200` e mesma mensagem para e-mail válido; token/e-mail só internos                   |
| Vazamento de token em logs/URLs                        | Token só no link do e-mail; logs apenas com `userId`/`outcome`/nome do erro redigido        |
| Dois tokens válidos sob concorrência                   | create-then-revoke com `invalidateUnusedExcept`; pior caso deixa ambos usados (novo pedido) |
| Falha de SMTP quebrar a resposta                       | Erro engolido após log sem PII; retry invalida o token anterior                             |
| Rate limit em memória não distribuído                  | “Básico” e local nesta fatia; limites configuráveis e follow-up para store compartilhado    |
| E2E sem banco não inspecionar Mailpit                  | Link/token/hash cobertos por integração + QA manual no Mailpit local                        |
| Alteração do template de nova sessão conflitar com 002 | Mudança mínima (URL como parâmetro) e testes do caso de uso atualizados na mesma entrega    |
| Divergência de mensagens entre API e web               | Constante única no contrato do web; teste de parsing por status                             |

## 8. Plano de testes

- **Unitário API:** validação de e-mail (vazio, inválido, limite, normalização); template
  (assunto, link, expiração, escape HTML, texto de ignorar); caso de uso (conta confirmada,
  não confirmada, inexistente, hash/expiração, invalidação anterior, falha de e-mail,
  concorrência); rate limiter (limite, janela, isolamento por chave, reset).
- **Integração API:** `POST /api/v1/auth/forgot-password` `200` para existente/inexistente/não
  confirmada, `400` inválido, `429`; e-mail com link; hash persistido e token claro ausente do
  banco; invalidação do token anterior; resposta sem PII/token; falha de e-mail mantém `200`.
- **Web (Vitest):** parsing do contrato de sucesso/erro por status e mensagens en-US.
- **E2E:** sucesso genérico substituindo o formulário; erro de campo acessível; `429`;
  responsividade 360/768/1280; teclado/foco; light-only; en-US; link para sign-in.
- **Manual:** solicitação real contra API + Supabase local, inspeção do Mailpit em
  `http://127.0.0.1:54324`, conferência do link, expiração e ausência de token em logs.

## 9. QA manual

1. `bun run db:migrate` (sem reset) e `bun run dev`.
2. Abrir `/auth/forgot-password` sem sessão e com sessão ativa → página acessível nas duas.
3. Enviar formulário vazio e e-mail inválido → resumo `role="alert"` e erro junto ao campo.
4. Enviar e-mail de conta existente → mesma mensagem genérica; e-mail no Mailpit com link
   `/auth/reset-password?token=...` e aviso de 1 hora.
5. Enviar e-mail inexistente → mesma mensagem e nenhum e-mail novo no Mailpit.
6. Repetir a solicitação para a mesma conta → novo e-mail; token anterior inválido no banco.
7. Disparar mais de 5 tentativas em 60 s → `429` com mensagem genérica e `Retry-After`.
8. Verificar teclado, foco visível, 360/768/1280 px, light-only, textos en-US e ausência de
   token/e-mail nos logs da API.
9. Inspecionar um e-mail de nova sessão e confirmar o link de recuperação.

### Resultado do QA manual (2026-11-10)

Executado contra API (`localhost:3333`), web (`localhost:3000`), Supabase local e Mailpit
(`http://127.0.0.1:54324`), sem reset de banco:

- Conta criada via `POST /api/v1/auth/sign-up` (não confirmada; a confirmação pertence às fatias
  005/006 e ainda não existe nesta branch).
- `/auth/forgot-password` respondeu `200` com o formulário real (sem sessão).
- `POST /api/v1/auth/forgot-password` para a conta existente: `200` genérico, e-mail
  "Reset your password" no Mailpit com link `/auth/reset-password?token=...` e aviso de 1 hora.
- `auth_tokens` guardou apenas SHA-256 do token (hash conferido), sem token em claro.
- Segunda solicitação: novo e-mail e token anterior marcado com `used_at`; sobrou apenas um token
  de reset não usado.
- E-mail inexistente: mesmo `200` genérico e nenhum e-mail novo no Mailpit.
- E-mail inválido: `400` com `VALIDATION_ERROR` e `fieldErrors.email`.
- Rajada acima do limite: `429` com mensagem genérica e `Retry-After`.
- Logs da API sem e-mail, token ou hash (apenas `outcome` e status).
- Item 9 (link de recuperação no e-mail de nova sessão) não pôde ser exercitado manualmente nesta
  branch porque não há endpoints de confirmação/sign-in; a mudança está coberta pelos testes do
  `CreateSessionUseCase`. Teclado/foco/responsividade/light-only/en-US foram cobertos pelo E2E
  (`52 passed`).

## 10. Rollout e rollback

- Sem migração e sem feature flag; substitui o placeholder de `/auth/forgot-password`.
- Rollback: reverter o commit da spec; tokens de reset são descartáveis no ambiente local.
- Comunicação: documentação e testes na mesma mudança; follow-ups para rate limit distribuído e
  provedor de e-mail de produção.
