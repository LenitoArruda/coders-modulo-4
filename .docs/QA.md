# QA.md — Qualidade e verificação

> **Status:** ativo · **Atualizado em:** 2026-11-18
> **Use antes de declarar qualquer tarefa concluída.**

Este documento é a fonte de verdade sobre **como verificar** mudanças. Se um comando citado
aqui não existir no `package.json`, ele está marcado como 🧭 planejado.

---

## 1. Pré-requisitos

| Requisito               | Versão                              |
| ----------------------- | ----------------------------------- |
| Node.js                 | >= 24                               |
| Bun                     | 1.4.4                               |
| Docker Desktop          | em execução (PostgreSQL e LGTM)     |
| Weaviate local          | `127.0.0.1:8080` (spec 013)         |
| Dependências instaladas | `bun install`                       |
| Navegador do Playwright | `bun x playwright install chromium` |

---

## 2. Comandos existentes hoje

Execute na raiz do monorepo:

| Comando               | O que faz                                                    |
| --------------------- | ------------------------------------------------------------ |
| `bun install`         | Instala dependências                                         |
| `bun run dev`         | Sobe `web` (3000) e `api` (3333) em paralelo                 |
| `bun run build`       | Build de todos os apps/pacotes via Turbo                     |
| `bun run lint`        | ESLint em todos os apps/pacotes                              |
| `bun run lint:commit` | Valida a mensagem de commit preparada (Conventional Commits) |
| `bun run code:fix`    | ESLint `--fix` + Prettier em código, JSON, CSS e YAML        |
| `bun run format`      | Prettier em `**/*.{ts,tsx,md}`                               |
| `bun run types:check` | `tsc --noEmit` / typegen do Next em todos os apps/pacotes    |
| `bun run test`        | Testes unitários e de integração da API e do web (Vitest)    |
| `bun run test:watch`  | Vitest em modo watch (API e web)                             |
| `bun run test:e2e`    | Smoke E2E do web (Playwright)                                |
| `bun run infra:up`    | Sobe LGTM (Compose) e PostgreSQL 18                          |
| `bun run infra:down`  | Para PostgreSQL e LGTM (idempotente)                         |
| `bun run db:migrate`  | Aplica migrações pendentes no PostgreSQL local               |
| `bun run db:test`     | Executa os testes SQL de `db/tests/` no banco local          |

> `bun run db:test` exige o PostgreSQL ativo (`bun run infra:up`) e as migrações aplicadas
> (`bun run db:migrate`). Ele roda cada arquivo de `db/tests/` dentro de `BEGIN`/`ROLLBACK` usando
> `scripts/db.mjs`, sem depender de extensões externas de teste.

> Use sempre `bun run <script>`. `bun build` e `bun test` são comandos nativos do Bun e **não**
> executam os scripts do `package.json`.

> A API exige `JWT_SECRET` com no mínimo 32 caracteres no boot (veja `.env.example`); sem ele, a
> API não inicia. O provedor de e-mail é escolhido por `NODE_ENV` (`production` → Resend; demais →
> Mailtrap), e só as variáveis do provedor ativo são exigidas. Os testes não dependem do `.env`:
> `apps/api/src/test/setup-env.ts` define `NODE_ENV=test` e as variáveis mínimas (incluindo
> `JWT_SECRET`, `MAILTRAP_API_TOKEN`, `SESSION_TTL_SECONDS`, `CONFIRMATION_TOKEN_TTL_SECONDS`,
> `RESET_TOKEN_TTL_SECONDS` e as dos rate limits de sign-up, sign-in, forgot-password e
> reset-password).
>
> O E2E do web (`bun run test:e2e`) sobe uma **API fake** local em `127.0.0.1:3434`
> (`apps/web/e2e/support/fake-api-server.ts`) e aponta `API_BASE_URL` do web para ela. Assim os
> cenários de sessão, sign-up, sign-in, forgot-password e reset-password (sucesso, `400`, `401`, `403`, `409`, `429` e `503`) são
> determinísticos e não dependem do banco compartilhado, de credenciais ou de `JWT_SECRET`.
> E-mails especiais da fake no sign-up: `taken@example.com` (`409`),
> `mail-failure@example.com` (`503`) e `resend@example.com` (`200`); no forgot-password,
> `rate-limited@example.com` (`429`) e qualquer e-mail válido recebe `200` genérico. No sign-in,
> `<nome>@signin.example.com` com a senha `correct-password` entra (cada token novo invalida o
> anterior do mesmo e-mail), `unconfirmed@example.com` (`403` só com a senha correta),
> `rate-limited@example.com` (`429`) e `server-error@example.com` (`500`); o resto é `401`. No
> reset-password, o token `reset-token:<nome>:<único>` vale uma única vez e, ao ser usado, troca a
> senha de `<nome>@signin.example.com` e revoga as sessões dela (a senha antiga passa a falhar);
> `rate-limited-reset-token` responde `429`, qualquer outro token responde `INVALID_RESET_TOKEN` e
> a senha é validada antes do token, como na API real. A fake também implementa
> `GET/POST /api/v1/sources`, `POST /api/v1/sources/urls`, `DELETE /api/v1/sources/:sourceId` e
> `POST /api/v1/sources/:versionId/retry`, com estado isolado por token: dedup por SHA-256, nomes
> com `fail`/`broken`/`corrupt` entram como `failed` e voltam a `ready` no retry, e `pending`
> permanece `processing` até o polling. Para URLs, `POST /__fake/pages` (somente teste) define o
> título, o texto e o estado da página (`text`, `no-text`, `unavailable`), permitindo simular
> conteúdo alterado e falha de busca sem acessar a rede. URLs internas e esquemas não http/https
> são recusados com `BLOCKED_SOURCE_URL`/`INVALID_SOURCE_URL`. Na fatia 015 a fake também aceita
> imagem/áudio/vídeo quando a requisição traz `allowMedia`, simulando extração
> (`extracting` → `chunking` → `embedding`), reaproveitamento por hash, "No speech detected",
> retry e exclusão; cenários de mídia ligam a flag com o cookie `knowledge_media_enabled=1` no
> contexto do navegador, sem alterar a config global. No chat, os prefixos determinísticos `cite:`,
> `stale:`, `removed:`, `nomatch:` e `vector-down:` ativam os cenários de citação da spec 016;
> prompts sem prefixo preservam o modo fatia 012. Não deixe um `bun run dev` antigo ocupando a
> porta 3000 antes do E2E, pois o Playwright reutiliza o servidor existente em modo local.

### 2.1 Comando do OpenCode

| Comando            | O que faz                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `/commit-and-push` | Analisa o diff, cria um commit Conventional Commits com `Co-authored-by: OpenCode Agent <noreply@opencode.ai>` e faz push |

> O fluxo está em `.agents/commands/commit-and-push.md`. Ele é obrigatório ao final de cada
> spec (skill `implement-me`). Fora disso, só execute com pedido explícito do usuário.

---

## 3. Execução por pacote

```sh
bunx turbo lint --filter=web --only
bunx turbo types:check --filter=api --only
bunx turbo test --filter=api --only
bunx turbo build --filter=web
```

> O Turbo executa também as dependências por padrão (`dependsOn`). Use `--only` quando quiser
> restringir a tarefa ao pacote filtrado; não use `--only` no `build`, que precisa das
> dependências.

---

## 4. Ordem obrigatória de verificação

1. `bun run code:fix` (quando houver correções automáticas pendentes)
2. `bun run lint`
3. `bun run types:check`
4. `bun run test`
5. `bun run build`
6. `bun run test:e2e` (quando a mudança afetar o web)
7. QA manual do fluxo alterado

O `build` é o **gate final**: se ele falha, a tarefa não está concluída.

---

## 5. QA por tipo de mudança

### 5.1 UI

- [ ] Light theme apenas; sem dark mode.
- [ ] Cores e tokens do design system.
- [ ] Contraste AA (texto sobre pastel é grafite).
- [ ] Navegação por teclado e foco visível.
- [ ] Labels e nomes acessíveis.
- [ ] Layout em 360px, 768px e 1280px, sem rolagem horizontal.
- [ ] Estados: loading, vazio, erro, disabled.
- [ ] Textos de UI em en-US e sem erros; documentação interna em PT-BR.

### 5.2 API

- [ ] Status HTTP corretos (200, 201, 204, 400, 401, 403, 404, 409, 422, 500).
- [ ] Validação de entrada e mensagens de erro claras.
- [ ] Autenticação/autorização aplicadas.
- [ ] Cada endpoint tem seu `*RequestHandler` em `interface/request-handlers/`, com um método de
      rota e um `*UseCase` (1:1); não há controller multi-endpoint no escopo.
