# Breakdown — Autenticação completa

> **Prompt original:** Fluxo de autenticação com sign-up, confirmação de conta, sign-in com sessão única, esqueci a senha e reset de senha; páginas públicas em `/auth/*`, privadas em `/app/*`, API versionada em `/api/v1/*` e páginas, endpoints, código, UI e e-mails em en-US.
> **Criado em:** 2026-11-09
> **Status:** approved
> **Primeira spec:** `.specs/001-auth-schema.md`

## 1. Resultado do épico

Uma pessoa consegue criar conta, confirmar o e-mail, entrar na plataforma, manter apenas a sessão mais recente, recuperar a senha e acessar a área privada em `/app/*`. Todas as telas de autenticação ficam em `/auth/*`, os endpoints de auth em `/api/v1/auth/*` e a experiência visível (UI e e-mails) usa en-US.

Decisões transversais já fechadas com o usuário em 2026-11-09:

- **Auth própria na API NestJS**, com JWT assinado pela API e sessões controladas no banco.
- **JWT Bearer** trafega em cookie `HttpOnly` no web; o servidor do web o encaminha como `Authorization: Bearer` para a API. O navegador não expõe o token ao JavaScript.
- **Sessão única:** toda nova sessão invalida as anteriores e envia e-mail de nova sessão.
- **Reset de senha revoga todas as sessões ativas.**
- **en-US** em código, rotas, endpoints, UI e e-mails transacionais. A documentação interna do repositório continua em PT-BR, salvo decisão contrária.
- **Corte em 8 fatias**, alinhado à estrutura vista na aula: `auth-schema`, `auth-session`, `auth-routes`, `sign-up`, `confirm-account`, `sign-in`, `forgot-password` e `reset-password`.

## 2. Fora do épico

- MFA, SSO, login social, passkeys e “remember me”.
- Refresh token e renovação automática de sessão; ao expirar, a pessoa faz sign-in novamente.
- Sign-out e encerramento manual de sessão.
- Reenvio dedicado de confirmação de conta como fluxo separado (o sign-up de e-mail ainda não confirmado reenvia a confirmação).
- Troca de e-mail, exclusão de conta, edição de perfil e gestão de dispositivos/sessões.
- Multi-tenancy, workspace, convites e permissões por papel.
- Painel administrativo, auditoria detalhada e notificações de segurança além de “nova sessão” e “senha alterada”.
- Rate limiting distribuído; esta entrega usa proteção básica por instância e por banco.
- Deploy, CI, `apps/docs`, i18n com seletor de locale e tradução de telas fora de autenticação/área inicial de `/app`.

## 3. Fatias e ordem de implementação

| Ordem | Spec                                 | Capacidade entregue                                                                                                                                                  | Depende de              | Status   |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------- |
| 1     | `.specs/001-auth-schema.md`          | Modelo de dados de auth: usuários, tokens opacos e sessões, com constraints, índices e migrações                                                                     | -                       | done     |
| 2     | `.specs/002-auth-session.md`         | JWT de sessão, registro/revogação de sessão, cookie `HttpOnly`, `GET /api/v1/auth/me`, porta de e-mail e template de nova sessão; introduz `/api/v1` e migra o hello | 001                     | approved |
| 3     | `.specs/003-auth-routes.md`          | Grupos de rota `/auth/*` e `/app/*`, layouts, guard, redirecionamentos, CORS e documentação da convenção en-US                                                       | 001, 002                | approved |
| 4     | `.specs/004-auth-sign-up.md`         | Criar conta não confirmada, validar dados, persistir usuário e enviar e-mail de confirmação com token                                                                | 001, 002, 003           | approved |
| 5     | `.specs/005-auth-confirm-account.md` | Confirmar conta por token, criar a primeira sessão, enviar e-mail de nova sessão e liberar `/app`                                                                    | 001, 002, 003, 004      | approved |
| 6     | `.specs/006-auth-sign-in.md`         | Entrar com e-mail e senha, revogar sessões anteriores, enviar e-mail de nova sessão, redirecionar para `/app` e proteger `/app/*` com o sign-in                      | 001, 002, 003, 005      | approved |
| 7     | `.specs/007-auth-forgot-password.md` | Solicitar reset sem revelar existência da conta, emitir token de uso único e enviar e-mail de recuperação                                                            | 001, 002, 003, 004      | approved |
| 8     | `.specs/008-auth-reset-password.md`  | Validar token, definir nova senha, revogar sessões, enviar e-mail de sucesso e voltar ao sign-in                                                                     | 001, 002, 003, 006, 007 | approved |

