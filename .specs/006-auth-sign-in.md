# Auth sign-in — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`, `.specs/005-auth-confirm-account.md`
> **Plano:** `.plans/006-auth-sign-in-plan.md` (a criar pelo `implement-me`)

## 1. Contexto e problema

Depois da fatia 005, quem confirma a conta recebe uma sessão e acessa `/app`. Ainda não existe uma forma de voltar à plataforma depois que a sessão expira ou de entrar em outro navegador/dispositivo. O placeholder de `/auth/sign-in` não autentica ninguém e `/app/*` ainda redireciona para `/auth/sign-up` quando falta sessão.

Esta fatia entrega a entrada por e-mail e senha, aplica a regra de que apenas a sessão mais recente vale, envia o e-mail de nova sessão e completa a proteção de `/app/*` com o redirecionamento correto para `/auth/sign-in`. Ela também define o comportamento da raiz `/` para quem já tem sessão.

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

Quem tenta `/app/*` sem sessão é enviado para `/auth/sign-in` e, depois de entrar, volta ao caminho solicitado quando ele é um caminho interno seguro. A raiz `/` leva para `/app` quando há sessão válida e para `/auth/sign-in` quando não há. A página substitui o placeholder da fatia 003.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de sign-in.

## 5. Escopo

### Dentro

- Página pública `/auth/sign-in` em en-US, substituindo o placeholder, com campos de e-mail e senha, labels, erros acessíveis e estados de loading/erro.
- Endpoint `POST /api/v1/auth/sign-in` com validação de credenciais e conta confirmada.
- Verificação de senha contra o hash persistido, sem revelar se o e-mail existe.
- Criação de sessão JWT com `origin = sign_in` e revogação atômica de todas as sessões ativas anteriores.
- E-mail en-US de nova sessão para cada sign-in bem-sucedido.
- Gravação do JWT em cookie `HttpOnly` pelo web e encaminhamento como `Authorization: Bearer` para a API.
- Atualização do guard de `/app/*`: sem sessão, redirecionar para `/auth/sign-in` com `returnTo`.
- Redirecionamento de volta ao caminho solicitado após o sign-in, apenas para caminhos internos de `/app/*`.
- Redirecionamento da raiz `/`: sessão válida → `/app`; sem sessão → `/auth/sign-in`.
- Redirecionamento de pessoas autenticadas que abrem `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm` para `/app`.
- Rate limiting básico contra força bruta, com resposta genérica e sem revelar existência de conta.
- Link “Forgot password?” na página, apontando para `/auth/forgot-password` (implementado na fatia 007).
- Atualização de testes, E2E e documentação afetada.

### Fora

- Sign-out e encerramento manual de sessão.
- Refresh token, renovação automática e “remember me”.
- Recuperação e reset de senha; isso entra nas fatias 007 e 008. O link “Forgot password?” pode existir, mas a página de destino é criada na fatia 007.
- Mensagem de sucesso `reset=success` no sign-in; isso entra na fatia 008.
- MFA, SSO, login social e passkeys.
- Bloqueio permanente de conta após tentativas falhas; esta entrega usa throttling, não lockout.
- Reenvio de confirmação de conta; a pessoa com conta não confirmada recebe orientação, mas o reenvio dedicado fica fora.
- Gestão de dispositivos/sessões, lista de sessões e encerramento remoto manual.
- Edição de perfil, troca de e-mail, exclusão de conta e permissões por papel.

## 6. Fluxos

### Fluxo principal — entrar

1. A pessoa abre `/auth/sign-in`.
2. Informa e-mail e senha e envia o formulário.
3. O web envia as credenciais para `POST /api/v1/auth/sign-in`.
4. A API normaliza o e-mail, localiza a conta, verifica a senha e confirma que o e-mail já foi confirmado.
5. A API revoga todas as sessões ativas anteriores, cria a nova sessão com `origin = sign_in`, assina o JWT e dispara o e-mail de nova sessão.
6. O web grava o JWT em cookie `HttpOnly` e redireciona para `/app` ou para o `returnTo` interno seguro.
7. A área `/app` carrega com a sessão nova.

