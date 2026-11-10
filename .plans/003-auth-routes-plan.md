# Plano — Auth routes

> Spec: `.specs/003-auth-routes.md`
> Status: done
> Atualizado em: 2026-11-09

## 1. Contexto

As fatias 001 e 002 entregaram o schema de auth, a sessão JWT + server-side, o cookie
`HttpOnly` com ponte `Bearer` no web e `GET /api/v1/auth/me`. O web ainda expõe uma página de
demonstração em `/` e não tem grupos de rota, layouts nem guard. Esta fatia cria o esqueleto de
navegação do épico: `/auth/*` público com layout próprio, `/app/*` privado com shell, guard,
redirecionamentos, CORS restrito e convenção en-US documentada. As telas reais chegam nas fatias
004 a 008.

## 2. Objetivo e critérios de aceite

Mapeamento dos critérios de aceite da spec:

| Critério de aceite                                                                                                   | Verificação                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Placeholders públicos de sign-up, sign-in, confirm, forgot e reset carregam no layout de auth em en-US               | E2E `routing.spec.ts` + `route-rules.spec.ts` + inspeção manual  |
| `/app` e `/app/*` sem sessão redirecionam para `/auth/sign-up`                                                       | E2E (sem cookie e com cookie inválido) + unit de `route-rules`   |
| Sessão válida em `/app` e `/app/*` carrega o shell e a home placeholder                                              | E2E com sessão válida (API fake do E2E)                          |
| Sessão válida em `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` redireciona para `/app`; forgot/reset acessíveis | E2E + unit de `shouldRedirectFromAuthPath`                       |
| `/` redireciona para `/app` com sessão e para `/auth/sign-up` sem sessão                                             | E2E + unit de `getRootRedirectPath`                              |
| API: hello em `/api/v1/hello`, `GET /` 404, auth em `/api/v1/auth/*`, CORS com origem/métodos/headers do fluxo       | Integração (Supertest) + unit de `isAllowedCorsOrigin`           |
| Convenção en-US em RULES/DESIGN/DEVELOPMENT/ARCHITECTURE, UI light-only, acessível e responsiva                      | Revisão de docs + E2E de `lang`, teclado, foco e 360/768/1280 px |

## 3. Escopo

### Dentro

- Grupo público `/auth/*` com layout compartilhado light-only e acessível.
- Placeholders en-US para `sign-up`, `sign-in`, `confirm`, `forgot-password` e `reset-password`.
- Grupo privado `/app/*` com shell, navegação básica e home placeholder en-US.
- Guard server-side em `/app/*` usando `GET /api/v1/auth/me`; sem sessão → `/auth/sign-up`.
- Redirecionamento de pessoa autenticada em `sign-up`, `sign-in` e `confirm`.
- Raiz `/` redirecionando conforme a sessão.
- 404 dentro do layout público e do shell privado para segmentos inexistentes.
- CORS da API com `GET`, `HEAD`, `POST`, `OPTIONS` e headers `Authorization`/`Content-Type`.
- Documentação da convenção en-US e da separação `/auth/*` vs `/app/*`.
- Testes unitários (web e api), integração (api) e E2E atualizado.
- `.env.example` e README alinhados com a navegação/idioma.

### Fora

- Formulários e endpoints reais de sign-up, confirmação, sign-in, forgot/reset (004–008).
- Sign-out, refresh token, MFA, SSO, login social e “remember me”.
- Criação de sessão, JWT, cookie e `/api/v1/auth/me` (já entregues na 002).
- Conteúdo/envio de e-mails e templates das fatias 004–008.
- i18n com seletor de locale e tradução de telas fora de auth e `/app`.
- Deploy e CI.

## 4. Abordagem técnica

### Web (Next.js App Router)

- Rotas literais `app/auth/**` e `app/app/**` (o URL é `/auth/*` e `/app/*`), cada grupo com
  `layout.tsx` próprio.
- A validação de sessão fica em `apps/web/lib/auth`:
  - `route-rules.ts` — regras puras de redirecionamento (`/` e `/auth/*`) e constante única do
    destino de `/app/*` sem sessão, trocada para `/auth/sign-in` na fatia 006.
  - `session.ts` — `getSessionUser()` chama `GET /api/v1/auth/me` com o cookie via
    `fetchApiWithSession`, valida o shape da resposta e falha fechado (erro/401 → `null`).
  - `guards.ts` — `requireSessionUser()` (layout de `/app`) e `redirectSignedInUserToApp()`
    (páginas de sign-up, sign-in e confirm).