Status da fatia: `draft` (criada), `existing` (reutilizada) ou `planned` (ainda não criada).

### Observação sobre o corte

As três primeiras fatias são fundações compartilhadas, como no corte da aula. Para não criar dependência circular, o namespace `/api/v1` nasce em `002-auth-session`, junto com o primeiro endpoint autenticado (`GET /api/v1/auth/me`). `003-auth-routes` cuida do roteamento web, guard e redirecionamentos. As fatias `004` a `008` entregam os fluxos observáveis de ponta a ponta.

## 4. Grafo de dependências

```text
001 → 002 → 003 → 004 → 005 → 006 → 008
                   └────→ 007 ───────→ 008
```

- `001` não depende de nenhuma spec de feature.
- `002` depende do schema de usuários, tokens e sessões de `001`.
- `003` depende da validação de sessão de `002`.
- `004` depende do schema (`001`), da porta de e-mail (`002`) e das rotas (`003`).
- `005` depende do sign-up (`004`), do token e do usuário (`001`), da sessão (`002`) e das rotas (`003`).
- `006` depende da conta confirmada (`005`), da sessão (`002`) e das rotas (`003`).
- `007` depende do usuário (`004`), da porta de e-mail (`002`) e das rotas (`003`).
- `008` depende do token de reset (`007`), da revogação de sessão (`002`), da rota de sign-in (`006`) e das rotas (`003`).

## 5. Fundação compartilhada

| Fundação                                                                                             | Introduzida em | Reutilizada por |
| ---------------------------------------------------------------------------------------------------- | -------------- | --------------- |
| Schema de usuários, tokens opacos e sessões                                                          | 001            | 002–008         |
| JWT, sessão, revogação, cookie `HttpOnly`, `GET /api/v1/auth/me`, contrato de erro e porta de e-mail | 002            | 003–008         |
| Template de e-mail de nova sessão                                                                    | 002            | 005, 006        |
| Grupos de rota `/auth/*` e `/app/*`, layouts, guard, redirecionamentos, CORS e convenção en-US       | 003            | 004–008         |
| Template de e-mail de confirmação                                                                    | 004            | 005             |
| Fluxo de confirmação e primeira sessão                                                               | 005            | 006             |
| Sign-in e sessão única                                                                               | 006            | 008             |
| Template e token de reset de senha                                                                   | 007            | 008             |

## 6. Decisões abertas

