# Plano — Email provider selection by NODE_ENV

> **Spec:** [`.specs/010-email-provider-by-node-env.md`](../.specs/010-email-provider-by-node-env.md)
> **Status:** done
> **Atualizado em:** 2026-11-16

## 1. Contexto

O envio transacional da API está acoplado ao Mailtrap: `loadEnv` exige
`MAILTRAP_API_TOKEN` em qualquer ambiente e o `AuthModule` sempre injeta
`MailtrapEmailSender`. A spec 010 introduz a seleção por `NODE_ENV`, com `dev` como padrão
efetivo, Resend em `production` e Mailtrap nos demais valores. O contrato observável dos fluxos de
auth (remetente, assunto, conteúdo e destinatário) não muda.

## 2. Objetivo e critérios de aceite

Objetivo: escolher o provedor de e-mail pela configuração de ambiente, validar apenas as
credenciais do provedor ativo e manter os quatro e-mails transacionais existentes funcionando.

| Critério de aceite da spec                                                | Passos     |
| ------------------------------------------------------------------------- | ---------- |
| `NODE_ENV` ausente → `dev`, Mailtrap e não obrigatório                    | 1, 2, 6    |
| `NODE_ENV` diferente de `production` → Mailtrap                           | 1, 2, 6    |
| `NODE_ENV=production` → Resend                                            | 1, 2, 6    |
| Mailtrap ativo: variáveis ausentes/inválidas falham; Resend não é exigido | 1, 3, 6    |
| Resend ativo: variáveis ausentes/inválidas falham; Mailtrap não é exigido | 1, 3, 6    |
| Quatro e-mails enviados pelo provedor selecionado, sem vazar segredos/PII | 2, 4, 5, 7 |

## 3. Escopo

### Dentro

- `NODE_ENV` opcional com normalização (`trim` + `lowercase`) e padrão `dev`.
- Seleção `production` → Resend; qualquer outro valor → Mailtrap.
- Validação condicional das variáveis do provedor ativo.
- Adaptador Resend usando a API HTTP oficial via `fetch` nativo.
- Composição do `EmailSenderPort` por ambiente.
- Testes de configuração, seleção de provedor e adaptador Resend.
- Atualização de `.env.example`, `README.md`, `.docs/*` e da spec.

### Fora

- Novos tipos de e-mail, copy ou templates.
- DKIM/SPF, webhooks, tracking, métricas de abertura/clique ou fallback automático.
- Mudanças em fluxos de auth, UI, contratos HTTP, banco ou multi-tenant.
- Provisionamento de contas/credenciais nos provedores.
- SDK `resend`: a API HTTP oficial é suficiente para um único endpoint e evita uma dependência
  nova.

## 4. Abordagem técnica

- **Configuração (`env.ts`):**
  - `readNodeEnv` normaliza `NODE_ENV` e aplica `dev` quando ausente/vazio.
  - `selectEmailProvider` retorna `resend` apenas para `production`; demais valores retornam
    `mailtrap`.
  - `MAIL_FROM_EMAIL`/`MAIL_FROM_NAME` continuam compartilhados.
  - `RESEND_API_KEY` é exigido só com Resend ativo; `MAILTRAP_API_TOKEN` e as validações de
    sandbox são exigidas só com Mailtrap ativo.
  - Campos `nodeEnv`, `emailProvider`, `resendApiKey` e `mailtrapApiToken` entram no `Env`; o
    segredo do provedor inativo fica vazio e não é usado.
- **Adaptador Resend (`resend-email.sender.ts`):** `POST https://api.resend.com/emails` com
  `Authorization: Bearer`, `from` formatado, `to`, `subject`, `text` e `html`. Erros viram
  `ResendEmailError` com apenas o status HTTP, sem corpo da resposta, PII ou chave.
- **Composição (`create-email-sender.ts`):** escolhe o adaptador a partir do `Env`; o
  `AuthModule` passa a prover `EmailSenderPort` por essa factory. O cliente Mailtrap só é criado
  quando o provedor ativo é Mailtrap.
- **Observabilidade:** o boot registra `nodeEnv` e `emailProvider`, nunca chaves.

## 5. Arquivos e áreas afetadas

- `apps/api/src/modules/shared/config/env.ts` e `env.spec.ts`
- `apps/api/src/modules/auth/auth.module.ts`, `auth.tokens.ts`
- `apps/api/src/modules/auth/infrastructure/mailtrap-email.sender.ts`
- `apps/api/src/modules/auth/infrastructure/resend-email.sender.ts` (novo) e spec
- `apps/api/src/modules/auth/infrastructure/create-email-sender.ts` (novo) e spec
- `apps/api/src/main.ts`
- `apps/api/src/test/setup-env.ts` (se necessário)
- `.env.example`, `README.md`
- `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md`
- `.specs/010-email-provider-by-node-env.md`, este plano