- [ ] Erros de domínio/aplicação são traduzidos na interface, sem vazar detalhes internos.
- [ ] Paginação, filtros e ordenação quando aplicável.
- [ ] Nenhum detalhe interno (stack, SQL) exposto.
- [ ] Logs com contexto e sem PII.
- [ ] Logs, métricas e traces chegam ao LGTM (`service_name="coders-modulo-4-api"`).

### 5.3 Banco de dados

- [ ] Migração aplicável e reversível.
- [ ] Índices para consultas críticas.
- [ ] RLS/isolamento por tenant quando aplicável.
- [ ] Nenhuma perda de dados.
- [ ] Seed/dados de teste documentados.
- [ ] `bun run db:migrate` aplica a migração e `bun run db:test` passa com os testes SQL.

### 5.4 Conectores e integrações

- [ ] Autenticação e renovação de token.
- [ ] Timeout, retry e rate limit tratados.
- [ ] Mapeamento de payload validado.
- [ ] Falha de uma fonte não derruba o fluxo inteiro.
- [ ] Segredos fora do código e dos logs.

### 5.5 Documentação

- [ ] Links internos funcionam.
- [ ] Comandos citados existem ou estão marcados como planejados.
- [ ] Sem contradição com `RULES.md` ou `ARCHITECTURE.md`.
- [ ] Exemplos de código compilam/refletem a realidade.

### 5.6 Dependências

- [ ] Necessidade justificada (alternativa nativa?).
- [ ] Licença compatível.
- [ ] Impacto no bundle e na segurança avaliado.
- [ ] `bun.lock` atualizado.
- [ ] Documentação da stack atualizada.

### 5.7 Infraestrutura e observabilidade

- [ ] `bun run infra:up` sobe PostgreSQL e LGTM e o Grafana responde em `http://localhost:3010`.
- [ ] `bun run db:migrate` aplica migrações pendentes e é idempotente.
- [ ] `bun run infra:down` para os serviços e funciona quando já estão parados.
- [ ] Nenhum container em loop de reinício (`docker ps` estável).
- [ ] Logs, métricas e traces visíveis no Grafana em até 30 s após uma requisição à API.
- [ ] Nenhum segredo aparece nos logs do coletor ou da aplicação.

### 5.8 Git e commits

- [ ] Mensagem segue Conventional Commits (`<tipo>(<escopo>): <descrição>`).
- [ ] O hook `commit-msg` está instalado (`.git/hooks/commit-msg`). Ele roda `scripts/commitlint-hook.mjs`, que resolve o arquivo da mensagem pelo próprio git; o placeholder `{1}` do Lefthook quebra em caminhos com espaços (Windows/worktrees). `git commit` normal não deve exigir `LEFTHOOK_EXCLUDE` nem `--no-verify`.
- [ ] `bun run lint:commit` passa para a mensagem preparada.
- [ ] Ao final de uma spec, `commit-and-push` foi executado (commit + push).
- [ ] `git status` sem segredos, artefatos gerados ou arquivos acidentais.

> **Execução orquestrada:** quando a spec roda como subagente de `orchestrate-me`, o subagente
> cria apenas o **commit local** na branch da spec; push e merge ficam com o orquestrador. Fora
> desse modo, vale `commit-and-push`.

### 5.9 Autenticação e sessão

- [ ] `JWT_SECRET` ausente ou com menos de 32 caracteres impede o boot com mensagem clara.
- [ ] JWT contém apenas `sub`, `sid`, `iat` e `exp`; expiração respeita `SESSION_TTL_SECONDS`.
- [ ] `/me` com JWT válido **e** sessão ativa responde 200 com os dados básicos.
- [ ] JWT ausente, inválido, expirado, revogado ou `sub` divergente responde o **mesmo** 401 do
      contrato, sem detalhes internos.
- [ ] Nova sessão revoga as anteriores; o JWT antigo deixa de valer imediatamente.
- [ ] `POST /api/v1/auth/sign-out` com sessão ativa → `204` sem corpo, sessão revogada e o JWT
      deixa de valer imediatamente; sem token ou token inválido → `401` do contrato.
- [ ] Sessão expirada (`expires_at` no passado) não é considerada ativa.
- [ ] E-mail de nova sessão: assunto "New session on your account", data/hora, alerta de senha e
      link para `/auth/forgot-password`.
- [ ] Cookie `session_token`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = TTL e `Secure`
      somente em produção.
- [ ] Logs sem JWT, cookie, e-mail completo, senha ou segredo; use `userId`/`sessionId`.
- [ ] Rotas em `/api/v1`; caminhos fora do prefixo (incluindo `GET /`) respondem 404 com contrato.

### 5.10 Navegação e rotas do web

- [ ] `/` sem sessão → `/auth/sign-in`; com sessão válida → `/app`.
- [ ] `/app` e `/app/*` sem cookie, com token inválido ou API indisponível → `/auth/sign-in` (com `returnTo=<caminho>` para `/app/*`).
- [ ] `/app` e `/app/*` com sessão válida carregam o shell e a página inicial com o primeiro nome.
- [ ] `/auth/sign-up` e `/auth/sign-in` com sessão válida → `/app`; `/auth/confirm` processa um
      token presente mesmo com sessão ativa e, sem token, envia pessoa autenticada para `/app` e
      visitante para `/auth/sign-in`.
- [ ] `/auth/forgot-password` e `/auth/reset-password` permanecem acessíveis com sessão.
- [ ] `/auth/*` inexistente → 404 no layout público; `/app/*` inexistente com sessão → 404 no shell.
- [ ] `lang="en-US"`, textos en-US, light-only, foco visível e sem rolagem horizontal em
      360 px, 768 px e 1280 px.
- [ ] CORS aceita `WEB_ORIGIN` com `GET`, `HEAD`, `POST`, `OPTIONS` e headers `Authorization` e
      `Content-Type`; outras origens não recebem `Access-Control-Allow-Origin`.
- [ ] HTML/JS não expõe token, JWT ou dados de sessão.

### 5.11 Sign-up e confirmação de e-mail

- [ ] `/auth/sign-up` substitui o placeholder, usa en-US, light-only e não cria sessão/JWT/cookie.
- [ ] Campos first name, last name, email, password e confirm password têm labels visíveis e
      `autocomplete` adequado; o formulário funciona por teclado.
- [ ] Campos ausentes, e-mail inválido, senha fora de 8–128 ou confirmação diferente → `400`, erros
      junto aos campos com `aria-describedby` e `role="alert"`, sem criar conta.
- [ ] Sign-up válido → `201`, conta com `email_confirmed_at` nulo, hash scrypt em
      `users.password_hash` e nenhum token/senha na resposta.
- [ ] E-mail "Confirm your account" en-US com link `/auth/confirm?token=...`, aviso de 24 h e
      orientação para ignorar; token só existe em claro na mensagem, nunca em log.
- [ ] `auth_tokens` guarda apenas `token_hash`; o reenvio invalida o token pendente anterior.
- [ ] E-mail confirmado → `409` sem duplicata; não confirmado → `200` com reenvio, sem duplicata.
- [ ] Falha de envio de e-mail → `503` acionável e a conta não confirmada pode ser reutilizada no retry.
- [ ] Rate limit por IP: acima de `SIGN_UP_RATE_LIMIT_MAX` em `SIGN_UP_RATE_LIMIT_WINDOW_SECONDS`
      → `429` com mensagem genérica, sem detalhes internos.
- [ ] `/auth/confirm?token=...` envia o token no corpo, auto-submete uma vez, grava o cookie
      `HttpOnly` e redireciona para `/app`; após o uso, a URL não contém mais o token.
- [ ] O terminal do `next dev` não imprime requisições para `/auth/confirm` (nem o token), via
      `logging.incomingRequests.ignore`; requests de outras rotas continuam logados.
- [ ] Token válido confirma `email_confirmed_at`, marca `used_at`, cria sessão com
      `origin = sign_up_confirmation`, revoga as anteriores e dispara "New session on your account".
- [ ] Token ausente, desconhecido, expirado ou já usado → `400`; conta já confirmada → `409` sem
      nova sessão; em ambos não há cookie novo e a página oferece sign-up/sign-in.
- [ ] Acima de `CONFIRMATION_RATE_LIMIT_MAX` em `CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS` → `429`
      com `Retry-After`, sem detalhes internos.