- `/app/layout.tsx` aplica o guard, renderiza o shell (header/nav/main/footer) e o 404 privado.
- `/auth/layout.tsx` renderiza o layout público; páginas chamam o redirecionamento quando
  aplicável. `app/auth/not-found.tsx` e `app/app/not-found.tsx` cobrem 404 no layout correto.
- Catch-all `app/auth/[...rest]/page.tsx` e `app/app/[...rest]/page.tsx` chamam `notFound()`
  para que rotas inexistentes usem o layout do grupo.
- Todo texto visível é en-US; `html lang="en-US"`; tokens do design system, sem `dark:`.

### Sessão no guard

- O guard é UX: lê o cookie no servidor e pergunta à API se a sessão está ativa.
- Sem cookie → não chama a API. Cookie presente e API 401/erro → ausência de sessão.
- Nunca renderiza token, JWT ou dados de sessão no HTML/JS.

### API (CORS)

- Extrair a allowlist para `modules/shared/config/cors.ts` (origem, métodos e headers), usada por
  `app-setup.ts`; testes unitários da allowlist e integração do preflight.
- Namespace `/api/v1`, hello e 404 fora do prefixo já existentes desde a 002; sem mudança de
  comportamento além do CORS.

### E2E (Playwright)

- A validação de sessão é server-side, então o E2E não consegue interceptar com `page.route`.
  O Playwright sobe uma **API fake** local (somente test infra) em porta dedicada e aponta
  `API_BASE_URL` do web para ela. Tokens determinísticos:
  - `valid-session-token` → `200 { user }` em `/api/v1/auth/me`;
  - qualquer outro → `401` do contrato.
- Assim os cenários de sessão válida, inválida/expirada, redirecionamentos e 404 são
  determinísticos e não dependem do banco compartilhado nem de credenciais.
- Testes cobrem: redirecionamentos, placeholders, 404 por layout, `lang`, light-only, foco de
  teclado e ausência de rolagem horizontal em 360/768/1280 px.

## 5. Arquivos e áreas afetadas

Criados (web):

- `apps/web/lib/auth/route-rules.ts` (+ spec), `session.ts` (+ spec), `guards.ts`
- `apps/web/app/auth/layout.tsx`, `apps/web/app/auth/_components/auth-card.tsx`
- `apps/web/app/auth/{sign-up,sign-in,confirm,forgot-password,reset-password}/page.tsx`
- `apps/web/app/auth/not-found.tsx`, `apps/web/app/auth/[...rest]/page.tsx`
- `apps/web/app/app/layout.tsx`, `apps/web/app/app/page.tsx`, `apps/web/app/app/not-found.tsx`,
  `apps/web/app/app/[...rest]/page.tsx`
- `apps/web/app/_components/not-found-content.tsx`
- `apps/web/e2e/routing.spec.ts`, `apps/web/e2e/support/fake-api-server.ts`

Criados (api):

- `apps/api/src/modules/shared/config/cors.ts` (+ spec)

Alterados:

- `apps/web/app/page.tsx` (redirecionamento), `apps/web/app/layout.tsx` (lang/metadata en-US)
- `apps/web/e2e/home.spec.ts` (removido; coberto por `routing.spec.ts`)
- `apps/web/playwright.config.ts` (webServer da API fake + `API_BASE_URL`)
- `apps/web/package.json` (script `e2e:fake-api`)
- `apps/api/src/app-setup.ts` (CORS methods/headers) e `hello.integration.spec.ts` (preflight)
- `.docs/RULES.md`, `.docs/DESIGN.md`, `.docs/DEVELOPMENT.md`, `.docs/ARCHITECTURE.md`,
  `.docs/QA.md`, `.docs/AGENTS.md` (convenção en-US e grupos de rota)
- `.env.example`, `README.md` (API_BASE_URL/navegação)
- `.specs/003-auth-routes.md` (status) e este plano

## 6. Passos de implementação

- [x] Passo 1 — Regras puras de redirecionamento no web + testes.
- [x] Passo 2 — Leitura/validação de sessão no web (`getSessionUser`) + testes.
- [x] Passo 3 — Guard do `/app` e layout público, com helpers server-side.
- [x] Passo 4 — Placeholders en-US, layouts acessíveis/light-only e 404 por grupo.
- [x] Passo 5 — Raiz `/` e metadados/idioma do layout raiz.
- [x] Passo 6 — CORS da API (allowlist, métodos e headers) + testes unitário/integração.
- [x] Passo 7 — E2E: API fake, configuração do Playwright e cenários de navegação.
- [x] Passo 8 — Documentação en-US/rotas, `.env.example` e README.
- [x] Passo 9 — QA completo (`lint`, `types:check`, `test`, `build`, `test:e2e`, `db:migrate`) e
      QA manual.
