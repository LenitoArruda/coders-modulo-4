# Auth session — Spec

> **Status:** done
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`
> **Plano:** `.plans/002-auth-session-plan.md`

## 1. Contexto e problema

A fatia 001 cria as tabelas de usuários, tokens e sessões, mas ainda não existe uma forma de emitir, validar ou revogar uma sessão. Sem isso, confirmação de conta e sign-in não conseguem autenticar ninguém, e `/app/*` não tem como distinguir uma pessoa autenticada de um visitante.

Esta fatia entrega a infraestrutura de sessão compartilhada: JWT assinado pela API, registro de sessão no banco, revogação, cookie `HttpOnly` no web, endpoint `GET /api/v1/auth/me`, contrato de erro da API e a porta/template do e-mail de nova sessão. Ela também introduz o namespace versionado `/api/v1` e migra o hello world para `/api/v1/hello`.

## 2. Usuários e jobs

| Usuário                  | Job                                                                                             | Frequência        |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ----------------- |
| Pessoa autenticada       | Ter uma sessão válida, acessar seus dados básicos e saber que apenas a sessão mais recente vale | A cada acesso     |
| Pessoa com sessão antiga | Ter a sessão anterior revogada quando uma nova é criada                                         | Eventual          |
| Desenvolvedor(a)         | Criar, validar e revogar sessões de forma previsível e reutilizável pelas fatias seguintes      | A cada integração |
| Engenharia de segurança  | Garantir que JWT, token e cookie não vazem para o JavaScript ou para logs                       | Eventual          |

Permissões: `GET /api/v1/auth/me` exige `Authorization: Bearer` com JWT válido e sessão ativa. Não há endpoint público de criação de sessão nesta fatia; confirmação (005) e sign-in (006) usam o caso de uso interno.

## 3. Resultado esperado

A API consegue criar uma sessão para um usuário, assinar um JWT com `sub`, `sid`, `iat` e `exp`, revogar todas as sessões ativas anteriores da mesma pessoa e validar a sessão em `GET /api/v1/auth/me`. O web consegue gravar o JWT em cookie `HttpOnly` e encaminhá-lo como `Authorization: Bearer` sem expor o token ao JavaScript.

A API passa a responder apenas em `/api/v1/*`; `GET /` deixa de existir e `GET /api/v1/hello` mantém o contrato `{ "message": "Hello World" }`. O template de e-mail de nova sessão fica disponível para ser disparado por confirmação e sign-in.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de sessão.

## 5. Escopo

### Dentro

- Caso de uso interno de criação de sessão, com `origin` (`sign_up_confirmation` ou `sign_in`).
- Assinatura e validação de JWT com `sub`, `sid`, `iat` e `exp`.
- Consulta de sessão ativa a cada requisição autenticada; assinatura válida não basta se a sessão estiver revogada ou expirada.
- Política de sessão única: ao criar uma nova sessão, revogar todas as sessões ativas anteriores da mesma pessoa.
- Endpoint `GET /api/v1/auth/me`.
- Cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/` e `Max-Age` igual à duração da sessão.
- Ponte de sessão no web que lê o cookie e encaminha `Authorization: Bearer` para a API.
- Contrato de erro padrão da API, com `code`, `message` e `fieldErrors` quando aplicável, sem detalhes internos.
- Porta de e-mail e template en-US de nova sessão, com data/hora e alerta para alterar a senha se a pessoa não reconhecer o acesso.
- Prefixo global `/api/v1`, remoção de `GET /` e hello em `GET /api/v1/hello`.
- Variáveis de ambiente para segredo do JWT, TTL da sessão e SMTP local.
- ADR de auth própria com JWT, sessão no servidor e cookie `HttpOnly`.
- Testes e documentação afetada.

### Fora

- Página de confirmação, consumo de token de confirmação e primeira sessão; isso entra na fatia 005.
- Sign-in, revogação por novo login e redirecionamento de `/app/*` para `/auth/sign-in`; isso entra na fatia 006.
- Forgot-password e reset-password; isso entra nas fatias 007 e 008.
- Rotas web, layouts, guard e redirecionamentos; isso entra na fatia 003.
- Sign-out, refresh token, “remember me”, MFA, SSO e login social.
- Gestão de dispositivos/sessões pelo usuário, lista de sessões e encerramento remoto manual.
- Provedor de e-mail de produção e garantias avançadas de deliverability.

## 6. Fluxos

### Fluxo principal — criar e validar sessão

1. Um caso de uso interno recebe o usuário e a origem da sessão.
2. A API revoga todas as sessões ativas anteriores da mesma pessoa.
3. A API cria a nova sessão com expiração padrão de 7 dias, configura do ambiente.
4. A API assina o JWT com `sub`, `sid`, `iat` e `exp`.
5. A API dispara o e-mail de nova sessão pela porta de e-mail.
6. O web grava o JWT em cookie `HttpOnly` e encaminha `Authorization: Bearer` nas chamadas à API.
7. A API valida a assinatura, a expiração e a existência de sessão ativa com o `sid`.
8. `GET /api/v1/auth/me` devolve os dados básicos da pessoa autenticada.

### Fluxos alternativos e de exceção

- JWT ausente, inválido, expirado ou com assinatura inválida: a API responde `401`.
- `sid` inexistente, revogado ou expirado: a API responde `401`, mesmo que a assinatura seja válida.
- Nova sessão criada: todas as anteriores são revogadas; apenas a nova acessa endpoints protegidos.
- Falha ao enviar o e-mail de nova sessão: a sessão continua válida, a falha é registrada sem PII e o fluxo não é bloqueado.
- Falha ao criar a sessão no banco: nenhum cookie é gravado e o erro é retornado sem detalhes internos.
- Cookie ausente no web: a ponte não envia `Authorization` e a API responde `401` em endpoints protegidos.

## 7. Regras e casos de borda

- O JWT é assinado pela API e contém apenas `sub`, `sid`, `iat` e `exp`; nenhum dado sensível ou PII desnecessária é colocado no token.
- A API valida a assinatura, a expiração e a sessão ativa em toda requisição protegida.
- A revogação de sessões anteriores e a criação da nova sessão são atômicas; após o sucesso, apenas a nova sessão é válida.
- Sessões revogadas ou expiradas não podem ser reativadas; é necessário criar uma nova sessão.
- O cookie é `HttpOnly`, `Secure` em produção, `SameSite=Lax`, com `Path=/` e `Max-Age` igual à duração da sessão.
- O JavaScript do navegador não lê o token; o cookie é acessível apenas pelo servidor do web.
- O navegador não chama a API de auth diretamente com o cookie; o servidor do web lê o cookie e encaminha `Authorization: Bearer`.
- Requisições de mudança de estado feitas pelo web exigem proteção de mesma origem/CSRF.
- O e-mail de nova sessão é en-US, informa a data/hora e alerta para alterar a senha se a pessoa não reconhecer o acesso.
- O link de recuperação de senha é adicionado ao template na fatia 007, quando a página existir.
- A API responde apenas em `/api/v1/*`; `GET /` deixa de existir e `GET /api/v1/hello` mantém o contrato atual.
- Nenhum token, JWT, senha ou PII é registrado em logs, traces ou métricas.
- A duração padrão da sessão é de 7 dias, configurável; a decisão final está aberta na seção 15.

## 8. Dados e contratos

### `GET /api/v1/auth/me`

- Requer `Authorization: Bearer <jwt>`.
- `200` — `{ "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }`
- `401` — JWT ausente, inválido, expirado ou sessão revogada.

### `GET /api/v1/hello`

- `200` — `{ "message": "Hello World" }`
- É o único hello world da API; `GET /` deixa de existir.

### JWT e sessão

- Claims: `sub` (user id), `sid` (session id), `iat`, `exp`.
- `sessions`: identificador, user_id, origin, created_at, expires_at e revoked_at.
- A API consulta a sessão ativa em toda requisição autenticada.
- O cookie é gravado pelo web, não pela API. A API só aceita `Authorization: Bearer`.
- A duração padrão é de 7 dias, configurável.

### Cookie

- Nome definido no plano, sem expor o token em JavaScript.
- `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`.
- `Max-Age` igual à duração da sessão.
- A ponte do web lê o cookie no servidor e monta o header `Authorization: Bearer`.

### E-mail de nova sessão

- Assunto: “New session on your account”.
- Corpo en-US com data/hora do acesso e alerta para alterar a senha se a pessoa não reconhecer a sessão.
- Sem link de recuperação nesta fatia; a fatia 007 adiciona o link.
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local.

### Contrato de erro

```json
{
  "code": "UNAUTHORIZED",
  "message": "Your session is invalid or has expired. Sign in again."
}
```

- `fieldErrors` é usado em erros de validação das fatias seguintes.
- O contrato não expõe stack trace, SQL, nomes de tabelas ou detalhes internos.

### Configuração

- Variáveis de ambiente para segredo de assinatura do JWT, TTL da sessão, conexão com banco, origem do web e SMTP local.
- O segredo do JWT não é versionado e precisa ter tamanho mínimo definido no plano.
- Nenhum token ou segredo aparece em `.env.example` com valor real.

## 9. Permissões e segurança

- `GET /api/v1/auth/me` exige JWT válido e sessão ativa; a API é a fonte de verdade.
- O token fica em cookie `HttpOnly`, fora do alcance do JavaScript, reduzindo risco de XSS.
- A combinação `SameSite=Lax`, verificação de origem e proteção de CSRF reduz risco em navegação cross-site.
- A sessão revogada é rejeitada imediatamente, mesmo que o JWT ainda não tenha expirado.
- O JWT não contém PII além do identificador interno; nome e e-mail vêm de `/me`.
- Senhas, tokens e JWT nunca aparecem em logs, traces, métricas ou mensagens de erro.
- A API não expõe detalhes internos em erros e não permite acesso direto do navegador às tabelas de auth.

## 10. Requisitos não funcionais

- `GET /api/v1/auth/me` responde em até 500 ms p95 no ambiente local.
- A validação de sessão não adiciona mais de 300 ms ao carregamento inicial local.
- A criação e a revogação de sessão são consistentes sob concorrência: duas criações simultâneas não podem deixar duas sessões válidas.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou JWT.
- O template de e-mail é en-US e funciona na caixa local do Supabase.
- O contrato de erro é estável e reutilizável pelas fatias 003 a 008.

## 11. Dependências e riscos

| Dependência ou risco                            | Impacto                                            | Mitigação                                                    | Dono       |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ---------- |
| Spec 001 (schema de usuários, tokens e sessões) | Sem ela não há onde persistir sessão               | Implementar 001 antes e reutilizar as tabelas                | Engenharia |
| Segredo do JWT                                  | Segredo fraco ou vazado compromete sessões         | Validar no boot, não versionar e documentar rotação          | Engenharia |
| Cookie entre web e API                          | Configuração errada quebra a navegação autenticada | Definir o web como camada que lê o cookie e encaminha Bearer | Engenharia |
| Concorrência na revogação                       | Duas sessões podem ficar ativas                    | Transação e verificação de sessão ativa                      | Engenharia |
| E-mail de nova sessão                           | Falha de entrega não pode bloquear o acesso        | Sessão permanece válida e falha é registrada sem PII         | Engenharia |
| API versionada                                  | `GET /` atual quebra                               | Atualizar testes, E2E e documentação para `/api/v1/hello`    | Engenharia |
| Sem sign-out/refresh                            | Sessão só termina por expiração ou nova sessão     | Registrar como decisão aberta e fora do épico                | Produto    |
| Banco de testes para integração                 | Testes de sessão podem ficar frágeis               | Definir Postgres descartável ou repositório fake             | Engenharia |

## 12. Rollout e migração

- Usa as tabelas criadas na fatia 001; não há nova migração de schema nesta fatia.
- A API passa a responder em `/api/v1/*`; `GET /` é removido e o hello migra para `/api/v1/hello`.
- O cookie e a ponte de sessão passam a existir no web, mas ainda não há fluxo público que crie sessão até a fatia 005.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; sessões são descartáveis no ambiente local.
- Comunicação: atualizar `.env.example`, `.docs/ARCHITECTURE.md` e `.docs/DEVELOPMENT.md` na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** claims e expiração do JWT; validação de assinatura; sessão ativa/revogada/expirada; política de sessão única; atributos do cookie; template de e-mail.
- **Integração:** `GET /api/v1/auth/me` com JWT válido, ausente, inválido, expirado e revogado; criação de sessão revogando as anteriores; `GET /api/v1/hello`; `GET /` retornando `404`; contrato de erro.
- **Web:** ponte de sessão lê o cookie e monta `Authorization: Bearer`; sem cookie, não monta header; o token não aparece no JavaScript.
- **E-mail:** template en-US e conteúdo com data/hora; falha de envio não bloqueia a sessão.
- **Manual:** inspecionar o cookie no navegador, confirmar `HttpOnly` e `SameSite=Lax`, e verificar ausência de token/PII nos logs.

## 14. Critérios de aceite

- [x] Dado um usuário válido, quando uma sessão é criada, então a API assina um JWT com `sub`, `sid`, `iat` e `exp` e persiste a sessão com `origin` e expiração.
- [x] Dado um JWT válido com sessão ativa, quando `GET /api/v1/auth/me` é chamado, então a API responde `200` com os dados básicos da pessoa.
- [x] Dado um JWT ausente, inválido, expirado ou com sessão revogada, quando `GET /api/v1/auth/me` é chamado, então a API responde `401` sem detalhes internos.
- [x] Dada uma sessão ativa anterior, quando uma nova sessão é criada, então a anterior é revogada e apenas a nova é aceita.
- [x] Dada a criação de uma sessão, quando o fluxo termina, então o e-mail de nova sessão en-US é disparado com data/hora e sem link de recuperação nesta fatia.
- [x] Dado o cookie de sessão, quando ele é inspecionado no navegador, então é `HttpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/` e inacessível ao JavaScript.
- [x] Dada a API, quando os endpoints são chamados, então o hello está em `GET /api/v1/hello`, `GET /` não existe, o contrato de erro é estável e nenhum token, JWT ou PII aparece em logs.

> A inspeção do cookie no navegador depende de um fluxo público que grave o cookie (fatias 005/006);
> nesta fatia as opções são garantidas por teste unitário e a limitação está registrada em `QA.md`.

## 15. Decisões e questões abertas

| Tema                           | Decisão ou pergunta                                                       | Impacto                                                      | Dono               | Status                  |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------ | ----------------------- |
| Emissor do JWT                 | API NestJS própria                                                        | Mantém sessão única, revogação e e-mails sob controle da API | Engenharia         | fechada (2026-11-09)    |
| Transporte no web              | Cookie `HttpOnly` no web + `Authorization: Bearer` na API                 | Protege o token contra XSS e permite proteção SSR            | Engenharia         | fechada (2026-11-09)    |
| Sessão única                   | Toda nova sessão revoga as anteriores e envia e-mail                      | Atende ao requisito de “última sessão vence”                 | Produto/Engenharia | fechada (2026-11-09)    |
| Namespace da API               | `/api/v1` nasce nesta fatia com `/api/v1/auth/me` e `/api/v1/hello`       | Evita dependência circular com a fatia de rotas              | Engenharia         | fechada (2026-11-09)    |
| TTL da sessão                  | 7 dias, configurável                                                      | Define expiração e frequência de novo login                  | Engenharia         | fechada (2026-11-09)    |
| Refresh token                  | Fora do épico; ao expirar, novo sign-in                                   | Evita complexidade de rotação nesta entrega                  | Produto/Engenharia | aberta (não bloqueante) |
| Sign-out                       | Fora do épico                                                             | Sessão termina por expiração ou nova sessão                  | Produto            | aberta (não bloqueante) |
| Falha no e-mail de nova sessão | Sessão permanece válida; falha é registrada                               | Evita bloquear o acesso por falha de e-mail                  | Engenharia         | fechada (default)       |
| Link de recuperação no e-mail  | Adicionado na fatia 007                                                   | Evita link quebrado antes da página existir                  | Produto/Engenharia | fechada (2026-11-09)    |
| Banco de testes                | Repositórios fake na integração; banco real coberto por QA manual + pgTAP | Evita infra de banco descartável nesta fatia                 | Engenharia         | fechada (2026-11-09)    |