- [ ] Confirmações simultâneas deixam exatamente uma sessão ativa e o JWT anterior passa a `401`.
- [ ] Com JavaScript desabilitado, o botão de fallback confirma a conta e o cookie abre `/app`.
- [ ] E2E cobre sucesso/cookie/URL sem token, inválido, `409`, `429`, link sem token, sessão ativa,
      foco visível e 360/768/1280 px sem rolagem horizontal.
- [ ] E-mails transacionais seguem `DESIGN.md` (light-only, paleta, texto grafite sobre o botão pastel, 1 ação primária, link de fallback) e não têm rolagem horizontal em 360 px.
- [ ] Em dev, logs do Mailtrap (`https://mailtrap.io/sending/email_logs`): e-mails "Confirm your account" e "New session on your account" inspecionados
      no QA manual, com data/hora e alerta de senha no segundo.
- [ ] `CONFIRMATION_TOKEN_TTL_SECONDS` controla a expiração (padrão 86400) e os limites de rate
      limit vêm do env; logs incluem operação/`userId`, sem e-mail, senha ou token.
- [ ] `/app` continua redirecionando para `/auth/sign-in` sem sessão após um sign-up bem-sucedido.
- [ ] E2E cobre erros por campo, sucesso, `409`, `429`, `503`, foco visível, light-only e
      360/768/1280 px sem rolagem horizontal; logs do Mailtrap validados no QA manual.

### 5.12 Recuperação de senha

- [ ] `/auth/forgot-password` substitui o placeholder, usa en-US, light-only e permanece acessível
      com e sem sessão.
- [ ] O campo de e-mail tem label visível, `autocomplete="email"`, funciona por teclado, tem foco
      visível e erro associado com `aria-describedby` e `role="alert"`.
- [ ] E-mail ausente ou sintaticamente inválido → `400` com `fieldErrors.email`, sem criar token e
      sem revelar se a conta existe.
- [ ] Qualquer e-mail sintaticamente válido → `200` com a **mesma** mensagem
      "If an account exists for this email, we sent a password reset link.", exista ou não a conta.
- [ ] Conta existente (confirmada ou não) recebe e-mail "Reset your password" en-US com link
      `/auth/reset-password?token=...`, aviso de expiração de 1 h e orientação para ignorar.
- [ ] `auth_tokens` guarda `purpose = password_reset` e apenas `token_hash`; o token claro não
      aparece na resposta, no banco, em logs ou em métricas.
- [ ] `RESET_TOKEN_TTL_SECONDS` controla a expiração (padrão 3600 s); um novo pedido invalida o
      token pendente anterior e dois pedidos simultâneos não deixam dois tokens válidos.
- [ ] Falha de envio de e-mail mantém o `200` genérico, registra a falha sem PII e permite nova tentativa.
- [ ] Rate limit por IP e por e-mail: acima de `FORGOT_PASSWORD_RATE_LIMIT_MAX` em
      `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS` → `429` com mensagem genérica e `Retry-After`.
- [ ] E-mail de nova sessão contém o link de recuperação.
- [ ] E2E cobre validação, sucesso genérico, `429`, foco visível, light-only e 360/768/1280 px sem
      rolagem horizontal; logs do Mailtrap e o link real validados no QA manual.

### 5.13 Sign-in (fatia 006)

- [ ] `/auth/sign-in` substitui o placeholder, usa en-US, light-only, labels, `aria-describedby`
      e link "Forgot password?" para `/auth/forgot-password`.
- [ ] Credenciais válidas → sessão `sign_in`, cookie `HttpOnly`/`SameSite=Lax`, redirect para `/app`
      ou para o `returnTo` seguro e e-mail "New session on your account" no provedor ativo.
- [ ] Senha errada, e-mail inexistente ou e-mail malformado → `401` com a mesma mensagem; corpo
      vazio/malformado → `400`; conta não confirmada com a senha certa → `403`.
- [ ] Segundo dispositivo revoga o primeiro (JWT antigo → `401`, `/app` redireciona para sign-in).
- [ ] `returnTo` externo, `//`, barra invertida, `..` ou fora de `/app` cai em `/app`.
- [ ] 6ª tentativa do mesmo IP + e-mail em `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS` (padrão 60 s) →
      `429` com `Retry-After`; sem e-mail, senha ou token nos logs.

### 5.14 Troca de senha (fatia 008)

- [ ] `/auth/reset-password` substitui o placeholder, usa en-US, light-only e permanece acessível
      com e sem sessão; campos "New password" e "Confirm new password" com label visível,
      `autocomplete="new-password"`, foco visível e erros com `aria-describedby` e `role="alert"`.
- [ ] Token válido + senha e confirmação válidas → `200`, hash atualizado (nunca a senha em
      claro), token consumido, outros tokens `password_reset` invalidados, **todas** as sessões
      revogadas e e-mail "Your password has been changed" en-US nos logs do provedor ativo
      com orientação para solicitar novo reset.
- [ ] Após o sucesso o web mostra a confirmação, redireciona para `/auth/sign-in?reset=success` e o
      sign-in exibe "Your password has been updated. Sign in with your new password."
- [ ] Token ausente, desconhecido, expirado ou já usado → `400` `INVALID_RESET_TOKEN`, página mostra
      "This password reset link is invalid or has expired." e link para `/auth/forgot-password`;
      a senha não muda e nenhuma sessão é criada.
- [ ] Senha fora da política (8–128) ou confirmação diferente → `400` `VALIDATION_ERROR` com
      `fieldErrors`, mensagens do sign-up, e o token **não** é consumido (a nova tentativa funciona).
- [ ] Conta não confirmada: o reset confirma o e-mail e a pessoa entra com a nova senha.
- [ ] JWT antigo → `/me` responde `401`; sign-in com a senha antiga falha e com a nova funciona.
- [ ] Dois resets simultâneos com o mesmo token: apenas um responde `200`; o outro `INVALID_RESET_TOKEN`.
- [ ] Falha de envio de e-mail no e-mail de sucesso não reverte a senha nem muda o `200`.
- [ ] Rate limit por IP: a 6ª tentativa em `RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS` (padrão 60 s,
      `RESET_PASSWORD_RATE_LIMIT_MAX` = 5) → `429` com `Retry-After`.
- [ ] O token sai da barra de endereços (`history.replaceState`), a resposta da rota traz
      `Referrer-Policy: no-referrer`, a página não carrega recursos externos e nenhum token, senha
      ou e-mail aparece em logs do web ou da API.
- [ ] E2E cobre fluxo completo, URL limpa, `Referrer-Policy`, link inválido/ausente, segundo uso,
      sessão antiga invalidada, validação, `429`, foco visível, light-only e 360/768/1280 px sem
      rolagem horizontal.

### 5.15 Provedor de e-mail por ambiente

- [ ] `NODE_ENV` ausente ou vazio → `dev`, provedor Mailtrap e `NODE_ENV` não é obrigatório.
- [ ] `NODE_ENV` diferente de `production` (ex.: `dev`, `development`, `test`, `staging`) → Mailtrap.
- [ ] `NODE_ENV=production` → Resend, inclusive com espaços/capitalização normalizados.
- [ ] Mailtrap ativo: `MAILTRAP_API_TOKEN` ausente falha no boot citando a variável; `RESEND_API_KEY`
      não é exigida.
- [ ] Resend ativo: `RESEND_API_KEY` ausente falha no boot citando a variável; `MAILTRAP_API_TOKEN`
      não é exigida.
- [ ] `MAIL_FROM_EMAIL`/`MAIL_FROM_NAME` são compartilhados e o remetente chega igual nos dois
      provedores.
- [ ] `MAILTRAP_SANDBOX`/`MAILTRAP_SANDBOX_ID` continuam válidos só com Mailtrap ativo; variáveis
      inválidas do provedor inativo são ignoradas.
- [ ] Os quatro e-mails (confirmação, nova sessão, recuperação e senha alterada) mantêm assunto,
      conteúdo e destinatário no provedor ativo.
- [ ] O boot loga `nodeEnv` e `emailProvider`, sem chaves, tokens ou conteúdo de e-mail.
- [ ] `.env.example` separa os blocos de Mailtrap e Resend e não contém segredos reais.

### 5.16 Fontes de conhecimento por arquivo (fatia 013)