## 6. Passos de implementação

- [x] 1. Adicionar `NODE_ENV` opcional, normalização, seleção de provedor e campos ao `Env`.
- [x] 2. Tornar a validação de Mailtrap/Resend condicional ao provedor ativo.
- [x] 3. Atualizar `env.spec.ts` com padrão `dev`, `production`, valores não produtivos,
      normalização e validação condicional.
- [x] 4. Criar o adaptador `ResendEmailSender` e seus testes (payload, remetente e erro).
- [x] 5. Criar a factory `createEmailSender` e testar a escolha por ambiente.
- [x] 6. Ligar o `AuthModule` à factory e registrar o provedor selecionado no boot.
- [x] 7. Rodar os testes da API e ajustar fakes/setup se necessário.
- [x] 8. Atualizar `.env.example`, `README.md` e `.docs/*` com o contrato de variáveis.
- [x] 9. Rodar `lint`, `types:check`, `test` e `build`; fazer QA manual.
- [x] 10. Atualizar spec/plano para `done` e executar `commit-and-push`.

## 7. Riscos e mitigação

| Risco                                                                    | Mitigação                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `NODE_ENV` implícito do runtime (ex.: Vitest) selecionar provedor errado | Normalização explícita e testes com fonte de env isolada; `test` continua não produção |
| Produção quebrar por falta de `RESEND_API_KEY`                           | Validação falha cedo com nome da variável                                              |
| Desenvolvedor sem Mailtrap continuar bloqueado                           | Padrão `dev` e validação só do Mailtrap; `.env.example` documenta                      |
| Diferença de payload entre provedores                                    | Testes do adaptador Resend e paridade com o contrato `EmailMessage`                    |
| Vazamento de chave em logs/erros                                         | `ResendEmailError` só com status; boot loga apenas provedor/ambiente                   |

## 8. Plano de testes

- **Unitário — env:** ausência de `NODE_ENV`, `production`, `development`/`test`/`staging`,
  `Production` normalizado, `MAILTRAP_API_TOKEN` ausente em dev, `RESEND_API_KEY` ausente em
  produção, variáveis do provedor inativo inválidas ignoradas, sandbox validada só em Mailtrap.
- **Unitário — Resend:** método/URL/headers/payload, `from` com nome, erro HTTP sem vazar
  segredo, sucesso não retorna conteúdo.
- **Unitário — factory:** `Env` de dev cria `MailtrapEmailSender`; `Env` de produção cria
  `ResendEmailSender`.
- **Integração:** suítes de auth existentes com `InMemoryEmailSender` continuam passando; os
  quatro templates permanecem iguais.
- **Manual:** boot sem `NODE_ENV` e com `NODE_ENV=production` (sem credenciais reais, validando
  falha clara) e revisão do `.env.example`.

## 9. QA manual

1. Ação: remover `NODE_ENV` do `.env` e subir a API com `MAILTRAP_API_TOKEN` válido.
   Esperado: API inicia, loga provedor `mailtrap` e `nodeEnv=dev`.
   Resultado: ok — API iniciou na porta `3333` e logou `"nodeEnv":"dev","emailProvider":"mailtrap"`.
2. Ação: subir com `NODE_ENV=production` sem `RESEND_API_KEY`.
   Esperado: boot falha citando `RESEND_API_KEY`, sem exigir Mailtrap.
   Resultado: ok — boot encerrou com `missing: RESEND_API_KEY` e não exigiu `MAILTRAP_API_TOKEN`.
3. Ação: subir com `NODE_ENV=production` e `RESEND_API_KEY` preenchida (valor de teste).
   Esperado: API inicia e loga provedor `resend`; nenhuma chave aparece no log.
   Resultado: ok — logou `"nodeEnv":"production","emailProvider":"resend"`; a chave de teste não
   apareceu em stdout/stderr.
4. Ação: disparar sign-up em dev e conferir o e-mail no Mailtrap.
   Esperado: mesmo assunto/conteúdo/remetente de antes.
   Resultado: ok — `POST /api/v1/auth/sign-up` respondeu `201`; a sandbox recebeu
   "Confirm your account" de `Experts <hello@demomailtrap.co>` para o destinatário de teste. O
   usuário de teste foi removido do banco ao final.

### Gates automatizados

- `bun run lint`: ok.
- `bun run types:check`: ok.
- `bun run test`: ok — 54 arquivos / 366 testes na API.
- `bun run build`: ok — API e web compilados.

## 10. Rollout e rollback

- Atualizar `.env.example` e a configuração de cada ambiente: não produção precisa de Mailtrap;
  produção precisa de `NODE_ENV=production` e `RESEND_API_KEY`.
- Sem migração de dados e sem feature flag.
- Rollback: reverter o commit e restaurar as variáveis anteriores; o Mailtrap volta a ser o único
  provedor.
