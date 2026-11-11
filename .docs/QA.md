# QA.md — Qualidade e verificação

> **Status:** ativo · **Atualizado em:** 2026-11-10
> **Use antes de declarar qualquer tarefa concluída.**

Este documento é a fonte de verdade sobre **como verificar** mudanças. Se um comando citado
aqui não existir no `package.json`, ele está marcado como 🧭 planejado.

---

## 1. Pré-requisitos

| Requisito               | Versão                              |
| ----------------------- | ----------------------------------- |
| Node.js                 | >= 24                               |
| Bun                     | 1.4.4                               |
| Docker Desktop          | em execução (Supabase e LGTM)       |
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
| `bun run infra:up`    | Sobe LGTM (Compose) e Supabase local                         |
| `bun run infra:down`  | Para Supabase e LGTM (idempotente)                           |
| `bun run db:migrate`  | Aplica migrações pendentes no Supabase local                 |
| `bun run db:test`     | Executa os testes pgTAP de `supabase/tests/` no banco local  |

> `bun run db:test` exige o Supabase local ativo (`bun run infra:up`) e as migrações aplicadas
> (`bun run db:migrate`). Ele usa `supabase test db`, que roda cada arquivo de `supabase/tests/`
> com pgTAP em uma transação com `rollback`.

> Use sempre `bun run <script>`. `bun build` e `bun test` são comandos nativos do Bun e **não**
> executam os scripts do `package.json`.

> A API exige `JWT_SECRET` com no mínimo 32 caracteres no boot (veja `.env.example`); sem ele, a
> API não inicia. Os testes não dependem do `.env`: `apps/api/src/test/setup-env.ts` define as
> variáveis mínimas (incluindo `JWT_SECRET`, `SESSION_TTL_SECONDS`,
> `CONFIRMATION_TOKEN_TTL_SECONDS`, `RESET_TOKEN_TTL_SECONDS` e as dos rate limits de sign-up,
> sign-in, forgot-password e reset-password).
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
> a senha é validada antes do token, como na API real. Não deixe um
> `bun run dev` antigo ocupando a porta 3000 antes do E2E, pois o Playwright reutiliza o servidor
> existente em modo local.

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
- [ ] `bun run db:migrate` aplica a migração e `bun run db:test` passa com os testes pgTAP.

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

- [ ] `bun run infra:up` sobe LGTM e Supabase e o Grafana responde em `http://localhost:3010`.
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
- [ ] Logs do Mailtrap (`https://mailtrap.io/sending/email_logs`): e-mails "Confirm your account" e "New session on your account" inspecionados
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
      ou para o `returnTo` seguro e e-mail "New session on your account" no Mailtrap.
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
      revogadas e e-mail "Your password has been changed" en-US nos logs do Mailtrap
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

| Lacuna                                      | Impacto                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Nenhum CI                                   | Verificação depende do ambiente local                                                                                                |
| Commitlint apenas local                     | Como não há CI, mensagens só são validadas pelo hook `commit-msg`                                                                    |
| Produto não implementado                    | Apenas a rota de hello world e a fundação existem                                                                                    |
| Sem Vitest/Testing Library no pacote `ui`   | Componentes compartilhados não têm testes unitários                                                                                  |
| Supabase Analytics desabilitado             | `vector` exige Docker API em `2375`; a telemetria da app usa o LGTM                                                                  |
| PostgreSQL local em `15`                    | Workaround de ambiente; alinhar com a versão alvo antes de produção                                                                  |
| OXLint/OXFmt não adotados                   | ESLint + Prettier seguem como padrão nesta entrega                                                                                   |
| Skills locais em `.agents/` não versionadas | A edição de `implement-me`/`breakdown-specs`/`create-spec`/`refine-spec` fica restrita à máquina; a política durável está em `.docs` |
| Rate limit em memória                       | Limites de sign-up e confirmação são locais ao processo; store compartilhado é follow-up                                             |
| Sem refresh de sessão                       | Sign-out implementado em `POST /api/v1/auth/sign-out`; a sessão ainda só é renovada por novo sign-in                                 |
| Sessão única sem atomicidade no banco       | A garantia é da aplicação (create-then-revoke); RPC transacional é follow-up do ADR 0013                                             |

Ao resolver uma lacuna, atualize esta tabela e o documento relacionado.