- [ ] FAB na home privada abre/fecha o painel, expõe `aria-expanded`/`aria-controls` e tem alvo ≥ 44 px.
- [ ] Lista mostra nome, tipo, tamanho, versão, quantidade de chunks e status; estado vazio orienta o upload.
- [ ] Upload de PDF/TXT/Markdown responde `202` com versão `processing`; polling leva a `ready`.
- [ ] Conteúdo idêntico do mesmo usuário responde “Already connected” sem nova versão, chunk ou vetor.
- [ ] Mesmo conteúdo em usuário diferente cria fonte distinta (isolamento por `user_id`).
- [ ] Tipo não suportado, arquivo vazio, acima de 10 MB e mais de 5 arquivos são recusados com
      mensagem en-US; `.env.example` e `docker-compose.yml` não são alterados.
- [ ] Mesmo nome normalizado com conteúdo diferente cria nova `SourceVersion`; a anterior deixa de
      ser a atual e é sinalizada como desatualizada.
- [ ] Falha de extração/embedding/vetor persiste `failed`, nunca `ready`; `POST /:versionId/retry`
      limpa vetores parciais e permite reprocessar.
- [ ] Dois envios simultâneos do mesmo hash: índice único parcial deixa uma versão válida e o
      conflito vira “Already connected”.
- [ ] `DELETE /:sourceId` responde `204` e remove arquivo (`bytea`), versões, chunks e vetores;
      conversas do usuário permanecem.
- [ ] Logs/telemetria `knowledge.sources` e o cliente não contêm conteúdo, nome de arquivo, hash,
      chave de API ou token de sessão.
- [ ] E2E cobre FAB, upload misto, dedup, versionamento, pendente, inválido, retry, remoção,
      isolamento, teclado/foco e 360/768/1280 px sem rolagem horizontal.

### 5.17 Fontes de conhecimento por URL (fatia 014)

- [ ] Campo “Add a URL” tem rótulo, dica em inglês, `inputmode="url"` e mensagem para URL vazia.
- [ ] `POST /api/v1/sources/urls` com JSON `{ url }` responde `202` com `name`, `url`, `status`,
      `versionId` e `alreadyConnected`; o token segue apenas no Server Action.
- [ ] Normalização remove fragmento e parâmetros de rastreamento, minúscula o host e limita 255
      caracteres; a URL exibida na lista é a normalizada.
- [ ] URL pública com texto aparece `processing` e depois `ready`, com título, endereço, versão e
      chunks; texto extraído vira `source_files.content` e o hash é SHA-256 desse texto.
- [ ] Mesma URL com mesmo conteúdo responde “Already connected” sem nova versão, chunk ou vetor.
- [ ] Duas URLs diferentes com o mesmo texto geram apenas uma fonte válida para o usuário.
- [ ] Conteúdo alterado na mesma URL cria nova `SourceVersion`; a anterior fica desatualizada.
- [ ] Esquema não http/https, credenciais, host interno/loopback/metadados e redirect para rede
      privada são recusados antes de qualquer conexão; E2E cobre `ftp://` e `127.0.0.1`.
- [ ] Fetch com timeout, resposta > 2 MB, sem texto, 5xx transitório e redirects acima de 3 vira
      versão `failed` com mensagem acionável; o retry refaz a busca e pode chegar a `ready`.
- [ ] Isolamento por `user_id` cobre registro e vetores; exclusão remove URL, versões, chunks e
      vetores e preserva conversas.
- [ ] Logs/telemetria e cliente não contêm URL, trecho de página, hash, `SOURCE_OPENAI_API_KEY` ou
      token de sessão.
- [ ] E2E cobre URL válida, normalização, dedup por URL/conteúdo, mudança de conteúdo, recusa
      interna, falha e retry, isolamento, remoção, teclado/foco e 360/768/1280 px sem scroll horizontal.

---

### 5.18 Mídia como conhecimento (fatia 015)

- [ ] Flag `knowledge_media_enabled` desligada por padrão: sem Image/Audio/Video no painel e suíte
      da 013 permanece verde (o E2E liga a flag com cookie no contexto, não na config global).
- [ ] PNG/JPEG válidos viram `processing` → `ready` com texto de OCR; MP3/MP4 com fala viram
      transcrição fatiada e vetores no Weaviate com o mesmo `source_id` da fonte.
- [ ] `type` inválido, extensão/MIME/magic bytes divergentes, tamanho acima de 25/50/200 MB e
      duração acima de 60 min são recusados com mensagem en-US e nenhuma fonte é criada.
- [ ] Reenvio do mesmo arquivo responde “Already connected” e não duplica chunk/vetor; outro
      usuário com o mesmo arquivo vê apenas a sua fonte.
- [ ] Áudio/vídeo sem fala falha com **“No speech detected”** e não grava vetores; falha de
      extração mostra mensagem acionável e “Try again” reinicia o mesmo `sourceId`.
- [ ] Listagem mantém status público da 013 e mostra fases `extracting`/`chunking`/`embedding`
      como detalhe; exclusão remove arquivo, versões, chunks e vetores sem apagar histórico de chat.
- [ ] Navegação por teclado e leitor de tela alcançam seletor, input, progresso e erro (`aria-live`);
      rótulos e ordem de foco da 013 (`knowledge-source-files`, “Add files”) permanecem intactos.
- [ ] Logs e telemetria `media.*` não contêm nome de arquivo, hash, comando, transcrição ou chave;
      `.env` não é lido, exibido ou versionado.

### 5.19 Recuperação e citações (fatia 5 / spec 016)

- [ ] `RAG_CITATIONS_ENABLED=false` por padrão: chat, sugestões, histórico e respostas sem campo
      de citação continuam idênticos à fatia 012.
- [ ] Com flag ligada e trecho relevante, a resposta traz `[n]` válido, `citations[]`,
      `retrieval` e `answer_status = with_source`.
- [ ] Marcadores fora de `[1..k]` são removidos; citações inválidas não viram fonte no painel.
- [ ] Sem trecho acima de `RAG_THRESHOLD`, a resposta diz que não encontrou base, não mostra
      citações e grava `answer_status = no_match`.
- [ ] `RAG_TOP_K`, `RAG_THRESHOLD`, `RAG_MAX_CONTEXT_CHARS` e `RAG_MAX_HISTORY_MESSAGES` são
      validados na configuração e limitam custo/latência.
- [ ] Busca Weaviate usa `KnowledgeChunk`, filtro por `user_id` autenticado e timeout de 4 s;
      nenhuma fonte de outro usuário é retornada.
- [ ] Tipos de fonte novos ou desconhecidos são tolerados pelo contrato de vetor, sem alterar a
      slice 013.
- [ ] `isStale` e `sourceRemoved` são recalculados na leitura do histórico; a fonte removida
      mantém o texto e desabilita o botão com "Source removed".
- [ ] Citações são botões com `aria-label` descritivo e foco visível; o painel lateral mostra
      nome, tipo, localização e trecho exato, e fecha com `Esc`.
- [ ] Falha do vetorial produz aviso en-US acionável, resposta básica sem citações e
      "Retry search"; nenhuma citação é inventada.
- [ ] Falha do modelo continua `503 MODEL_UNAVAILABLE`, sem detalhes técnicos e sem mensagem
      parcial persistida.
- [ ] Documentos e prompts são tratados como dados não confiáveis; instruções neles não alteram
      papel, tom ou política de citação do Expert.
- [ ] E2E cobre abrir/fechar painel, persistência após reload, fonte antiga, fonte removida,
      sem correspondência, retry do vetorial e prompt sem fontes.
- [ ] Logs/telemetria `rag.*` contêm só IDs opacos, contagens, duração e desfecho; sem prompt,
      trecho, chave de API, hash de conteúdo ou token de sessão.

---

## 6. QA manual — template

Registre no relatório final:

```md
### Cenário: <nome>

1. Ação: <passo>
   Esperado: <resultado>
   Resultado: ok

2. Ação: <passo>
   Esperado: <resultado>
   Resultado: falha — <evidência>
```

Inclua ambiente (navegador/dispositivo) quando for UI.

---

## 7. Regressão mínima

Antes de finalizar, verifique se a mudança não quebrou:

- [ ] Rotas existentes (`/` do `web` redirecionando por sessão e `/` do `docs`;
      `GET /api/v1/hello` na API; `GET /` da API deve responder 404 com o contrato).
- [ ] Componentes compartilhados usados por mais de um app.
- [ ] Scripts do monorepo (`dev`, `build`, `lint`, `types:check`, `test`, `test:e2e`,
      `infra:up`, `infra:down`).
- [ ] Build de produção.
- [ ] Serviços de infraestrutura estáveis após `infra:up`/`infra:down`.

---

## 8. Definition of Done (DoD)

