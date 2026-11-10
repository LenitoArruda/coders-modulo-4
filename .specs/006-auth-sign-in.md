# Auth sign-in — Spec

> **Status:** done
> **Atualizado em:** 2026-11-10
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`, `.specs/005-auth-confirm-account.md`
> **Plano:** `.plans/006-auth-sign-in-plan.md`

## 1. Contexto e problema

Depois da fatia 005, quem confirma a conta recebe uma sessão e acessa `/app`. Ainda não existia uma forma de voltar à plataforma depois que a sessão expira ou de entrar em outro navegador/dispositivo. O placeholder de `/auth/sign-in` não autentica ninguém e `/app/*` redirecionava para `/auth/sign-up` quando faltava sessão.

Esta fatia entrega a entrada por e-mail e senha, aplica a regra de que apenas a sessão mais recente vale, envia o e-mail de nova sessão e completa a proteção de `/app/*` com o redirecionamento correto para `/auth/sign-in`. Ela também define o comportamento da raiz `/` e de `/auth/confirm` sem token.

## 2. Usuários e jobs

| Usuário                                      | Job                                                                | Frequência                     |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Pessoa com conta confirmada                  | Entrar com e-mail e senha e chegar à área privada                  | Recorrente                     |
| Pessoa com sessão ativa em outro dispositivo | Perceber que a sessão anterior foi encerrada quando uma nova entra | Eventual                       |
| Pessoa que esqueceu a senha                  | Ser direcionada ao fluxo de recuperação a partir do sign-in        | Eventual, tratado na fatia 007 |
| Pessoa com conta não confirmada              | Entender que precisa confirmar o e-mail antes de entrar            | Eventual                       |

Permissões: `/auth/sign-in` é pública. `/app/*` exige JWT válido e sessão ativa. O sign-in só é permitido para contas com e-mail confirmado.

## 3. Resultado esperado

Uma pessoa com conta confirmada consegue abrir `/auth/sign-in`, informar e-mail e senha, entrar em `/app` e receber um e-mail de nova sessão. Se já existia uma sessão ativa, ela é revogada e apenas a nova funciona.

Quem tenta `/app/*` sem sessão é enviado para `/auth/sign-in?returnTo=<caminho>` e, depois de entrar, volta ao caminho solicitado quando ele é um caminho interno seguro. A raiz `/` leva para `/app` quando há sessão válida e para `/auth/sign-in` quando não há. `/auth/confirm` sem token também leva a `/app` (com sessão) ou `/auth/sign-in` (sem sessão). A página substitui o placeholder da fatia 003.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de sign-in.

## 5. Escopo

### Dentro

- Página pública `/auth/sign-in` em en-US, substituindo o placeholder, com campos de e-mail e senha, labels, erros acessíveis e estados de loading/erro.
- Endpoint `POST /api/v1/auth/sign-in` com validação de entrada, credenciais e conta confirmada.
- Verificação de senha contra o hash persistido, sem revelar se o e-mail existe (hash dummy quando a conta não existe; confirmação checada só depois de senha correta).
- Criação de sessão JWT com `origin = sign_in` e revogação das sessões ativas anteriores, consistente sob concorrência, por meio do `CreateSessionUseCase` existente.
- E-mail en-US de nova sessão para cada sign-in bem-sucedido, enviado dentro do `CreateSessionUseCase` (best-effort).
- Gravação do JWT em cookie `HttpOnly` pelo web (Server Action) e encaminhamento como `Authorization: Bearer` para a API.
- Atualização do guard de `/app/*`: sem sessão, redirecionar para `/auth/sign-in` com `returnTo`; `SIGNED_OUT_REDIRECT_PATH` passa a ser `/auth/sign-in`.
- Redirecionamento de volta ao caminho solicitado após o sign-in, apenas para caminhos internos de `/app` (ver regras de `returnTo`).
- Redirecionamento da raiz `/`: sessão válida → `/app`; sem sessão → `/auth/sign-in`.
- Redirecionamento de pessoas autenticadas que abrem `/auth/sign-in` ou `/auth/sign-up` para `/app`.
- `/auth/confirm` sem token: com sessão → `/app`; sem sessão → `/auth/sign-in`. Com token, continua sendo processado mesmo com sessão ativa (fatia 005); quando o token é inválido, expirado ou usado, a mensagem acionável permanece na página e o CTA principal passa a ser “Sign in” (`/auth/sign-in`), com “create an account” como link secundário.
- Rate limiting contra força bruta por IP + e-mail normalizado (padrão 5 tentativas por janela de 60 s; a 6ª recebe `429` com `Retry-After`), configurável por `SIGN_IN_RATE_LIMIT_MAX` e `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS`.
- Link “Forgot password?” na página, apontando para `/auth/forgot-password` (implementado na fatia 007).
- Atualização dos testes, E2E e documentação que afirmavam “`/` e `/app/*` sem sessão → `/auth/sign-up`” ou o comportamento antigo de `/auth/confirm` sem token: `.specs/003-auth-routes.md` (fluxos, tabela de rotas, critérios e decisões), `.specs/005-auth-confirm-account.md`, `.docs/ARCHITECTURE.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md`, `route-rules.spec.ts`, `routing.spec.ts` e `confirm-account.spec.ts`.

### Fora

- Sign-out e encerramento manual de sessão.
- Refresh token, renovação automática e “remember me”.
- Recuperação e reset de senha; isso entra nas fatias 007 e 008. O link “Forgot password?” existe, mas a página de destino é da fatia 007.
- Mensagem de sucesso `reset=success` no sign-in; isso entra na fatia 008.
- MFA, SSO, login social e passkeys.
- Bloqueio permanente de conta após tentativas falhas; esta entrega usa throttling, não lockout.
- Reenvio de confirmação de conta; a pessoa com conta não confirmada recebe orientação, mas o reenvio dedicado fica fora.
- Gestão de dispositivos/sessões, lista de sessões e encerramento remoto manual.
- Edição de perfil, troca de e-mail, exclusão de conta e permissões por papel.

## 6. Fluxos

### Fluxo principal — entrar

1. A pessoa abre `/auth/sign-in` (opcionalmente com `?returnTo=<caminho>`).
2. Informa e-mail e senha e envia o formulário; o `returnTo` já validado viaja em um input oculto `returnTo`.
3. A Server Action do web envia as credenciais para `POST /api/v1/auth/sign-in`.
4. A API valida o corpo, aplica o rate limit, normaliza o e-mail, localiza a conta, verifica a senha (contra um hash dummy se a conta não existir) e só então confirma que o e-mail já foi confirmado.
5. A API cria a sessão com `origin = sign_in` (via `CreateSessionUseCase`), revoga as sessões anteriores, assina o JWT e envia o e-mail de nova sessão (best-effort).
6. A Server Action grava o JWT em cookie `HttpOnly`, revalida o `returnTo` com a mesma função `sanitizeReturnTo` e redireciona para ele (ou para `/app`).
7. A área `/app` carrega com a sessão nova.

### Fluxos alternativos e de exceção

- Corpo malformado ou campos vazios: a API responde `400` com `code = VALIDATION_ERROR`; o web valida a presença dos campos antes de chamar a API e mostra erros por campo.
- Credenciais inválidas (e-mail inexistente, senha incorreta, e-mail sem formato válido): a API responde `401` com `INVALID_CREDENTIALS` e mensagem genérica; nenhuma sessão ou e-mail é criado.
- Conta não confirmada com a senha correta: a API responde `403` com “Please confirm your email before signing in.”; nenhuma sessão é criada. Com senha errada, a resposta é o `401` genérico.
- Muitas tentativas para o mesmo IP + e-mail em pouco tempo: a API responde `429` com `Retry-After` e o web orienta a aguardar; a resposta não revela se a conta existe.
- Falha ao criar a sessão: nenhum cookie é gravado; o web mostra erro genérico e permite tentar novamente.
- Falha ao enviar o e-mail de nova sessão: a sessão permanece válida, a falha é registrada sem PII e a pessoa segue para `/app`.
- `/app/*` sem sessão: redirecionar para `/auth/sign-in?returnTo=<caminho>`.
- `returnTo` ausente, externo ou inválido: redirecionar para `/app`.
- Pessoa autenticada abre `/auth/sign-in` ou `/auth/sign-up`: redirecionar para `/app`.
- `/auth/confirm` sem token: com sessão → `/app`; sem sessão → `/auth/sign-in`.
- Raiz `/` com sessão válida: redirecionar para `/app`; sem sessão: redirecionar para `/auth/sign-in`.

## 7. Regras e casos de borda

- E-mail é normalizado (trim e minúsculas); a senha é comparada ao hash e nunca é alterada (sem trim). No login a senha não tem mínimo (contas antigas e erros de digitação recebem `401`), mas tem teto de 128 caracteres (acima disso, `400`), o mesmo do sign-up, para limitar o custo do KDF.
- Erros de credencial usam a mesma mensagem e o mesmo status para e-mail inexistente, senha incorreta e e-mail malformado: `401 INVALID_CREDENTIALS`, “Invalid email or password.”.
- Quando a conta não existe, a API verifica a senha contra um hash dummy real (calculado uma vez por processo) para que o tempo de resposta não revele a existência da conta.
- A confirmação do e-mail só é checada depois de a senha estar correta; assim o `403` nunca revela a existência de conta a quem não sabe a senha.
- A sessão é criada pelo `CreateSessionUseCase`, que insere a nova sessão e depois revoga todas as outras ativas da pessoa (excluindo a nova). Essa ordem mantém o invariante sob concorrência: dois sign-ins simultâneos nunca deixam duas sessões válidas (o pior caso deixa ambas revogadas e exige novo sign-in).
- O e-mail de nova sessão (assunto “New session on your account”, data/hora em UTC, alerta para alterar a senha e link para `/auth/forgot-password`) é enviado dentro do `CreateSessionUseCase` para toda sessão criada (sign-in e confirmação), de forma best-effort: falha de envio não derruba a sessão.
- O JWT e o cookie seguem o mesmo contrato da fatia 002: `sub`, `sid`, `iat`, `exp`; cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`.
- A API é a fonte de verdade da sessão; o redirecionamento do web é apenas experiência.
- Rate limiting: janela deslizante em memória, chave `IP + e-mail normalizado`, padrão de 5 tentativas por 60 s (a 6ª recebe `429` com `Retry-After`); não há lockout permanente. Corpos malformados (`400`) não consomem tentativas.
- `/auth/sign-in` e `/auth/sign-up` são públicas para quem não tem sessão; com sessão válida, redirecionam para `/app`. `/auth/confirm` com token é processado sempre; sem token redireciona (com sessão → `/app`, sem sessão → `/auth/sign-in`).
- `/app/*` é privado; a raiz `/` escolhe entre `/app` e `/auth/sign-in`.
- Nenhum token, JWT, senha ou PII (incluindo e-mail) é registrado em logs, traces ou métricas; os logs de sign-in carregam apenas `outcome` e `userId`.
- A UI é light-only, acessível e responsiva em 360 px, 768 px e 1280 px.

### Regras de `returnTo`

- Aceita somente `/app` ou `/app/...` (com query opcional, que é preservada; o fragmento é descartado). Qualquer outro valor vira `/app`.
- Rejeita: esquema (`https:`, `javascript:`, `data:`), forma protocol-relative (`//`, inclusive `/app//x`), barra invertida (`\`) e caracteres de controle, segmentos `..` e equivalentes codificados (`%2e%2e`, `%2f%2f`, `%5c`, inclusive com dupla codificação), codificação inválida, valores com mais de 2048 caracteres e prefixos parecidos (`/application`, `/appx`).
- Como atravessa o fluxo: `proxy.ts` (Next 16, `matcher` `/app` e `/app/:path*`) copia `pathname + search` para o header de requisição `x-return-to`, sobrescrevendo qualquer valor do cliente; o guard (`requireSessionUser`) lê o header, sanitiza com `sanitizeReturnTo` e redireciona para `/auth/sign-in?returnTo=<caminho codificado>` (sem parâmetro quando o destino seria só `/app`). A página `/auth/sign-in` sanitiza o parâmetro e o coloca em um input oculto; a Server Action sanitiza de novo antes do `redirect`, então um valor adulterado no formulário também cai em `/app`.
- O header `x-return-to` nunca concede acesso: o proxy não decide permissões e o valor é sempre sanitizado.

## 8. Dados e contratos

### `POST /api/v1/auth/sign-in`

```json
{
  "email": "ada@example.com",
  "password": "correct horse battery staple"
}
```

Respostas:

- `200` — `{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 604800, "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }` (`expiresIn` = `SESSION_TTL_SECONDS`, padrão 604800).
- `400` — `{ "code": "VALIDATION_ERROR", "message": "Enter your email address and password." }` para corpo malformado, campos ausentes/vazios ou senha acima de 128 caracteres.
- `401` — `{ "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." }`.
- `403` — `{ "code": "EMAIL_NOT_CONFIRMED", "message": "Please confirm your email before signing in." }`, somente com a senha correta.
- `429` — `{ "code": "TOO_MANY_REQUESTS", "message": "Too many attempts. Wait a moment and try again." }` com `Retry-After`.
- `500` — falha interna sem detalhes.

### `GET /api/v1/auth/me`

- Reutiliza o contrato da fatia 002 para validar a sessão e obter os dados da pessoa.

### Sessão e cookie

- A nova sessão revoga todas as sessões ativas anteriores da mesma pessoa.
- `sessions` registra a origem `sign_in` para novas sessões de sign-in.
- O cookie é gravado pelo web; a API só aceita `Authorization: Bearer`.
- A duração da sessão é a mesma da fatia 002 (padrão de 7 dias, configurável).

### Configuração

- `SIGN_IN_RATE_LIMIT_MAX` (padrão 5) e `SIGN_IN_RATE_LIMIT_WINDOW_SECONDS` (padrão 60), validados em `loadEnv` e documentados em `.env.example`.

### E-mail

- Assunto: “New session on your account”.
- Corpo en-US com data/hora do acesso, alerta para alterar a senha se a pessoa não reconhecer a sessão e link para `/auth/forgot-password` (o template já o inclui desde a fatia 002).
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local (Mailpit).

### Navegação

- `/` com sessão válida → `/app`.
- `/` sem sessão → `/auth/sign-in`.
- `/app/*` sem sessão → `/auth/sign-in?returnTo=<caminho interno>`.
- `/auth/sign-in` e `/auth/sign-up` com sessão válida → `/app`.
- `/auth/confirm` sem token: com sessão → `/app`; sem sessão → `/auth/sign-in`. Com token: processado.
- `/auth/forgot-password` e `/auth/reset-password` permanecem acessíveis com sessão.

### Interface

- Texto do link de recuperação: “Forgot password?” (aponta para `/auth/forgot-password`); link “Create an account” para `/auth/sign-up`.
- Campos: `email` (`type=email`, `autocomplete=email`) e `password` (`type=password`, `autocomplete=current-password`), rótulos associados, erros por campo com `aria-describedby`, alerta com foco para erros do servidor. O e-mail digitado é preservado após falha; a senha nunca.

## 9. Permissões e segurança

- `/auth/sign-in` e o endpoint de sign-in são públicos; não exigem sessão.
- `/app/*` exige JWT válido e sessão ativa; a API valida em todas as chamadas protegidas.
- Credenciais inválidas não revelam existência de conta; a mensagem é genérica e o tempo de resposta é equalizado com hash dummy.
- O sign-in de conta não confirmada não cria sessão e o `403` só ocorre com a senha correta.
- Rate limiting por IP + e-mail reduz força bruta; não há lockout permanente.
- A sessão única é garantida pela criação da nova sessão seguida da revogação das anteriores.
- O JWT é assinado pela API e fica em cookie `HttpOnly`; o JavaScript não lê o token.
- A combinação `SameSite=Lax` e a Server Action do Next (que verifica a origem) reduz risco de CSRF.
- `returnTo` é validado em três pontos (guard, página e Server Action) para impedir open redirect.
- Nenhum token, JWT, senha ou PII aparece em logs, traces ou métricas.
- A API não expõe detalhes internos de banco ou stack em erros.

## 10. Requisitos não funcionais

- `POST /api/v1/auth/sign-in` responde em até 1 s p95 no ambiente local.
- A validação de sessão em `/app/*` não adiciona mais de 300 ms ao carregamento inicial local.
- A página `/auth/sign-in` atende AA, funciona por teclado, tem foco visível, labels associados, erros com `aria-describedby` e layout funcional em 360 px, 768 px e 1280 px sem rolagem horizontal.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI e e-mails são en-US.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou JWT.
- A revogação de sessão é consistente sob concorrência: dois sign-ins simultâneos não podem deixar duas sessões válidas.

## 11. Dependências e riscos

| Dependência ou risco                         | Impacto                                                              | Mitigação                                                            | Dono       |
| -------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
| Spec 005 (conta confirmada e sessão inicial) | Sem ela não há conta confirmada para entrar                          | Implementar na ordem do mapa                                         | Engenharia |
| Spec 002 (sessão, JWT, cookie e e-mail)      | Sem ela não há sessão para criar                                     | Reutilizar os casos de uso e o template                              | Engenharia |
| Hash de senha e verificação                  | Falha pode bloquear pessoas legítimas ou aceitar credenciais erradas | Testes de unidade e integração com casos de senha correta/incorreta  | Engenharia |
| Revogação concorrente                        | Duas sessões podem ficar ativas                                      | Criar nova sessão e revogar as demais excluindo-a; teste concorrente | Engenharia |
| Força bruta                                  | Tentativas ilimitadas comprometem contas                             | Rate limiting por IP + e-mail e mensagens genéricas                  | Engenharia |
| Rate limit em memória                        | Não é compartilhado entre instâncias                                 | Store compartilhado fica como follow-up para multi-instância         | Engenharia |
| E-mail de nova sessão                        | Falha de entrega não pode bloquear o acesso                          | Sessão permanece válida e falha é registrada sem PII                 | Engenharia |
| Open redirect via `returnTo`                 | Redirecionamento para domínio malicioso                              | `sanitizeReturnTo` em guard, página e action, com tabela de ataques  | Engenharia |
| Sem sign-out/refresh                         | Sessão só termina por expiração ou nova sessão                       | Registrar como decisão aberta e fora do épico                        | Produto    |
| Banco de testes para integração              | Testes de sessão podem ficar frágeis                                 | Repositórios em memória nos testes; API fake no E2E                  | Engenharia |

## 12. Rollout e migração

- Não há nova tabela nesta fatia; a tabela de sessões da fatia 001 passa a registrar a origem `sign_in`.
- O placeholder de `/auth/sign-in` é substituído pela página real.
- A raiz `/` muda de `/auth/sign-up` para `/app` ou `/auth/sign-in`, conforme a sessão.
- `/app/*` passa a redirecionar para `/auth/sign-in` em vez de `/auth/sign-up`.
- `/auth/confirm` sem token deixa de mostrar o card de link inválido e passa a redirecionar.
- Não há feature flag nesta entrega. Novas variáveis de ambiente têm padrão seguro.
- Rollback: reverter o commit; sessões continuam descartáveis no ambiente local.
- Comunicação: atualizar `.docs`, testes e documentação de navegação na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** parsing/validação de entrada; caso de uso (sucesso, senha errada, e-mail inexistente com hash dummy, `403` só com senha correta, revogação, concorrência, falha de e-mail); rate limiter; `sanitizeReturnTo`/`buildSignInPath`; parsing da resposta no web; env.
- **Integração (Supertest):** `POST /api/v1/auth/sign-in` com sucesso, `401` (senha errada, e-mail inexistente, formato inválido), `400`, `403`, 6ª tentativa → `429` com `Retry-After`, isolamento por e-mail, falha de e-mail; `GET /api/v1/auth/me` com JWT novo e antigo; revogação da sessão anterior; sign-ins simultâneos; ausência de e-mail/senha/JWT nos logs.
- **E2E (Playwright, API fake):** sign-in com cookie `HttpOnly`; erros `401`, `403`, `429`, `500` e campos vazios; segundo contexto de navegador invalidando o primeiro; `/app/*` sem sessão e retorno ao caminho; vetores de open redirect; raiz `/` com e sem sessão; `/auth/confirm` sem token (com e sem sessão); acessibilidade e responsividade.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US, inspeção do e-mail de nova sessão e do cookie no navegador.
- **Dados de teste:** contas confirmadas e não confirmadas, e-mails únicos por execução; nenhum dado real.

Tabela de casos de `returnTo` (`sanitizeReturnTo`):

| Entrada                                                                                        | Resultado                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `/app`, `/app/`, `/app/settings`, `/app/settings/profile`                                      | aceita como está                     |
| `/app/settings?tab=billing`, `/app?x=1`                                                        | aceita e preserva a query            |
| `/app/settings#frag`, `/app/./settings`                                                        | aceita normalizado (`/app/settings`) |
| ausente, vazio, não string, `/`, `/auth/sign-up`, `/application`, `/appx/settings`             | `/app`                               |
| `https://evil.example/app/x`, `http://evil.example`, `javascript:…`, `data:…`                  | `/app`                               |
| `//evil.example`, `/app//evil.example`, `/app/%2F%2Fevil.example`, `/app/%252F%252F…`          | `/app`                               |
| `\evil.example`, `/app\evil.example`, `/app/%5Cevil.example`                                   | `/app`                               |
| `/app/../auth/sign-in`, `/app/%2e%2e/auth/sign-in`, `/app/%252e%252e/x`                        | `/app`                               |
| caractere de controle, tabulação, NUL, codificação inválida, > 2048 caracteres, espaço inicial | `/app`                               |

## 14. Critérios de aceite

- [x] Dada uma conta confirmada com e-mail e senha válidos, quando a pessoa envia o formulário em `/auth/sign-in`, então a API responde `200`, uma sessão com `origin = sign_in` é criada e o JWT tem apenas `sub`, `sid`, `iat` e `exp`.
- [x] Dado um sign-in bem-sucedido, quando o web recebe o JWT, então grava o cookie `HttpOnly` (`SameSite=Lax`, `Path=/`, `Secure` em produção), redireciona para `/app` e o JWT nunca aparece no HTML, no armazenamento do navegador ou na URL.
- [x] Dado um sign-in bem-sucedido, quando a sessão é criada, então o e-mail “New session on your account” é enviado, e se o envio falhar a sessão continua válida e a falha é registrada sem PII.
- [x] Dados e-mail inexistente, senha incorreta ou e-mail malformado, quando alguém tenta entrar, então a API responde `401` com a mesma mensagem genérica, nenhuma sessão é criada e nenhum e-mail é enviado.
- [x] Dado um corpo malformado ou com campos vazios, quando o endpoint é chamado, então a API responde `400` sem criar sessão e o web mostra erros por campo antes de chamar a API.
- [x] Dada uma conta não confirmada e a senha correta, quando alguém tenta entrar, então a API responde `403`, nenhuma sessão é criada e a pessoa recebe orientação para confirmar o e-mail; com senha errada, a resposta é o `401` genérico.
- [x] Dada uma sessão ativa em um dispositivo, quando a mesma pessoa entra em outro dispositivo, então a sessão anterior é revogada, o JWT antigo recebe `401`, apenas a nova acessa `/app` e um novo e-mail de nova sessão é enviado.
- [x] Dados dois sign-ins simultâneos da mesma conta, quando ambos terminam, então no máximo uma sessão permanece ativa.
- [x] Dado um acesso a `/app/*` sem sessão, quando a pessoa é redirecionada, então vai para `/auth/sign-in?returnTo=<caminho>` e, após entrar, retorna ao caminho interno solicitado.
- [x] Dado um `returnTo` externo, protocol-relative, com barra invertida, `..` (inclusive codificado), esquema ou fora de `/app`, quando a pessoa entra, então cai em `/app`, inclusive quando o valor é adulterado no formulário ou no header `x-return-to`.
- [x] Dada a raiz `/`, quando há sessão válida, então redireciona para `/app`; quando não há, redireciona para `/auth/sign-in`.
- [x] Dada uma pessoa autenticada, quando abre `/auth/sign-in` ou `/auth/sign-up`, então vai para `/app`; `/auth/confirm` sem token vai para `/app` com sessão e para `/auth/sign-in` sem sessão; `/auth/confirm` com token continua sendo processado.
- [x] Dado um token de confirmação inválido, expirado ou usado, quando a página é aberta, então a mensagem acionável permanece na página e o CTA principal é “Sign in”.
- [x] Dadas 5 tentativas do mesmo IP + e-mail em 60 s, quando ocorre a 6ª, então a API responde `429` com `Retry-After`, sem revelar se a conta existe, e outros e-mails não são afetados.
- [x] Dado o fluxo de sign-in, quando os logs são inspecionados, então não há token, JWT, senha nem e-mail.
- [x] Dada a página `/auth/sign-in`, quando é usada por teclado em 360, 768 e 1280 px, então tem foco visível, labels, erros com `aria-describedby`, sem rolagem horizontal, light-only e em en-US, com o link “Forgot password?” para `/auth/forgot-password`.

## 15. Decisões e questões abertas

| Tema                            | Decisão ou pergunta                                                                                 | Impacto                                        | Dono               | Status                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------ | ----------------------- |
| Sessão única                    | Cada sign-in revoga todas as sessões anteriores                                                     | Garante “última sessão vence”                  | Produto/Engenharia | fechada (2026-11-09)    |
| Mensagem de credencial inválida | Mesma resposta para e-mail inexistente e senha incorreta                                            | Evita enumeração de contas                     | Produto/Segurança  | fechada (2026-11-09)    |
| Conta não confirmada            | `403` com orientação, somente após senha correta; sem sessão                                        | Evita acesso antes da confirmação e enumeração | Produto/Engenharia | fechada (2026-11-10)    |
| `returnTo`                      | Apenas `/app` e `/app/...`, com validação em três pontos                                            | Evita open redirect                            | Engenharia         | fechada (2026-11-10)    |
| Link de recuperação             | “Forgot password?” aponta para `/auth/forgot-password` da fatia 007                                 | Mantém o fluxo de recuperação no lugar certo   | Produto/Engenharia | fechada (2026-11-09)    |
| Destino do guard                | `/app/*` sem sessão → `/auth/sign-in`                                                               | Substitui o destino provisório da fatia 003    | Engenharia         | fechada (2026-11-09)    |
| `/auth/confirm` sem token       | Com sessão → `/app`; sem sessão → `/auth/sign-in`; token inválido mantém mensagem com CTA “Sign in” | Jornada coerente sem card órfão                | Produto            | fechada (2026-11-10)    |
| Rate limiting                   | Chave IP + e-mail normalizado, 5 tentativas por 60 s, 6ª → `429`; sem lockout                       | Reduz força bruta sem bloquear contas          | Engenharia         | fechada (2026-11-10)    |
| Rate limit compartilhado        | Store compartilhado para multi-instância                                                            | Limite hoje é por processo                     | Engenharia         | aberta (não bloqueante) |
| Sign-out                        | Fora do épico                                                                                       | Sessão termina por expiração ou nova sessão    | Produto            | aberta (não bloqueante) |
| Refresh token                   | Fora do épico; ao expirar, novo sign-in                                                             | Evita complexidade de rotação                  | Produto/Engenharia | aberta (não bloqueante) |
| Banco de testes                 | Repositórios em memória nos testes; API fake no E2E                                                 | Afeta testes de integração e E2E               | Engenharia         | fechada (2026-11-10)    |
