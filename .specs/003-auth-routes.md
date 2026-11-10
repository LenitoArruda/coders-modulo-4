# Auth routes — Spec

> **Status:** done
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`
> **Plano:** `.plans/003-auth-routes-plan.md` (a criar pelo `implement-me`)

## 1. Contexto e problema

As fatias 001 e 002 entregam schema e sessão, mas o produto ainda não tem separação entre páginas públicas e privadas. Hoje o web exibe uma página de demonstração na raiz e a API expõe um hello world sem versionamento. Sem grupos de rota, guard e redirecionamentos, as telas de sign-up, confirmação, sign-in e recuperação não têm onde viver e `/app/*` não pode ser protegido.

Esta fatia cria o esqueleto de navegação do épico: `/auth/*` público, `/app/*` privado, layouts, guard, redirecionamentos, CORS e a convenção de idioma en-US documentada. As telas reais são substituídas pelas fatias 004 a 008.

## 2. Usuários e jobs

| Usuário                     | Job                                                                         | Frequência        |
| --------------------------- | --------------------------------------------------------------------------- | ----------------- |
| Visitante                   | Abrir uma página de autenticação pública e ser direcionado ao fluxo correto | A cada acesso     |
| Pessoa autenticada          | Acessar a área privada e não ver telas de autenticação desnecessárias       | A cada acesso     |
| Pessoa que esqueceu a senha | Conseguir abrir a recuperação mesmo com sessão ativa                        | Eventual          |
| Desenvolvedor(a)            | Saber onde criar páginas e endpoints e como o guard se comporta             | A cada integração |

Permissões: `/auth/*` é público. `/app/*` exige sessão válida. Nesta fatia, sem sessão, `/app/*` redireciona para `/auth/sign-up`; a fatia 006 troca o destino para `/auth/sign-in`.

## 3. Resultado esperado

O web passa a ter um grupo público `/auth/*` com layout de autenticação e páginas placeholder para sign-up, sign-in, confirmação, forgot-password e reset-password, além de um grupo privado `/app/*` com shell e página inicial placeholder. A raiz `/` redireciona para `/app` quando há sessão válida e para `/auth/sign-up` quando não há.

Pessoas autenticadas que abrem `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm` são enviadas para `/app`; `/auth/forgot-password` e `/auth/reset-password` continuam acessíveis. A API mantém o namespace `/api/v1`, o hello em `/api/v1/hello`, CORS restrito à origem do web e a convenção en-US documentada.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de navegação.

## 5. Escopo

### Dentro

- Grupo de rota público `/auth/*` com layout compartilhado de autenticação, light-only e acessível.
- Páginas placeholder em en-US para `/auth/sign-up`, `/auth/sign-in`, `/auth/confirm`, `/auth/forgot-password` e `/auth/reset-password`.
- Grupo de rota privado `/app/*` com shell, navegação básica e página inicial placeholder em en-US.
- Guard de `/app/*`: sem sessão válida, redirecionar para `/auth/sign-up` nesta fatia.
- Redirecionamento de pessoa autenticada em `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` para `/app`.
- Manutenção de `/auth/forgot-password` e `/auth/reset-password` acessíveis mesmo com sessão ativa.
- Raiz `/`: sessão válida → `/app`; sem sessão → `/auth/sign-up`.
- CORS da API aceitando apenas a origem do web e os métodos/headers necessários para o fluxo de auth.
- Documentação da convenção en-US em `.docs/RULES.md`, `.docs/DESIGN.md`, `.docs/DEVELOPMENT.md` e `.docs/ARCHITECTURE.md`.
- Atualização dos testes e do E2E que hoje validam a página de demonstração em `/`.
- Acessibilidade, responsividade e light-only nos layouts e placeholders.

### Fora

- Formulários, validações e endpoints reais de sign-up, confirmação, sign-in, forgot-password e reset-password; eles entram nas fatias 004 a 008.
- Criação de sessão, JWT, cookie e `/api/v1/auth/me`; isso entra na fatia 002.
- Conteúdo e envio de e-mails; os templates entram nas fatias 002, 004 e 007.
- Sign-out, refresh token, MFA, SSO, login social e “remember me”.
- Edição de perfil, troca de e-mail, exclusão de conta, workspace e permissões por papel.
- Deploy, CI, i18n com seletor de locale e tradução de telas fora de auth e `/app`.

## 6. Fluxos

### Fluxo principal — visitante navega

1. A pessoa abre `/`.
2. Sem sessão, o web redireciona para `/auth/sign-up`.
3. A página placeholder de sign-up carrega dentro do layout público.
4. A pessoa abre `/app` ou `/app/*` diretamente.
5. Sem sessão, o guard redireciona para `/auth/sign-up`.

### Fluxo principal — pessoa autenticada navega

1. A pessoa com sessão válida abre `/`.
2. O web redireciona para `/app`.
3. O shell privado carrega com a página inicial placeholder.
4. A pessoa abre `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm`.
5. O web redireciona para `/app`.
6. A pessoa abre `/auth/forgot-password` ou `/auth/reset-password` e permanece na página, mesmo com sessão ativa.

### Fluxos alternativos e de exceção

- Sessão inválida, expirada ou revogada: tratar como ausência de sessão e redirecionar `/app/*` para `/auth/sign-up`.
- Rota `/auth/*` inexistente: responder `404` dentro do layout público.
- Rota `/app/*` inexistente com sessão válida: responder `404` dentro do shell privado.
- Origem não permitida no CORS: a API bloqueia a requisição.
- `returnTo` ainda não é usado nesta fatia; a fatia 006 introduz o retorno seguro.

## 7. Regras e casos de borda

- `/auth/*` é público; nenhuma página de auth exige sessão.
- `/app/*` é privado; toda rota exige sessão válida.
- Nesta fatia, `/app/*` sem sessão redireciona para `/auth/sign-up`; a fatia 006 muda para `/auth/sign-in`.
- Pessoa autenticada em `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm` é redirecionada para `/app`.
- `/auth/forgot-password` e `/auth/reset-password` não entram na regra de redirecionamento de pessoa autenticada.
- A raiz `/` não exibe mais a página de demonstração; ela redireciona conforme a sessão.
- A API responde apenas em `/api/v1/*`; `GET /` não existe e `GET /api/v1/hello` mantém `{ "message": "Hello World" }`.
- CORS aceita apenas a origem do web, com `GET`, `HEAD`, `POST` e `OPTIONS`, e os headers `Authorization` e `Content-Type`.
- O guard do web é uma camada de experiência; a API continua sendo a fonte de verdade da sessão.
- Os placeholders não criam sessão, não enviam e-mail e não persistem dados.
- Todos os textos visíveis são en-US; nomes de rotas, arquivos, componentes, campos e endpoints também são en-US.
- A UI é light-only, sem `dark:`, com contraste AA e layout funcional em 360 px, 768 px e 1280 px.
- Nenhum token, JWT ou PII aparece em logs.

## 8. Dados e contratos

### Rotas web

| Rota                    | Acesso  | Comportamento nesta fatia                                        |
| ----------------------- | ------- | ---------------------------------------------------------------- |
| `/`                     | Público | Sessão válida → `/app`; sem sessão → `/auth/sign-up`             |
| `/auth/sign-up`         | Público | Placeholder; com sessão → `/app`                                 |
| `/auth/sign-in`         | Público | Placeholder; com sessão → `/app`                                 |
| `/auth/confirm`         | Público | Placeholder; com sessão → `/app`                                 |
| `/auth/forgot-password` | Público | Placeholder; acessível com ou sem sessão                         |
| `/auth/reset-password`  | Público | Placeholder; acessível com ou sem sessão                         |
| `/app`                  | Privado | Shell e página inicial placeholder; sem sessão → `/auth/sign-up` |
| `/app/*`                | Privado | Shell; sem sessão → `/auth/sign-up`                              |

### API

- Prefixo global `/api/v1`.
- `GET /api/v1/hello` — `200` com `{ "message": "Hello World" }`.
- `GET /` — não existe.
- Endpoints de auth ficam sob `/api/v1/auth/*`.
- O contrato de erro é o definido na fatia 002.

### CORS

- Origem permitida: a origem do web configurada no ambiente.
- Métodos: `GET`, `HEAD`, `POST`, `OPTIONS`.
- Headers: `Authorization`, `Content-Type`.
- Outras origens são bloqueadas.

### Documentação

- `.docs/RULES.md`: registrar que UI, e-mails, rotas, endpoints e código de autenticação usam en-US.
- `.docs/DESIGN.md`: registrar que as telas de auth e e-mails transacionais usam en-US e continuam light-only.
- `.docs/DEVELOPMENT.md`: registrar a convenção de nomenclatura e a separação `/auth/*` vs `/app/*`.
- `.docs/ARCHITECTURE.md`: registrar os grupos de rota, o guard e o namespace `/api/v1`.
- A documentação interna continua em PT-BR; a convenção en-US vale para o produto.

## 9. Permissões e segurança

- `/auth/*` é público e não exige sessão.
- `/app/*` exige sessão válida; o guard do web não substitui a validação da API.
- O redirecionamento de pessoa autenticada evita telas de auth desnecessárias, mas não concede acesso.
- `/auth/forgot-password` e `/auth/reset-password` permanecem públicos para permitir recuperação a partir de qualquer dispositivo.
- CORS restrito à origem do web reduz chamadas cross-origin indevidas.
- O guard não expõe token, JWT ou dados de sessão no HTML ou no JavaScript.
- Nenhum placeholder persiste dados ou cria sessão.

## 10. Requisitos não funcionais

- A navegação entre `/`, `/auth/*` e `/app/*` responde em até 300 ms no ambiente local, sem contar o carregamento da API.
- O guard não adiciona mais de 300 ms ao carregamento inicial local.
- Layouts e placeholders atendem AA, funcionam por teclado, têm foco visível e não têm rolagem horizontal em 360 px, 768 px e 1280 px.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI são en-US.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou JWT.

## 11. Dependências e riscos

| Dependência ou risco                     | Impacto                                                        | Mitigação                                                 | Dono               |
| ---------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| Specs 001 e 002 (schema e sessão)        | Sem elas não há usuário nem validação de sessão                | Implementar na ordem do mapa                              | Engenharia         |
| Guard do web                             | Pode divergir da API e liberar rota indevidamente              | API valida a sessão em todas as chamadas protegidas       | Engenharia         |
| Redirecionamento de `/app/*`             | Destino muda na fatia 006                                      | Centralizar o destino e atualizar na 006                  | Engenharia         |
| CORS                                     | Configuração errada bloqueia o fluxo ou libera origem indevida | Allowlist por ambiente e teste de origem negada           | Engenharia         |
| Placeholders                             | Podem ser confundidos com telas finais                         | Marcar como placeholder e substituir nas fatias 004 a 008 | Produto/Engenharia |
| Mudança de idioma da UI                  | Conflita com `RULES.md` e `DESIGN.md` atuais                   | Atualizar a documentação na mesma entrega                 | Produto/Engenharia |
| Migração do `GET /` para `/api/v1/hello` | Quebra testes e links existentes                               | Atualizar testes, E2E e documentação                      | Engenharia         |

## 12. Rollout e migração

- A página pública de demonstração em `/` é substituída por redirecionamento.
- O hello world da API passa a `/api/v1/hello`; `GET /` deixa de existir.
- Os placeholders de `/auth/*` e `/app` passam a existir e são substituídos pelas fatias seguintes.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; nenhum dado real é perdido no ambiente local.
- Comunicação: atualizar `.docs` e `.env.example` na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** regra de redirecionamento da raiz; regra de redirecionamento de pessoa autenticada; allowlist de CORS; destino do guard.
- **Integração:** `GET /api/v1/hello`; `GET /` retornando `404`; CORS com origem permitida e origem negada; endpoints de auth sob `/api/v1/auth/*`.
- **E2E (Playwright):** `/` sem sessão → `/auth/sign-up`; `/app` sem sessão → `/auth/sign-up`; `/app` com sessão → shell; `/auth/sign-in`, `/auth/sign-up` e `/auth/confirm` com sessão → `/app`; forgot/reset acessíveis com sessão.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only e textos en-US.
- **Documentação:** conferir que a convenção en-US está registrada nos quatro documentos.

## 14. Critérios de aceite

- [x] Dado um visitante, quando abre `/auth/sign-up`, `/auth/sign-in`, `/auth/confirm`, `/auth/forgot-password` ou `/auth/reset-password`, então a página placeholder pública carrega dentro do layout de autenticação em en-US.
- [x] Dado um visitante sem sessão, quando abre `/app` ou qualquer `/app/*`, então é redirecionado para `/auth/sign-up`.
- [x] Dada uma sessão válida, quando a pessoa abre `/app` ou `/app/*`, então o shell privado carrega e a página inicial placeholder é exibida.
- [x] Dada uma sessão válida, quando a pessoa abre `/auth/sign-in`, `/auth/sign-up` ou `/auth/confirm`, então é redirecionada para `/app`; `/auth/forgot-password` e `/auth/reset-password` continuam acessíveis.
- [x] Dada a raiz `/`, quando há sessão válida, então redireciona para `/app`; quando não há, redireciona para `/auth/sign-up`.
- [x] Dada a API, quando os endpoints são chamados, então o hello está em `/api/v1/hello`, `GET /` não existe, auth fica sob `/api/v1/auth/*`, o CORS aceita a origem do web com `GET`/`HEAD`/`POST`/`OPTIONS` e bloqueia as demais origens.
- [x] Dado o código e a documentação, quando a convenção é verificada, então telas de auth, `/app` e placeholders usam en-US, a regra está registrada em `RULES.md`, `DESIGN.md`, `DEVELOPMENT.md` e `ARCHITECTURE.md`, e a UI é light-only, acessível e responsiva.

## 15. Decisões e questões abertas

| Tema                            | Decisão ou pergunta                                                          | Impacto                                                         | Dono               | Status                  |
| ------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------ | ----------------------- |
| Rotas públicas                  | `/auth/*` é público; `/app/*` é privado                                      | Define a estrutura de navegação do épico                        | Produto/Engenharia | fechada (2026-11-09)    |
| Destino do guard nesta fatia    | `/app/*` sem sessão → `/auth/sign-up`; a fatia 006 muda para `/auth/sign-in` | Permite testar a fatia antes do sign-in existir                 | Engenharia         | fechada (2026-11-09)    |
| Pessoa autenticada em `/auth/*` | sign-in, sign-up e confirm → `/app`; forgot e reset permanecem acessíveis    | Evita telas de auth desnecessárias sem bloquear recuperação     | Produto            | fechada (2026-11-09)    |
| CORS                            | Apenas a origem do web; métodos e headers do fluxo de auth                   | Protege a API contra origens indevidas                          | Engenharia         | fechada (2026-11-09)    |
| Idioma                          | UI, e-mails, rotas, endpoints e código em en-US; docs internas em PT-BR      | Alinha a entrega com o pedido                                   | Produto/Engenharia | fechada (2026-11-09)    |
| Placeholders                    | Páginas mínimas substituídas nas fatias 004 a 008                            | Mantém cada fatia testável sem entregar formulários incompletos | Engenharia         | fechada (2026-11-09)    |
| `returnTo`                      | Introduzido na fatia 006                                                     | Evita open redirect antes de existir sign-in                    | Engenharia         | aberta (não bloqueante) |