- [ ] Plano criado/atualizado em `.plans/<numero>-<slug>-plan.md`.
- [ ] `bun run lint` passa.
- [ ] `bun run types:check` passa.
- [ ] `bun run test` passa.
- [ ] `bun run build` passa.
- [ ] Testes adicionados/atualizados para toda mudança de comportamento.
- [ ] `bun run test:e2e` passa quando a mudança afeta o web.
- [ ] QA manual executado e registrado.
- [ ] UI acessível e responsiva (quando aplicável).
- [ ] Documentação afetada atualizada.
- [ ] Sem segredos ou artefatos gerados no diff.
- [ ] Mensagem de commit segue Conventional Commits (validada pelo commitlint).
- [ ] Ao final de uma spec, `commit-and-push` executado (commit + push).
- [ ] Relatório final entregue conforme [RULES.md](./RULES.md#8-relatório-final-obrigatório).

> O bloqueio antigo de lint (preset Babel) foi corrigido na fundação. Se ele voltar a ocorrer,
> trate como regressão e registre no relatório.

---

## 9. CI alvo (🧭)

Pipeline recomendado, nesta ordem:

```text
install → lint → types:check → test → build → test:e2e
```

Requisitos:

- Cache do Turbo entre execuções.
- Falhar em qualquer etapa com erro.
- Rodar em pull requests e na branch principal.
- Validar as mensagens de commit do PR com `commitlint --from <base> --to HEAD`.
- Não fazer deploy sem `lint`, `types:check`, `test` e `build` verdes.

> Ainda não existe configuração de CI no repositório (`.github/workflows`).

---

## 10. Lacunas conhecidas

| Lacuna                                       | Impacto                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Nenhum CI                                    | Verificação depende do ambiente local                                                                                              |
| Commitlint apenas local                      | Como não há CI, mensagens só são validadas pelo hook `commit-msg`                                                                  |
| Stack LangSmith licenciada não validada      | Studio, traces ao vivo e persistência dependem de imagem Enterprise; a validação entregue é local-first/offline (spec 018)         |
| Sem Vitest/Testing Library no pacote `ui`    | Componentes compartilhados não têm testes unitários                                                                                |
| Migrações sem rollback automático            | `scripts/db.mjs` aplica em transação, mas não gera `down`; reverter exige nova migração                                            |
| PostgreSQL local em `18`                     | Versão do Compose; o provedor gerenciado de produção segue em aberto (ADR 0016)                                                    |
| OXLint/OXFmt não adotados                    | ESLint + Prettier seguem como padrão nesta entrega                                                                                 |
| Skills versionadas, disponibilidade variável | `implement-me`, `breakdown-specs` etc. estão em `.agents/skills/`; se o cliente não as carregar, use a política durável em `.docs` |
| Rate limit em memória                        | Limites de sign-up, confirmação, forgot/sign-in/reset são locais ao processo; store compartilhado é follow-up                      |
| Sem refresh de sessão                        | Sign-out implementado em `POST /api/v1/auth/sign-out`; a sessão ainda só é renovada por novo sign-in                               |
| Sessão única sem atomicidade no banco        | A garantia é da aplicação (create-then-revoke); RPC transacional é follow-up do ADR 0013                                           |

Ao resolver uma lacuna, atualize esta tabela e o documento relacionado.

---

## 11. Evidências da spec 013 (2026-11-18)

Executadas na raiz do monorepo, em `spec/013`, com `OPENAI_API_KEY` disponível apenas no ambiente
do servidor e sem chamada real à OpenAI durante os testes:

| Comando                               | Resultado                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `bun run lint`                        | ok (todos os pacotes)                                                         |
| `bun run types:check`                 | ok (todos os pacotes)                                                         |
| `bun run test`                        | ok — API: 64 arquivos / 421 testes; web: 11 arquivos / 137 testes             |
| Subconjunto `sources` da API (Vitest) | ok — 6 arquivos / 35 testes                                                   |
| `bun run build`                       | ok — 2 tarefas Turbo (`api`, `web`), 13,64 s                                  |
| `bun run test:e2e`                    | ok — 136 testes, ~2,5 min, incluindo os 13 cenários de fontes de conhecimento |

Cobertura adicional da fatia 013:

- Adaptador Weaviate validado contra servidor HTTP local (REST/GraphQL na porta 8080), sem gRPC.
- Extrator, embeddings e repositório validados com fakes; nenhum documento real foi enviado e nenhum
  valor de chave foi lido, exibido ou registrado.
- Fake API do E2E implementa `GET/POST /api/v1/sources`, `DELETE /api/v1/sources/:sourceId` e
  `POST /api/v1/sources/:versionId/retry`, com isolamento por token e dedup por SHA-256.
- Telemetria `knowledge.sources` limitada a IDs opacos, `operation`, `outcome`, `durationMs`,
  `chunkCount`, `userId` e códigos genéricos de erro; sem conteúdo, nome de arquivo, hash, token ou
  chave de API.

Limitação registrada:

- `bun run db:migrate` foi executado uma vez e falhou com `ECONNREFUSED 127.0.0.1:5433`; não foi
  repetido e nenhum comando destrutivo de banco foi executado. A migração aditiva
  `0003_knowledge_sources.sql` e o teste `003_knowledge_sources.test.sql` foram entregues, mas a
  aplicação local do schema não foi confirmada.
- `bun run db:test` não foi autorizado para esta entrega e não foi executado. A validação real com
  PostgreSQL, Weaviate e OpenAI segue como follow-up de integração.

---

## 12. Evidências da spec 014 (2026-11-18)

Executadas na raiz do monorepo, em `spec/014`, após `bun install --frozen-lockfile` (544 pacotes),
sem ler valores de `.env` e sem chamada real à OpenAI durante os testes:

| Comando                                   | Resultado                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                            | ok — 3 tarefas (1 em cache), 1m2,692s                                                                                                                                                 |
| `bun run types:check`                     | ok — 3 tarefas (1 em cache), 1m33,203s                                                                                                                                                |
| `bun run test`                            | ok — API: 66 arquivos / 442 testes; web: 11 arquivos / 147 testes; 4m33,172s                                                                                                          |
| `bun run build`                           | ok — 2 tarefas Turbo, 31,807s                                                                                                                                                         |
| `bun run test:e2e` (`apps/web`, 1 worker) | 147 testes: 144 passaram na execução completa; 3 testes antigos expiraram por timeout do Next dev e passaram isoladamente (3/3). Os 11 cenários de URL passaram na execução completa. |

Cobertura adicional da fatia 014:

- Política de URL testada por unidade (normalização, esquemas, faixas de IP, metadados, redirects,
  extração) e adaptador HTTP validado contra servidor local, com `allowPrivateHosts` apenas em teste.
- Fake API do E2E estendida com `POST /api/v1/sources/urls`, `POST /__fake/pages`, dedup por conteúdo,
  retry com refetch e isolamento por token; cliente nunca recebe URL de origem, texto, hash ou chave.
- Nenhuma migração nova: a página é persistida como `txt` com marcador `text/plain+url` no esquema 013.

Limitação registrada:

- `bun run infra:up` falhou porque o Docker não está instalado ou em execução; `bun run db:migrate`
  encontrou `ECONNREFUSED 127.0.0.1:5433` e a porta 5432 recusou a autenticação. Nenhum comando
  destrutivo de banco foi executado; validação real com PostgreSQL/Weaviate segue como follow-up.

## 13. Evidências da spec 015 (2026-11-18)

Executada no worktree `C:\Users\Gamer\Desktop\pos graduacao\PROJETOS\spec-015`, branch `spec/015`,
sem ler, exibir ou versionar `.env`. O banco de validação ficou isolado em `127.0.0.1:55433`.

| Comando                           | Resultado                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `bun run db:migrate`              | ok — 4 migrações aplicadas; rerun final: "nenhuma migração pendente"                |
| `bun run db:test`                 | ok — 4 arquivos (`001`, `002`, `003`, `004_knowledge_media.test.sql`)               |
| `bun run lint`                    | ok — todos os pacotes                                                               |
| `bun run types:check`             | ok — todos os pacotes                                                               |
| `bun run test`                    | ok — API 67 arquivos / 442 testes; web 12 arquivos / 142 testes                     |
| `bun run build`                   | ok — `api` + `web`, 10,83 s                                                         |
| Playwright (146 testes, 1 worker) | ok — 146/146 aprovados em 4,6 min, com portas isoladas 3015 (web) e 3435 (fake API) |

A suíte E2E completa foi executada com o mesmo Playwright, os mesmos 146 cenários e o mesmo código
do gate `bun run test:e2e`, mas com portas isoladas porque outras worktrees (`spec/014`, `spec/016`)
usavam simultaneamente as portas padrão 3000/3434. O comando equivalente executado foi:

```text
bun x playwright test --config=playwright.isolated.config.ts --workers=1
```

O arquivo de configuração isolado e a cópia temporária dos cenários foram removidos após a execução;
nenhum arquivo de `playwright.config.ts`, da 014 ou das specs 016–018 foi alterado.

Tentativas anteriores de `bun run test:e2e` nas portas padrão foram invalidadas por
`reuseExistingServer` ao reaproveitar servidores `next dev`/fake API de outras worktrees em
execução concorrente, produzindo `ERR_CONNECTION_REFUSED` e timeouts sem relação com a fatia 015.
A execução isolada acima cobre integralmente os 10 cenários de mídia e a regressão da 013,
incluindo os seletores e rótulos preservados (`knowledge-source-files`, "Add files", mensagens
padrão e ordem de tabulação).

Cobertura E2E da fatia 015:

- flag desligada esconde Image/Audio/Video; ligada por cookie expõe os controles;
- PNG, MP3 e MP4 passam por `processing` até `ready` e são indexados;
- reenvio idêntico informa "Already connected" sem duplicar;
- formato não suportado lista todos os formatos aceitos;
- áudio sem fala falha com "No speech detected" e oferece "Try again";
- isolamento por usuário autenticado, navegação por teclado e 360/768/1280 px sem rolagem horizontal.

Commit local principal: `3d29102 feat: connect image, audio and video as knowledge sources`
(sem push, merge ou alterações na branch principal).

---

## 14. Evidências de integração 014 + 015 (2026-11-18)

Merges na principal: `b16f183` (014), `b9b4d89` (015) e `02e8320` (correção de contratos após o
merge). Os 11 conflitos entre 014 e 015 eram aditivos e foram combinados: tipo de arquivo com
`displayName` e `durationSeconds`, INSERT de versão com 11 parâmetros, mapeamento de erros URL e
mídia, DI com fetcher HTTP e extrator local, rótulos `TYPE_LABELS` e campos da fake API.

| Comando               | Resultado                                                       |
| --------------------- | --------------------------------------------------------------- |
| `bun run lint`        | ok — 3 tarefas                                                  |
| `bun run types:check` | ok — 3 tarefas, após `02e8320`                                  |
| `bun run test`        | ok — API 69 arquivos / 463 testes; web 12 arquivos / 152 testes |
| `bun run build`       | ok — `api` + `web`                                              |
| `bun run test:e2e`    | ok — 157/157 testes em 5,5 min, portas padrão 3000/3434         |
| `bun run db:migrate`  | bloqueado — Docker indisponível; `ECONNREFUSED 127.0.0.1:5433`  |

As migrações `0001`–`0004` e seus testes SQL foram validados no worktree da 015 com banco isolado
(§13). A validação real na principal segue como follow-up assim que o Docker estiver disponível.
Nenhuma chave, token, URL sensível, hash ou conteúdo de arquivo foi registrado em logs ou docs.

## 15. Evidências da spec 016 (2026-11-18)

Executadas na raiz do monorepo, na branch `spec/016`:

| Comando               | Resultado                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| `bun run db:migrate`  | ok — 5 migrações aplicadas; `0005_rag_citations.sql` confirmada            |
| `bun run db:test`     | ok — 4 arquivos SQL passaram                                               |
| `bun run lint`        | ok — 3 tarefas Turbo                                                       |
| `bun run types:check` | ok — 3 tarefas Turbo                                                       |
| `bun run test`        | ok — API: 69 arquivos / 441 testes; web: 12 arquivos / 141 testes          |
| `bun run build`       | ok — 2 tarefas Turbo; Next.js compilado                                    |
| `bun run test:e2e`    | ok — 142 testes aprovados em ~3,3 min, incluindo os 6 cenários de citações |

Cobertura adicional da fatia 016:

- Unitários API: dedupe/ordenação/limiar, prompt com trechos como dados não confiáveis,
  sanitização de `[n]`, `no_match`, `unavailable`, isolamento por usuário, flag desligada e
  persistência de citações/metadados.
- Integração HTTP: citações e metadados na resposta, recálculo de `isStale` ao reler o histórico,
  degradação do vetorial e fallback sem correspondência.
- Adaptadores: consulta GraphQL com filtro `userId`, validação de payload e timeout local;
  metadados de fonte via SQL parametrizado, sem conteúdo ou caminho absoluto.
- Web/E2E: painel com nome/tipo/localização/trecho, fechamento com `Esc`, sobrevivência após
  reload, fonte antiga, fonte removida, sem correspondência, retry e prompt sem fontes.
- `RAG_CITATIONS_ENABLED` permanece `false` em `.env.example`; nenhuma chave, token, prompt,
  trecho ou valor de `.env` foi lido, exibido ou registrado. A API fake do E2E usa prefixos
  determinísticos e não depende de OpenAI, Weaviate, PostgreSQL ou credenciais reais.

QA manual equivalente (executado via Playwright/HTTP determinístico, ambiente Chromium
headless-shell):

| Cenário                     | Ação/esperado                                                                                          | Resultado |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| Citação válida              | Enviar `cite:` → abrir `[1]` → painel mostra nome, `txt · Page 7`, trecho exato → `Esc` fecha o painel | ok        |
| Persistência e fonte antiga | Enviar `stale:` → "Outdated source" → recarregar → aviso e citação permanecem                          | ok        |
| Fonte removida              | Enviar `removed:` → botão desabilitado e "Source removed" → recarregar → estado permanece              | ok        |
| Sem correspondência         | Enviar `nomatch:` → mensagem sem base e nenhum botão de fonte                                          | ok        |
| Vetorial indisponível       | Enviar `vector-down:` → aviso acionável → "Retry search" reapresenta o prompt                          | ok        |
| Regressão fatia 012         | Prompt comum → resposta padrão sem bloco de fontes                                                     | ok        |
| Falha do modelo             | Responder sem chave/erro → `503 MODEL_UNAVAILABLE`, sem detalhe técnico e sem escrita parcial          | ok        |

Pendências de qualidade que permanecem como follow-up (fora desta fatia): avaliação humana da
precisão das citações e medição de p95 em ambiente com OpenAI/Weaviate reais; o flag de rollout
deve ser habilitado em produção somente após essa avaliação.

---

## 16. Evidências de integração da onda 2 (2026-11-18)

Merges na principal: `b16f183` (014), `b9b4d89` (015), `02e8320` (correção de contratos),
`c561cb8` (registro de QA) e `eee1cd5` (016). A migration da 016 foi renomeada para
`0005_rag_citations.sql` e seu teste para `005_rag_citations.test.sql` para não colidir com
`0004_knowledge_media.sql` da 015; nomes antigos não chegaram a ser aplicados em banco compartilhado.

| Comando               | Resultado                                                       |
| --------------------- | --------------------------------------------------------------- |
| `bun run lint`        | ok — 3 tarefas                                                  |
| `bun run types:check` | ok — 3 tarefas                                                  |
| `bun run test`        | ok — API 74 arquivos / 483 testes; web 12 arquivos / 156 testes |
| `bun run build`       | ok — `api` + `web`                                              |
| `bun run test:e2e`    | ok — 163/163 testes em 4,1 min, portas padrão 3000/3434         |
| `bun run db:migrate`  | bloqueado — Docker fora e 5432 recusou as credenciais do `.env` |

As migrações `0001`–`0005` e seus testes SQL foram validados nos worktrees da 015 e da 016 com
bancos isolados (§13 e §15). A validação real na principal segue como follow-up quando o Docker
estiver disponível. Nenhuma chave, token, URL sensível, prompt, trecho, hash ou conteúdo de arquivo
foi registrado em logs ou documentação.

---

## 17. Evidências de integração da spec 018 (2026-11-18)

Merge `ae91965` na principal, a partir do commit `5e2ad77` da branch `spec/018`. Sem conflitos.
A slice `observability` é local-first: flag desligada por padrão, coletor fake/no-op, emissão
assíncrona que nunca quebra chat/RAG, pseudonimização HMAC e sanitização recursiva de PII. Nenhuma
migração e nenhuma dependência nova.

| Comando               | Resultado                                                       |
| --------------------- | --------------------------------------------------------------- |
| `bun run lint`        | ok — 3 tarefas                                                  |
| `bun run types:check` | ok — 3 tarefas                                                  |
| `bun run test`        | ok — API 87 arquivos / 593 testes; web 12 arquivos / 156 testes |
| `bun run build`       | ok — `api` + `web`                                              |
| `bun run obs:eval`    | ok — 4/4 datasets, limiar 0,8                                   |
| `bun run test:e2e`    | ok — 163/163 testes em 6,0 min, portas padrão 3000/3434         |

Não validado: Studio, traces ao vivo e evaluation contra LangSmith real, bind de rede do override
e alertas do painel. Motivo: daemon Docker indisponível e imagem self-hosted do LangSmith é
Enterprise/licenciada; o compose opcional exige `LANGSMITH_IMAGE` e `LANGSMITH_API_KEY` externos.
Critérios correspondentes permanecem marcados como não validados na spec/plan da 018.

---

## 18. Evidências da fatia 018 — observabilidade local (worktree `spec/018`)

Executado em 2026-11-18 na worktree isolada, com PATH explícito para Bun/Node. Nenhuma migration
foi adicionada: traces não são persistidos em PostgreSQL.

| Comando                                                                                                                            | Resultado                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `bun run lint`                                                                                                                     | ok — 3 tarefas                                                                |
| `bun run types:check`                                                                                                              | ok — 3 tarefas                                                                |
| `bun run test`                                                                                                                     | ok — API 87 arquivos / 593 testes; web em cache                               |
| `bunx vitest run src/modules/observability/domain/evaluation.spec.ts src/modules/observability/application/evaluation-cli.spec.ts` | ok — 2 arquivos / 29 testes                                                   |
| `bun run build`                                                                                                                    | ok — `api` + `web`                                                            |
| `bun run obs:eval`                                                                                                                 | ok — 4/4 datasets aprovados, exit code 0                                      |
| `bun run test:e2e` (web, portas isoladas 3018/3438)                                                                                | ok — 163/163 testes em 4,8 min                                                |
| `bun run db:migrate`                                                                                                               | bloqueado — `connect ECONNREFUSED 127.0.0.1:5433` (sem Postgres local)        |
| `bun run db:test`                                                                                                                  | bloqueado — `connect ECONNREFUSED 127.0.0.1:5433`                             |
| Stack LangSmith self-hosted / Studio / evaluation ao vivo                                                                          | bloqueado — daemon Docker indisponível e imagem Enterprise licenciada ausente |

Detalhes do bloqueio externo:

- `docker info` e `docker version` não responderam; o caminho alternativo `.exe` não foi
  reconhecido como comando. Sem daemon não há como subir o self-hosted, o Studio nem validar a
  ingestão de spans pelo coletor real.
- A imagem self-hosted do LangSmith é Enterprise/licenciada. `docker-compose.langsmith.yml` foi
  entregue como template opcional (profile `langsmith`) que exige `LANGSMITH_IMAGE` e
  `LANGSMITH_API_KEY` fornecidos externamente; nenhuma tag inventada foi usada como default.
- Em vez de configuração "validada" fictícia, a fatia entrega sinks e evaluation testados contra
  coletor local fake, com degradação graciosa e erro explícito para endpoints cloud.

Para permitir E2E isolado por worktree, as portas do Playwright passaram a ser configuráveis por
`E2E_WEB_PORT`/`E2E_FAKE_API_PORT` (defaults 3000/3434). Nesta execução foram usadas 3018/3438;
os defaults e os fluxos 012–016 permanecem intactos.

Nenhum valor de `.env`, chave, token, URL sensível, hash, prompt, resposta ou conteúdo de arquivo
foi registrado em logs, relatórios ou documentação.

## 19. Evidências da spec 017 (2026-11-18)

Executadas no worktree isolado `spec-017`, branch `spec/017`, sem merge/push e sem alterar as
specs/worktrees de 014–018.

| Comando                                                         | Resultado                                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `bun run db:migrate`                                            | bloqueado — Postgres/Docker indisponível (`ECONNREFUSED 127.0.0.1:5433`)          |
| `bun run db:test`                                               | bloqueado — mesma causa; nenhuma validação SQL foi inventada                      |
| `bun run lint`                                                  | ok — 3 tarefas Turbo                                                              |
| `bun run types:check`                                           | ok — 3 tarefas Turbo                                                              |
| `bun run test`                                                  | ok — API: 78 arquivos / 517 testes; web: 13 arquivos / 156 testes                 |
| `bun run build`                                                 | ok — `api` + `web`; rota `/app/media/[mediaId]/content` compilada                 |
| `bunx playwright test --config=playwright.multimedia.config.ts` | ok — 5/5 cenários da spec 017 em 46,4 s, portas isoladas 3017 (web) e 3437 (fake) |

Cobertura adicional da fatia 017:

- API: detecção de intenção, limites, cota por usuário, cancelamento com devolução de cota, retry
  até 3 tentativas, jobs órfãos, download isolado, citação anexada, env e adapters OpenAI/Gemini
  contra servidor HTTP local. Integração cobre flag on/off e ciclo `queued → ready`.
- Web: flag por env/cookie, ações de status/cancel/retry, componente com polling, preview,
  metadados, `aria-live`, Try again/Cancel e proxy autenticado de download com headers seguros.
- E2E determinístico: geração de imagem com preview e download autenticado, pedido ambíguo sem
  job, cancelamento sem download, retry de falha e isolamento entre contas. A API fake usa bytes
  locais e transições controladas; nenhuma chamada paga foi feita.
- A suíte E2E padrão não foi reexecutada nas portas 3000/3434 para não colidir com worktrees
  paralelos; a regressão é coberta pelos gates unitários/integração e pela evidência da spec 016.
- O arquivo temporário `apps/web/playwright.multimedia.config.ts` foi removido após a execução.
- Billing/API Google e a chamada real de vídeo não foram validados; são follow-up de rollout.
  Nenhuma chave, token, URL sensível, prompt, trecho, hash, bytes ou valor de `.env` foi lido,
  exibido ou registrado.

---

## 20. Evidências finais do range 012–018 (2026-11-18)

Merge de fechamento `4f74265` na principal, combinando 017 e 018. Conflitos resolvidos sem
descartar funcionalidade: emissão de traces e geração de mídia coexistem no `SendMessageUseCase`;
`ConversationsModule` importa `MediaModule` e `ObservabilityModule`; `env.ts` mantém os dois
blocos de configuração; as seções de evidências foram renumeradas. A suíte E2E da 017 passou a
usar `WEB_URL`/`FAKE_API_URL` de `apps/web/e2e/support/ports.ts` em vez das portas fixas
3017/3437 do worktree.

| Comando               | Resultado                                                       |
| --------------------- | --------------------------------------------------------------- |
| `bun run lint`        | ok — 3 tarefas                                                  |
| `bun run types:check` | ok — 3 tarefas                                                  |
| `bun run test`        | ok — API 91 arquivos / 627 testes; web 13 arquivos / 156 testes |
| `bun run build`       | ok — `api` + `web`                                              |
| `bun run obs:eval`    | ok — 4/4 datasets                                               |
| `bun run test:e2e`    | ok — 168/168 testes em 5,0 min, portas padrão 3000/3434         |
| `bun run db:migrate`  | bloqueado — Docker fora; 5432 recusou as credenciais do `.env`  |

As migrações `0001`–`0006` e seus testes SQL foram validados nos worktrees com bancos isolados.
Não foram registrados chaves, tokens, URLs sensíveis, prompts, respostas, hashes, trechos ou bytes
de arquivo em logs, relatórios ou documentação.

---

## 21. Índice navegável spec → plano → evidência

Todas as specs `000`–`018` têm `Status: done`. As seções `11`–`20` registram as evidências
datadas de `013`–`018`; para `000`–`012`, a evidência está no próprio plano (quando registrada) e
no histórico de commits da spec.

| Spec                                                   | Plano                                                                                                                                   | Evidência de QA / observação                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `000-foundation`                                       | [plano](../.plans/000-foundation-plan.md)                                                                                               | §11 "Resultado da execução" do plano                                                                 |
| `001-auth-schema` … `003-auth-routes`                  | [001](../.plans/001-auth-schema-plan.md), [002](../.plans/002-auth-session-plan.md), [003](../.plans/003-auth-routes-plan.md)           | QA manual nos planos; breakdown em [`.plans/001-auth-breakdown.md`](../.plans/001-auth-breakdown.md) |
| `004-auth-sign-up` … `006-auth-sign-in`                | [004](../.plans/004-auth-sign-up-plan.md), [005](../.plans/005-auth-confirm-account-plan.md), [006](../.plans/006-auth-sign-in-plan.md) | Orquestração [002–008](../.plans/002-008-orchestration.md)                                           |
| `007-auth-forgot-password` … `008-auth-reset-password` | [007](../.plans/007-auth-forgot-password-plan.md), [008](../.plans/008-auth-reset-password-plan.md)                                     | QA manual 2026-11-10 no plano 007; orquestração 002–008                                              |
| `009-postgres-nativo`                                  | [plano](../.plans/009-postgres-nativo-plan.md)                                                                                          | §11 "Resultados do QA (2026-11-12)" do plano                                                         |
| `010-email-provider-by-node-env`                       | [plano](../.plans/010-email-provider-by-node-env-plan.md)                                                                               | "Gates automatizados" no plano                                                                       |
| `011-ui-redesign`                                      | [plano](../.plans/011-ui-redesign-plan.md)                                                                                              | Evidências de UI no plano; direção visual em [DESIGN.md](./DESIGN.md)                                |
| `012-expert-chat`                                      | [plano](../.plans/012-expert-chat-plan.md)                                                                                              | §9 "Histórico" do plano; [breakdown 012–018](../.plans/012-expert-platform-breakdown.md)             |
| `013-knowledge-files`                                  | [plano](../.plans/013-knowledge-files-plan.md)                                                                                          | §11 desta seção                                                                                      |
| `014-knowledge-url`                                    | [plano](../.plans/014-knowledge-url-plan.md)                                                                                            | §12 e §14                                                                                            |
| `015-knowledge-media`                                  | [plano](../.plans/015-knowledge-media-plan.md)                                                                                          | §13 e §14                                                                                            |
| `016-rag-citations`                                    | [plano](../.plans/016-rag-citations-plan.md)                                                                                            | §15 e §16                                                                                            |
| `017-multimedia-deliverables`                          | [plano](../.plans/017-multimedia-deliverables-plan.md)                                                                                  | §19 e §20                                                                                            |
| `018-langsmith-local`                                  | [plano](../.plans/018-langsmith-local-plan.md)                                                                                          | §17, §18 e §20; detalhes em [OBSERVABILITY.md](./OBSERVABILITY.md)                                   |

Para revisar ou reabrir uma spec, use `refine-spec` e registre a divergência na spec e neste índice.

---

## 22. Evidências de testes e cobertura — revisão do Módulo 4 (2026-11-18)

Esta seção responde ao ponto da avaliação que pediu **procedimentos, resultados de sucesso/falha e
cobertura** documentados. Ela consolida o que foi executado novamente nesta rodada; as seções
`11`–`20` continuam como histórico datado de cada spec.

### 22.1 Execução registrada

| Item            | Valor                                                            |
| --------------- | ---------------------------------------------------------------- |
| Comando         | `bun run test` (raiz do monorepo, via Turbo)                     |
| Data            | 2026-11-18 (início da suíte web às 15:55:52, hora local)         |
| Ambiente        | Bun 1.4.4 em Windows; sem Docker, PostgreSQL ou LGTM em execução |
| Código de saída | `0`                                                              |
| Turbo           | `2 successful, 2 total` · `0 cached, 2 total` · `46.804s`        |

| Suíte                     | Arquivos | Testes  | Duração | Resultado |
| ------------------------- | -------- | ------- | ------- | --------- |
| API — `apps/api` (Vitest) | 91       | 627     | 42,27 s | ok        |
| Web — `apps/web` (Vitest) | 13       | 156     | 3,37 s  | ok        |
| **Total**                 | **104**  | **783** | —       | ok        |

A suíte de IA/evaluation também foi reexecutada: `bun run obs:eval` → código `0`,
`Summary: 4/4 datasets passed` (`citation_fidelity`, `answer_quality`, `media_intent`, `no_answer`,
todos com `overall: 0.800 PASS`). É uma avaliação determinística offline, **não** métrica de
cobertura de código.

### 22.2 Reprodução

```sh
bun run test                                              # todas as suítes unitárias/de integração
bun run test -- --reporter=verbose                        # saída nominal por arquivo
bunx turbo test --filter=api --only -- --reporter=verbose # apenas API
bunx turbo test --filter=web --only -- --reporter=verbose # apenas web
bun run obs:eval                                          # evaluation offline de IA
bun run test:e2e                                          # Playwright (API fake + Next dev)
```

Use sempre `bun run <script>`: `bun test` é o runner nativo do Bun e não executa os scripts do
monorepo. A suíte API usa `apps/api/src/test/setup-env.ts` e fakes em `apps/api/src/test/fakes/`;
ela não depende de banco real nem de chaves de produção.

### 22.3 Sucesso, falha e erros esperados

- **Falhas de teste nesta execução:** nenhuma. Nenhum arquivo ou caso foi reportado como
  `failed`; os dois processos terminaram com código `0`.
- **Caminhos de erro exercitados com sucesso:** a saída contém linhas `warn`/`error` intencionais
  dos testes de integração, por exemplo `HTTP request completed` com `401`, `429`, `503`,
  `E-mail de confirmação não foi enviado`, `rag` com `outcome:"unavailable"` e `knowledge.sources`
  com `error:"NO_SPEECH_DETECTED"` / `"SOURCE_VECTOR_STORE_UNAVAILABLE"`. São **cenários
  simulados que passaram**, não testes quebrados nem incidentes reais.
- **E2E:** não foi reexecutado nesta rodada. A última evidência registrada é §20 —
  `bun run test:e2e` ok, `168/168`. Para reproduzir, use `bun run test:e2e`; o Playwright sobe a
  API fake em `127.0.0.1:3434` e o web em `3000` (portas configuráveis por
  `E2E_WEB_PORT`/`E2E_FAKE_API_PORT`). Atenção a `reuseExistingServer`: servidores antigos podem
  gerar falsos negativos (ver §13).
- **Bloqueios conhecidos:** `bun run db:test`/`db:migrate` exigem PostgreSQL local (§§11–20);
  não há `.github/workflows`, portanto toda evidência é manual/local. `packages/ui` não tem
  Vitest/Testing Library e fica fora das contagens acima.

### 22.4 Cobertura de código — situação real e pendência

🧭 **Ainda não há cobertura mensurada.** Não existe `@vitest/coverage-v8` nem
`@vitest/coverage-istanbul` declarado ou instalado em nenhum workspace; no `bun.lock` eles aparecem
apenas como _peerDependencies_ opcionais do `vitest@5.1.0`, o que não habilita o recurso. Nenhum
`vitest.config.mts` define `test.coverage`, provider, reporter ou limiares.

Tentativa executada nesta rodada:

| Comando                                             | Resultado                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bunx turbo test --filter=web --only -- --coverage` | falhou (código `1`): `MISSING DEPENDENCY — Cannot find dependency '@vitest/coverage-v8'` |

Portanto **nenhum percentual de cobertura é afirmado** neste documento. Para habilitar a medição:

1. adicionar `@vitest/coverage-v8@5.1.0` como devDependency em `apps/api` e `apps/web`
   (compatível com o Vitest 5.1.0 já usado);
2. configurar `test.coverage` nos dois `vitest.config.mts` com `provider: "v8"`, reporters
   (`text`, `html`, `lcov`) e limiares revisados — o plano `000` registrou apenas "sem meta
   numérica de cobertura nesta entrega";
3. declarar `coverage/**` em `turbo.json` (`outputs` da tarefa `test` hoje é `[]`) se o relatório
   precisar ser preservado em cache;
4. executar `bun run test -- --coverage --force` e registrar aqui os percentuais **medidos**.
   O diretório gerado não deve ser versionado; registre apenas o resumo.

A pendência acima é deliberada: instalar dependência ou inventar um número sem medição violaria as
regras do projeto. O histórico de "cobertura adicional da fatia" nas seções `11`–`20` refere-se a
**cenários funcionais**, não a cobertura de código.

### 22.5 Evidência visual de observabilidade

A demonstração estrutural do dashboard está em
[`observability/dashboard-preview.svg`](../observability/dashboard-preview.svg), gerada por
`bun observability/gen-dashboard-preview.mjs` a partir do JSON versionado. Ela mostra 10 rows,
51 visualizações e 64 queries — representação da estrutura, **não dados de produção**. O inventário
detalhado e o diagnóstico de erros estão em
[OBSERVABILITY.md §10](./OBSERVABILITY.md#10-evidência-demonstrativa-e-diagnóstico-de-erros).
