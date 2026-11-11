# Testes de carga (k6)

Geram massa de dados (métricas, logs e traces) para a dashboard de observabilidade
e servem como teste de carga da API.

## Cenários (`api.js`)

| Cenário   | Fatia dos VUs | O que faz                                                       |
| --------- | ------------- | --------------------------------------------------------------- |
| `public`  | 55%           | `GET /hello` e rota inexistente (404) — caminho sem banco       |
| `session` | 40%           | sign-in → `/auth/me` (1–3x) → sign-out → `/auth/me` (401)       |
| `errors`  | 5%            | 400/401 deliberados: validação, token ruim, credencial inválida |
| `email`   | opt-in        | sign-up e forgot-password (**envia e-mail**, veja abaixo)       |

Perfis (`PROFILE`): `smoke` (~35 s), `load` (8 min, 60 VUs), `stress` (9 min, até 200 VUs),
`spike` (~3 min, salto 10 → 200 VUs) e `soak` (30 min, 30 VUs).

`rate-limit.js` valida os 429 + `Retry-After` dos limiters (precisa dos limites padrão).

## Por que o ambiente precisa de preparo

1. **Sessão única**: um sign-in revoga as sessões anteriores da mesma conta. Cada VU
   usa a própria conta, semeada por `seed.mjs` (`loadtest-<n>@loadtest.invalid`, 300 por padrão).
   O pico de VUs do perfil não deve passar de `LOAD_USERS`.
2. **Rate limit**: os padrões (5/min por IP) devolveriam 429 quase sempre, pois o k6 sai de
   um único IP. Suba a API com limites altos (o teto aceito pelo env é `10000`).
3. **E-mail**: todo sign-in envia o e-mail de "nova sessão" pelo Mailtrap, e sign-up/forgot-password
   também enviam. Para não gastar cota nem entregar e-mail, suba a API com
   `MAILTRAP_API_TOKEN=load-test-disabled`: o Mailtrap recusa o envio (401), o sign-in segue
   (a falha vira log `warn`) e o sign-up responde 503 (aceito pelo cenário `email`).
   **Nunca** rode `INCLUDE_EMAIL_FLOWS=true` com o token real.

## Passo a passo

```sh
bun run infra:up                 # Supabase + LGTM
bun run load:seed                # cria os usuários de carga

# API em "modo carga" (a partir de apps/api):
MAILTRAP_API_TOKEN=load-test-disabled \
SIGN_IN_RATE_LIMIT_MAX=10000 SIGN_UP_RATE_LIMIT_MAX=10000 \
FORGOT_PASSWORD_RATE_LIMIT_MAX=10000 RESET_PASSWORD_RATE_LIMIT_MAX=10000 \
CONFIRMATION_RATE_LIMIT_MAX=10000 \
bun --env-file=../../.env src/main.ts
# PowerShell: defina cada variável com $env:NOME = "valor" antes do bun.

bun run load:smoke               # valida o setup
bun run load:load                # ou load:stress | load:spike | load:soak
```

Para os 429, reinicie a API **sem** os overrides de rate limit e rode `bun run load:rate-limit`.

Limpeza: `bun run load:clean` remove todas as contas `loadtest-*@loadtest.invalid`
(inclusive as criadas pelo cenário `email`).

## Execução

`scripts/k6.mjs` usa o `k6` do PATH, ou a imagem `grafana/k6:1.4.0` via Docker (padrão, sem
instalar nada). No Docker a API é acessada por `host.docker.internal:3333`; para outro alvo
defina `BASE_URL` (ex.: `http://localhost:3333/api/v1`). O seed só roda contra o Supabase local.

## Lendo os resultados

- Thresholds: `http_req_failed < 1%`, `checks > 99%` e p95 por endpoint (`hello` 300 ms,
  `me` 500 ms, `sign-out` 800 ms, `sign-in` 2 s). Os thresholds falham o processo (exit 99).
- O sign-in é o gargalo esperado: scrypt (N=2^15) usa o threadpool do libuv; em estresse,
  observe a latência dele subir primeiro.
- Na dashboard (Grafana em `http://localhost:3010`), ajuste o intervalo para cobrir a execução.