- [x] Passo 10 — Status `done` na spec/plano e commit local na branch `spec/003`.

## 7. Riscos e mitigação

| Risco                                                      | Mitigação                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Guard divergir da API e liberar `/app`                     | O guard pergunta `/api/v1/auth/me`; a API continua validando toda chamada protegida                   |
| API indisponível derrubar todas as páginas                 | Falha fechado: erro/timeout no `/me` trata como ausência de sessão e redireciona para `/auth/sign-up` |
| E2E depender do banco/API reais e de segredo compartilhado | API fake dedicada no Playwright com tokens determinísticos; nenhum dado no banco compartilhado        |
| Destino do `/app/*` mudar na fatia 006                     | Constante única `SIGNED_OUT_REDIRECT_PATH` em `route-rules.ts`                                        |
| 404 cair fora do layout do grupo                           | Catch-all por grupo chamando `notFound()` + `not-found.tsx` por segmento                              |
| CORS liberar origem indevida ou bloquear o fluxo           | Allowlist por ambiente, métodos/headers explícitos e testes de origem permitida/negada + preflight    |
| Documentação divergir do produto (PT-BR vs en-US)          | Atualizar RULES/DESIGN/DEVELOPMENT/ARCHITECTURE/QA/AGENTS na mesma entrega                            |
| Textos misturarem idiomas                                  | Placeholders, metadados e `lang` en-US; revisão de docs e busca por strings PT-BR nas telas novas     |

## 8. Plano de testes

- **Unitário (web):** `getRootRedirectPath`, `getPrivateAreaRedirectPath`,
  `shouldRedirectFromAuthPath` (incluindo trailing slash e forgot/reset) e `getSessionUser`
  (sem cookie, 401, 200 válido, shape inválido, erro de rede).
- **Unitário (api):** `isAllowedCorsOrigin`, `CORS_METHODS`, `CORS_ALLOWED_HEADERS`.
- **Integração (api):** preflight `OPTIONS` com origem permitida e headers/métodos do fluxo;
  origem negada sem `Access-Control-Allow-Origin`; hello e `GET /` 404 preservados.
- **E2E (web):** `/` sem sessão → sign-up; `/app` e `/app/*` sem sessão → sign-up; `sign-up`,
  `sign-in`, `confirm` com sessão → `/app`; forgot/reset acessíveis com sessão; `/` e `/app`
  com sessão; sessão inválida; 404 nos dois layouts; responsividade, foco e `lang`.
- **Manual:** teclado, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US e
  ausência de token no HTML.

## 9. QA manual

1. `bun run dev` com a API fake do E2E ou a API real (quando `JWT_SECRET` estiver no `.env`).
2. Abrir `/` sem cookie → `/auth/sign-up`; conferir h1 e layout público.
3. Abrir `/app` e `/app/unknown` sem cookie → `/auth/sign-up`.
4. Com cookie de sessão válido, abrir `/` e `/app` → `/app` com shell; `/auth/sign-in`,
   `/auth/sign-up` e `/auth/confirm` → `/app`.
5. Com sessão válida, abrir `/auth/forgot-password` e `/auth/reset-password` → página permanece.
6. Com cookie inválido, abrir `/app` → `/auth/sign-up`.
7. `/auth/unknown` → 404 no layout público; `/app/unknown` com sessão → 404 no shell.
8. Navegar por teclado, conferir foco visível, `lang="en-US"`, textos en-US e ausência de
   rolagem horizontal em 360/768/1280 px.
9. API: `GET /api/v1/hello` 200; `GET /` 404; preflight de origem permitida aceito e origem
   negada bloqueada.
10. Inspecionar HTML/JS: nenhum token, JWT ou dado de sessão exposto.

## 10. Rollout e rollback

- Sem migração de schema e sem feature flag; usa a sessão da fatia 002.
- Rollout: commit local na branch `spec/003`; o orquestrador integra por onda.
- Rollback: reverter o commit; a página de demonstração anterior é restaurada e nenhum dado é
  perdido.
- Config: sem nova variável obrigatória; `API_BASE_URL` já existia e é reutilizada pelo E2E com
  override local.