| Tema                                                                    | Pergunta                                                                                                | Impacto                                                                | Dono               | Status                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------ | ----------------------- |
| Corte do épico                                                          | 8 fatias: schema, session, routes, sign-up, confirm-account, sign-in, forgot-password e reset-password  | Alinha a entrega com a estrutura da aula                               | Produto/Engenharia | fechada (2026-11-09)    |
| Motor de auth                                                           | Auth própria na API NestJS com JWT Bearer e sessão no banco                                             | Define todo o desenho de sessão, e-mail e recuperação                  | Engenharia         | fechada (2026-11-09)    |
| Idioma                                                                  | UI, e-mails, rotas, endpoints e código em en-US; docs internas em PT-BR                                 | Afeta todas as telas e a documentação de convenções                    | Produto/Engenharia | fechada (2026-11-09)    |
| Sessão única                                                            | Toda nova sessão invalida as anteriores e envia e-mail; reset revoga todas                              | Afeta 005, 006 e 008 e os critérios de aceite de segurança             | Produto/Engenharia | fechada (2026-11-09)    |
| TTL da sessão JWT                                                       | Qual duração padrão? Proposta: 7 dias, configurável por ambiente                                        | Equilíbrio entre segurança e retrabalho de login                       | Engenharia         | aberta (não bloqueante) |
| Refresh token                                                           | Fora do épico; ao expirar, a pessoa faz sign-in novamente                                               | Evita endpoint e rotação de refresh token nesta entrega                | Produto/Engenharia | aberta (não bloqueante) |
| Sign-out                                                                | Fora do épico; a sessão termina por expiração ou por nova sessão                                        | Usuário não encerra sessão manualmente nesta entrega                   | Produto            | aberta (não bloqueante) |
| Política de senha                                                       | Proposta: mínimo 8 e máximo 128 caracteres, sem exigência de composição                                 | Afeta validação de sign-up e reset                                     | Produto/Segurança  | aberta (não bloqueante) |
| TTL dos tokens                                                          | Confirmação: 24 h. Reset: 1 h. Uso único e hash em repouso                                              | Define expiração e casos de erro                                       | Engenharia         | fechada (default)       |
| Provedor de e-mail                                                      | SMTP local (caixa de e-mail do Supabase local) em dev; produção a definir                               | Define configuração de ambiente e entrega real                         | Engenharia         | aberta (não bloqueante) |
| Banco de testes                                                         | Postgres descartável via Supabase local ou repositório fake nos testes                                  | Afeta integração de API e Playwright                                   | Engenharia         | aberta (não bloqueante) |
| E-mail duplicado no sign-up                                             | E-mail confirmado: 409 sem duplicar. E-mail não confirmado: reenvia confirmação e responde 200 genérico | Evita conta bloqueada sem confirmação                                  | Produto/Segurança  | fechada (2026-11-09)    |
| Conta não confirmada no reset                                           | O reset bem-sucedido também confirma o e-mail; a solicitação continua com resposta genérica             | Evita pessoa sem acesso após trocar a senha                            | Produto/Engenharia | fechada (default)       |
| Resend de confirmação                                                   | Coberto pelo sign-up com e-mail não confirmado; fluxo dedicado fica fora                                | Evita tela extra nesta entrega                                         | Produto            | fechada (2026-11-09)    |
| Acesso autenticado a `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` | Redireciona para `/app`; `/auth/forgot-password` e `/auth/reset-password` continuam acessíveis          | Evita telas de auth para quem já tem sessão sem bloquear a recuperação | Produto            | fechada (2026-11-09)    |
| Conta não confirmada no sign-in                                         | `403` com orientação para confirmar o e-mail; nenhuma sessão é criada                                   | Evita acesso antes da confirmação                                      | Produto/Engenharia | fechada (2026-11-09)    |
| `returnTo`                                                              | Apenas caminhos internos de `/app/`                                                                     | Evita open redirect                                                    | Engenharia         | fechada (2026-11-09)    |
| Rate limiting                                                           | Limites por e-mail/IP e janela configuráveis; sem lockout permanente                                    | Define proteção contra força bruta e abuso                             | Engenharia         | aberta (não bloqueante) |
| Raiz `/`                                                                | Sessão válida → `/app`; sem sessão → `/auth/sign-in` após 006 e `/auth/sign-up` antes disso             | Define o primeiro redirecionamento do produto                          | Produto            | fechada (2026-11-09)    |
| Versionamento da API                                                    | Tudo em `/api/v1/*`; hello passa a `/api/v1/hello`                                                      | Quebra o `GET /` atual e exige atualizar testes/docs                   | Engenharia         | fechada (2026-11-09)    |

## 7. Histórico

- 2026-11-09 — breakdown criado; decisões de motor de auth, idioma e política de sessão registradas com o usuário.
- 2026-11-09 — revisão de consistência: reset de conta não confirmada confirmado, redirecionamento de `/auth/*` delimitado e decisões de `returnTo`, sign-in não confirmado e rate limiting registradas.
- 2026-11-09 — reestruturado para as 8 fatias da aula: auth-schema, auth-session, auth-routes, sign-up, confirm-account, sign-in, forgot-password e reset-password. As 4 specs consolidadas foram substituídas.
- 2026-11-09 — corte com 8 specs aprovado; todas as specs e o mapa passam para `approved`.