### Fluxos alternativos e de exceção

- Credenciais inválidas: a API responde `401` com mensagem genérica; nenhuma sessão ou e-mail é criado; a mensagem não revela se o e-mail existe.
- Conta não confirmada: a API responde `403` com “Please confirm your email before signing in.”; nenhuma sessão é criada.
- Muitas tentativas em pouco tempo: a API responde `429` e o web orienta a aguardar; a resposta não revela se a conta existe.
- Falha ao criar a sessão: nenhum cookie é gravado; o web mostra erro genérico e permite tentar novamente.
- Falha ao enviar o e-mail de nova sessão: a sessão permanece válida, a falha é registrada sem PII e a pessoa segue para `/app`.
- `/app/*` sem sessão: redirecionar para `/auth/sign-in?returnTo=<caminho>`.
- `returnTo` ausente, externo ou inválido: redirecionar para `/app`.
- Pessoa autenticada abre `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm`: redirecionar para `/app`.
- Raiz `/` com sessão válida: redirecionar para `/app`; sem sessão: redirecionar para `/auth/sign-in`.

## 7. Regras e casos de borda

- E-mail é normalizado para minúsculas e comparado de forma case-insensitive; senha é comparada ao hash.
- Erros de credencial usam a mesma mensagem e o mesmo status para e-mail inexistente, senha incorreta e conta inexistente.
- Conta com e-mail não confirmado não recebe sessão e recebe uma mensagem acionável.
- O sign-in só é permitido com a conta confirmada; a confirmação é pré-requisito.
- A revogação das sessões anteriores e a criação da nova sessão são atômicas; após o sucesso, apenas a nova sessão é válida.
- Cada sign-in bem-sucedido envia um e-mail de nova sessão en-US, com data/hora e alerta para alterar a senha se a pessoa não reconhecer o acesso.
- O JWT e o cookie seguem o mesmo contrato da fatia 002: `sub`, `sid`, `iat`, `exp`; cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`.
- A API é a fonte de verdade da sessão; o redirecionamento do web é apenas experiência.
- `returnTo` só aceita caminhos internos que comecem com `/app/`; qualquer outro valor é descartado.
- Rate limiting é aplicado por e-mail e/ou IP, com limites configuráveis; não há lockout permanente nesta entrega.
- `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` são públicas para quem não tem sessão; com sessão válida, redirecionam para `/app`.
- `/app/*` é privado; a raiz `/` escolhe entre `/app` e `/auth/sign-in`.
- Nenhum token, JWT, senha ou PII é registrado em logs, traces ou métricas.
- A UI é light-only, acessível e responsiva em 360 px, 768 px e 1280 px.

## 8. Dados e contratos

### `POST /api/v1/auth/sign-in`

```json
{
  "email": "ada@example.com",
  "password": "correct horse battery staple"
}
```

Respostas previstas:

- `200` — `{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 604800, "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }`
- `401` — credenciais inválidas, com mensagem genérica e `code` como `INVALID_CREDENTIALS`.
- `403` — e-mail não confirmado, com `code` como `EMAIL_NOT_CONFIRMED`.
- `429` — excesso de tentativas.
- `500` — falha interna sem detalhes.

### `GET /api/v1/auth/me`

- Reutiliza o contrato da fatia 002 para validar a sessão e obter os dados da pessoa.

### Sessão e cookie

- A nova sessão revoga todas as sessões ativas anteriores da mesma pessoa.
- `sessions` registra a origem `sign_in` para novas sessões de sign-in.
- O cookie é gravado pelo web; a API só aceita `Authorization: Bearer`.
- A duração da sessão é a mesma da fatia 002 (padrão de 7 dias, configurável).

### E-mail

- Assunto: “New session on your account”.
- Corpo en-US com data/hora do acesso e alerta para alterar a senha se a pessoa não reconhecer a sessão.
- O link de recuperação será adicionado na fatia 007.
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local.

### Navegação

- `/` com sessão válida → `/app`.
- `/` sem sessão → `/auth/sign-in`.
- `/app/*` sem sessão → `/auth/sign-in?returnTo=<caminho interno>`.
- `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` com sessão válida → `/app`.
- `/auth/forgot-password` e `/auth/reset-password` permanecem acessíveis com sessão.

## 9. Permissões e segurança

- `/auth/sign-in` e o endpoint de sign-in são públicos; não exigem sessão.
- `/app/*` exige JWT válido e sessão ativa; a API valida em todas as chamadas protegidas.
- Credenciais inválidas não revelam existência de conta; a mensagem é genérica.
- O sign-in de conta não confirmada não cria sessão.
- Rate limiting reduz força bruta; não há lockout permanente nesta entrega.
- A sessão única é garantida pela revogação atômica das sessões anteriores.
- O JWT é assinado pela API e fica em cookie `HttpOnly`; o JavaScript não lê o token.
- A combinação `SameSite=Lax`, verificação de origem e proteção de CSRF reduz risco em navegação cross-site.
- `returnTo` é validado para impedir open redirect.
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

| Dependência ou risco                         | Impacto                                                              | Mitigação                                                           | Dono       |
| -------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| Spec 005 (conta confirmada e sessão inicial) | Sem ela não há conta confirmada para entrar                          | Implementar na ordem do mapa                                        | Engenharia |
| Spec 002 (sessão, JWT, cookie e e-mail)      | Sem ela não há sessão para criar                                     | Reutilizar os casos de uso e o template                             | Engenharia |
| Hash de senha e verificação                  | Falha pode bloquear pessoas legítimas ou aceitar credenciais erradas | Testes de unidade e integração com casos de senha correta/incorreta | Engenharia |
| Revogação concorrente                        | Duas sessões podem ficar ativas                                      | Transação e verificação de sessão ativa                             | Engenharia |
| Força bruta                                  | Tentativas ilimitadas comprometem contas                             | Rate limiting configurável e mensagens genéricas                    | Engenharia |
| E-mail de nova sessão                        | Falha de entrega não pode bloquear o acesso                          | Sessão permanece válida e falha é registrada sem PII                | Engenharia |
| Open redirect via `returnTo`                 | Redirecionamento para domínio malicioso                              | Aceitar apenas caminhos internos de `/app/`                         | Engenharia |
| Sem sign-out/refresh                         | Sessão só termina por expiração ou nova sessão                       | Registrar como decisão aberta e fora do épico                       | Produto    |
| Banco de testes para integração              | Testes de sessão podem ficar frágeis                                 | Definir Postgres descartável ou repositório fake                    | Engenharia |

## 12. Rollout e migração

- Não há nova tabela nesta fatia; a tabela de sessões da fatia 001 passa a registrar a origem `sign_in`.
- O placeholder de `/auth/sign-in` é substituído pela página real.
- A raiz `/` muda de `/auth/sign-up` para `/app` ou `/auth/sign-in`, conforme a sessão.
- `/app/*` passa a redirecionar para `/auth/sign-in` em vez de `/auth/sign-up`.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; sessões continuam descartáveis no ambiente local.
- Comunicação: atualizar `.docs`, testes e documentação de navegação na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** validação de credenciais; mensagem genérica; conta não confirmada; revogação de sessões; validação de `returnTo`; rate limit; claims e expiração do JWT.
- **Integração:** `POST /api/v1/auth/sign-in` com sucesso, senha incorreta, e-mail inexistente, conta não confirmada, rate limit e falha de e-mail; `GET /api/v1/auth/me` com JWT novo e antigo; revogação da sessão anterior; ausência de PII/token nos logs.
- **E2E (Playwright):** sign-up/confirmação/sign-in; segundo contexto de navegador invalidando o primeiro; acesso a `/app` sem sessão e retorno ao caminho após login; raiz `/` com e sem sessão; conta não confirmada; erro genérico de credencial.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US, inspeção do e-mail de nova sessão e do cookie no navegador.
- **Dados de teste:** contas confirmadas e não confirmadas, e-mails únicos por execução; nenhum dado real.

## 14. Critérios de aceite

- [ ] Dada uma conta confirmada com e-mail e senha válidos, quando a pessoa entra em `/auth/sign-in`, então uma nova sessão é criada, ela é redirecionada para `/app` e recebe o e-mail de nova sessão.
- [ ] Dados e-mail inexistente, senha incorreta ou conta inexistente, quando alguém tenta entrar, então a API responde `401` com a mesma mensagem genérica, nenhuma sessão é criada e nenhum e-mail é enviado.
- [ ] Dada uma conta não confirmada, quando alguém tenta entrar, então a API responde `403`, nenhuma sessão é criada e a pessoa recebe orientação para confirmar o e-mail.
- [ ] Dada uma sessão ativa em um dispositivo, quando a mesma pessoa entra em outro dispositivo, então a sessão anterior é revogada, apenas a nova acessa `/app` e um novo e-mail de nova sessão é enviado.
- [ ] Dado um acesso a `/app/*` sem sessão, quando a pessoa é redirecionada, então vai para `/auth/sign-in?returnTo=<caminho>` e, após entrar, retorna ao caminho interno solicitado; valores externos ou inválidos caem em `/app`.
- [ ] Dada a raiz `/`, quando há sessão válida, então redireciona para `/app`; quando não há, redireciona para `/auth/sign-in`; pessoas autenticadas em `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm` vão para `/app`.
- [ ] Dado o fluxo de sign-in, quando a segurança é verificada, então há rate limiting, mensagens genéricas, JWT/cookie no contrato da fatia 002 e nenhum token, senha ou PII em logs.

## 15. Decisões e questões abertas

| Tema                            | Decisão ou pergunta                                                         | Impacto                                      | Dono               | Status                  |
| ------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- | ------------------ | ----------------------- |
| Sessão única                    | Cada sign-in revoga todas as sessões anteriores                             | Garante “última sessão vence”                | Produto/Engenharia | fechada (2026-11-09)    |
| Mensagem de credencial inválida | Mesma resposta para e-mail inexistente, senha incorreta e conta inexistente | Evita enumeração de contas                   | Produto/Segurança  | fechada (2026-11-09)    |
| Conta não confirmada            | `403` com orientação para confirmar; sem sessão                             | Evita acesso antes da confirmação            | Produto/Engenharia | fechada (2026-11-09)    |
| `returnTo`                      | Apenas caminhos internos de `/app/`                                         | Evita open redirect                          | Engenharia         | fechada (2026-11-09)    |
| Link de recuperação             | “Forgot password?” aponta para `/auth/forgot-password` da fatia 007         | Mantém o fluxo de recuperação no lugar certo | Produto/Engenharia | fechada (2026-11-09)    |
| Destino do guard                | `/app/*` sem sessão → `/auth/sign-in`                                       | Substitui o destino provisório da fatia 003  | Engenharia         | fechada (2026-11-09)    |
| Rate limiting                   | Limites configuráveis por e-mail e/ou IP; sem lockout permanente            | Reduz força bruta sem bloquear contas        | Engenharia         | aberta (não bloqueante) |
| Sign-out                        | Fora do épico                                                               | Sessão termina por expiração ou nova sessão  | Produto            | aberta (não bloqueante) |
| Refresh token                   | Fora do épico; ao expirar, novo sign-in                                     | Evita complexidade de rotação                | Produto/Engenharia | aberta (não bloqueante) |
| Banco de testes                 | Postgres descartável ou repositório fake                                    | Afeta testes de integração e E2E             | Engenharia         | aberta (não bloqueante) |
