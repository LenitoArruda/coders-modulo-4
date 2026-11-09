# Auth confirm account — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`, `.specs/004-auth-sign-up.md`
> **Plano:** `.plans/005-auth-confirm-account-plan.md` (a criar pelo `implement-me`)

## 1. Contexto e problema

A fatia 004 cria a conta e envia o e-mail de confirmação, mas a conta permanece inativa e nenhuma sessão existe. O placeholder de `/auth/confirm` não valida token, não confirma o e-mail e não leva a pessoa para a área privada. Sem confirmação, o sign-up não completa a jornada e `/app` continua inacessível.

Esta fatia ativa a conta, consome o token de confirmação, cria a primeira sessão JWT, dispara o e-mail de nova sessão e direciona a pessoa para `/app`. Ela usa a sessão e o cookie entregues pela fatia 002 e o layout público da fatia 003.

## 2. Usuários e jobs

| Usuário                              | Job                                                                         | Frequência          |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------- |
| Pessoa com cadastro não confirmado   | Clicar no link do e-mail, confirmar a conta e entrar direto na área privada | Uma vez no cadastro |
| Pessoa autenticada                   | Ver a área inicial em `/app` com seu nome e saber que a sessão está ativa   | A cada acesso       |
| Pessoa com link inválido ou expirado | Entender o problema e saber como recomeçar                                  | Eventual            |
| Desenvolvedor(a)                     | Validar token, sessão, cookie e redirecionamentos de forma previsível       | A cada integração   |

Permissões: o portador do token de confirmação pode confirmar a conta uma única vez. A área `/app/*` exige uma sessão JWT válida e não revogada. Não há papéis administrativos nesta entrega.

## 3. Resultado esperado

Ao abrir `/auth/confirm?token=...` com um token válido, a pessoa tem o e-mail confirmado, o token consumido, uma sessão JWT criada, um e-mail de nova sessão enviado e é redirecionada para `/app`. A área `/app` mostra o primeiro nome da pessoa e só pode ser acessada com uma sessão válida.

Links inválidos, expirados ou já usados mostram um erro acionável, não criam sessão e não confirmam a conta. Sessões revogadas ou expiradas deixam de acessar `/app`. A página substitui o placeholder da fatia 003.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de confirmação.

## 5. Escopo

### Dentro

- Página pública `/auth/confirm?token=...` em en-US, substituindo o placeholder, com estados de validação, sucesso e erro.
- Endpoint `POST /api/v1/auth/confirm` que valida o token, confirma o e-mail, consome o token, cria a sessão e devolve o JWT.
- Reutilização de `GET /api/v1/auth/me` da fatia 002 para validar a sessão e obter os dados da pessoa.
- Registro de sessão com `origin = sign_up_confirmation`.
- Política de sessão única: ao criar a sessão, revogar todas as sessões ativas anteriores da mesma pessoa.
- E-mail en-US de nova sessão enviado após a criação da sessão.
- Gravação do JWT em cookie `HttpOnly` pelo web, com o contrato da fatia 002.
- Shell privado `/app` exibindo a página inicial com o primeiro nome da pessoa.
- Redirecionamento de `/app/*` sem sessão para `/auth/sign-up` nesta fatia, até a fatia 006 introduzir o sign-in.
- Remoção do token da URL após o uso, com `replace` no histórico do navegador.
- Atualização de testes, E2E e documentação afetada.

### Fora

- Sign-in com e-mail e senha; isso entra na fatia 006.
- Recuperação e reset de senha; isso entra nas fatias 007 e 008.
- Sign-out, refresh token, “remember me”, MFA, SSO e login social.
- Gestão de dispositivos/sessões pelo usuário, lista de sessões e encerramento remoto manual.
- Reenvio dedicado de confirmação; o reenvio continua coberto pelo sign-up de e-mail não confirmado.
- Edição de perfil, troca de e-mail, exclusão de conta e permissões por papel.
- Link de recuperação de senha no e-mail de nova sessão; a fatia 007 atualiza o template.
- Deploy, CI, provedor de e-mail de produção e observabilidade além do padrão atual.

## 6. Fluxos

### Fluxo principal — confirmar conta e entrar

1. A pessoa clica no link `/auth/confirm?token=...` recebido por e-mail.
2. O web envia o token para `POST /api/v1/auth/confirm` no corpo da requisição.
3. A API valida o token, confirma o e-mail, marca o token como usado e revoga sessões ativas anteriores da pessoa.
4. A API cria a sessão com `origin = sign_up_confirmation`, assina o JWT e dispara o e-mail de nova sessão.
5. O web grava o JWT em cookie `HttpOnly` e redireciona para `/app`.
6. O web valida a sessão em `GET /api/v1/auth/me` e renderiza a página inicial com o primeiro nome da pessoa.
7. O token é removido da barra de endereços.

### Fluxos alternativos e de exceção

- Token inexistente, expirado ou já usado: a API responde `400` com `code` específico, o web mostra “This confirmation link is invalid or has expired.” e oferece um link para `/auth/sign-up`.
- Conta já confirmada: a API responde `409`, não cria nova sessão nem reenvia confirmação; o web mostra erro acionável e orienta a fazer sign-in quando a fatia 006 estiver disponível.
- Falha ao enviar o e-mail de nova sessão: a sessão continua válida, a falha é registrada sem PII e a pessoa segue para `/app`; o reenvio automático fica fora desta entrega.
- Falha ao criar a sessão no servidor: nenhum cookie é gravado e o web mostra erro genérico com opção de tentar novamente.
- Sessão revogada, expirada ou com assinatura inválida: `/app/*` redireciona para `/auth/sign-up` nesta fatia e a API responde `401` nos endpoints protegidos.
- Pessoa já autenticada abre um link de confirmação válido: o token é consumido, as sessões anteriores são revogadas e a nova sessão passa a ser a única válida.
- Pessoa autenticada abre `/auth/confirm` sem token: o web redireciona para `/app`.

## 7. Regras e casos de borda

- O token de confirmação é de uso único, expira em 24 horas e é validado pelo hash em repouso.
- O token é enviado no corpo da requisição, não na URL da API; o link do e-mail aponta para a página do web.
- A confirmação só acontece uma vez; o timestamp de confirmação não é sobrescrito em uma segunda tentativa.
- A criação da sessão e a revogação das sessões anteriores são atômicas do ponto de vista da pessoa: após o sucesso, apenas a nova sessão é válida.
- O JWT, a sessão e o cookie seguem o contrato da fatia 002: claims `sub`, `sid`, `iat` e `exp`; cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção e `Path=/`.
- O navegador não chama a API de auth diretamente com o cookie; o servidor do web lê o cookie e encaminha `Authorization: Bearer`.
- Requisições de mudança de estado feitas pelo web exigem proteção de mesma origem/CSRF.
- Sessões revogadas ou expiradas não podem ser reativadas; é necessário novo sign-in.
- O e-mail de nova sessão é en-US, informa a data/hora e alerta para alterar a senha se a pessoa não reconhecer o acesso. O link para recuperação é adicionado na fatia 007.
- `/app/*` é privado; nesta fatia, sem sessão, redireciona para `/auth/sign-up`.
- A UI de confirmação e a página inicial de `/app` são light-only, acessíveis e responsivas em 360 px, 768 px e 1280 px.
- Nenhum token, JWT, senha ou PII é registrado em logs, traces ou métricas.

## 8. Dados e contratos

### `POST /api/v1/auth/confirm`

```json
{
  "token": "opaque-confirmation-token"
}
```

Respostas previstas:

- `200` — `{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 604800, "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }`
- `400` — token inválido, expirado ou já usado, com `code` como `INVALID_CONFIRMATION_TOKEN`.
- `409` — conta já confirmada.
- `429` — excesso de tentativas.
- `500` — falha interna sem detalhes.

### `GET /api/v1/auth/me`

- Reutiliza o contrato da fatia 002.
- `200` — `{ "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }`
- `401` — JWT ausente, inválido, expirado ou sessão revogada.

### Sessão, JWT e cookie

- Claims: `sub` (user id), `sid` (session id), `iat`, `exp`.
- `sessions`: identificador, user_id, origin `sign_up_confirmation`, created_at, expires_at e revoked_at.
- A API consulta a sessão ativa em toda requisição autenticada; a assinatura válida não basta se o `sid` estiver revogado.
- O cookie é gravado pelo web, não pela API. A API só aceita `Authorization: Bearer`.
- A duração padrão é a da fatia 002 (7 dias, configurável).

### E-mail de nova sessão

- Assunto: “New session on your account”.
- Corpo en-US com data/hora do acesso e alerta para alterar a senha se a pessoa não reconhecer a sessão.
- Sem link de recuperação nesta fatia; a fatia 007 adiciona o link.
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local.

## 9. Permissões e segurança

- O token de confirmação funciona como credencial de uso único; quem o possui pode confirmar a conta.
- A área `/app/*` exige JWT válido e sessão ativa; a verificação da API é a fonte de verdade.
- A proteção de rota do web é uma camada de experiência; todos os endpoints protegidos também validam o JWT.
- O token fica em cookie `HttpOnly`, fora do alcance do JavaScript, reduzindo risco de XSS.
- A combinação `SameSite=Lax`, verificação de origem e proteção de CSRF reduz risco em navegação cross-site.
- O JWT não contém PII além do identificador interno; nome e e-mail vêm de `/me`.
- Sessões revogadas são rejeitadas imediatamente, mesmo que o JWT ainda não tenha expirado.
- Senhas, tokens e JWT nunca aparecem em logs, traces, métricas ou mensagens de erro.
- A API não expõe detalhes internos em erros e não permite acesso direto do navegador às tabelas de auth.

## 10. Requisitos não funcionais

- `POST /api/v1/auth/confirm` responde em até 1 s p95 no ambiente local.
- `GET /api/v1/auth/me` responde em até 500 ms p95 no ambiente local.
- A validação de sessão em `/app/*` não adiciona mais de 300 ms ao carregamento inicial local.
- A página de confirmação e a página inicial de `/app` atendem AA, funcionam por teclado, têm foco visível e layout funcional em 360 px, 768 px e 1280 px sem rolagem horizontal.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI e e-mails são en-US.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou JWT.
- A sessão e a revogação são consistentes sob concorrência: duas confirmações simultâneas não podem deixar duas sessões válidas.

## 11. Dependências e riscos

| Dependência ou risco                      | Impacto                                        | Mitigação                                            | Dono       |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | ---------- |
| Spec 004 (usuário e token de confirmação) | Sem ela não há conta nem token para confirmar  | Implementar 004 antes e reutilizar os contratos      | Engenharia |
| Spec 002 (sessão, JWT, cookie e e-mail)   | Sem ela não há sessão para criar               | Reutilizar os casos de uso e o template              | Engenharia |
| Spec 003 (rota e layout públicos)         | Sem ela a página não tem onde viver            | Substituir o placeholder                             | Engenharia |
| Concorrência na revogação                 | Duas sessões podem ficar ativas                | Transação e verificação de sessão ativa              | Engenharia |
| E-mail de nova sessão                     | Falha de entrega não pode bloquear o acesso    | Sessão permanece válida e falha é registrada sem PII | Engenharia |
| Token na URL                              | Pode vazar por histórico, Referer ou logs      | Remover da URL após uso e não logar                  | Engenharia |
| Sem sign-out/refresh                      | Sessão só termina por expiração ou nova sessão | Registrar como decisão aberta e fora do épico        | Produto    |
| Banco de testes para integração           | Testes de confirmação podem ficar frágeis      | Definir Postgres descartável ou repositório fake     | Engenharia |

## 12. Rollout e migração

- Não há nova migração de schema; usa as tabelas da fatia 001.
- O placeholder de `/auth/confirm` é substituído pela página real.
- A página inicial de `/app` passa a exibir o primeiro nome da pessoa autenticada.
- `/app/*` continua redirecionando para `/auth/sign-up` até a fatia 006.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; sessões e tokens são descartáveis no ambiente local.
- Comunicação: atualizar `.docs` e testes na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** validação de token de confirmação; expiração, uso único e hash; criação e revogação de sessão; claims e expiração do JWT; política de sessão única; validação do cookie.
- **Integração:** `POST /api/v1/auth/confirm` com token válido, inválido, expirado, já usado e conta já confirmada; `GET /api/v1/auth/me` com JWT válido, revogado e expirado; criação de sessão e revogação das anteriores; ausência de PII/token nos logs.
- **E2E (Playwright):** sign-up em contexto isolado, leitura do e-mail na caixa local, confirmação, redirecionamento para `/app`, visualização do primeiro nome; acesso direto a `/app` sem cookie; link inválido; segunda confirmação/concorrência.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US, inspeção do e-mail de nova sessão e do cookie no navegador.
- **Dados de teste:** e-mails e tokens únicos por execução; nenhum dado real.

## 14. Critérios de aceite

- [ ] Dado um token de confirmação válido, quando a pessoa abre `/auth/confirm?token=...`, então a conta é confirmada, o token é consumido, uma sessão JWT é criada, o e-mail de nova sessão é enviado e ela é redirecionada para `/app`.
- [ ] Dado um token inválido, expirado ou já usado, quando a pessoa abre o link, então nenhuma sessão é criada, a conta não é confirmada e a página mostra um erro acionável com caminho para recomeçar.
- [ ] Dada uma conta já confirmada, quando o link é usado novamente, então a API responde `409`, nenhuma sessão nova é criada e a pessoa recebe orientação para fazer sign-in quando a fatia 006 estiver disponível.
- [ ] Dada uma sessão válida, quando a pessoa acessa `/app`, então vê a página inicial em en-US com seu primeiro nome e `GET /api/v1/auth/me` devolve seus dados básicos.
- [ ] Dada uma nova sessão criada, quando outra sessão anterior existia, então a anterior é revogada, apenas a nova acessa `/app` e o e-mail de nova sessão é enviado.
- [ ] Dada uma sessão ausente, revogada ou expirada, quando a pessoa acessa `/app/*`, então é redirecionada para `/auth/sign-up` e chamadas protegidas à API respondem `401`.
- [ ] Dado o JWT e o cookie, quando eles são inspecionados, então o JWT contém apenas `sub`, `sid`, `iat` e `exp`, o cookie é `HttpOnly`, `SameSite=Lax` e `Secure` em produção, e nenhum token ou PII aparece em logs.

## 15. Decisões e questões abertas

| Tema                           | Decisão ou pergunta                                                                      | Impacto                                             | Dono               | Status                  |
| ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------ | ----------------------- |
| Emissor do JWT                 | API NestJS própria, conforme a fatia 002                                                 | Mantém sessão única e revogação sob controle da API | Engenharia         | fechada (2026-11-09)    |
| Sessão única                   | A confirmação também cria sessão e revoga as anteriores                                  | Atende ao requisito de “última sessão vence”        | Produto/Engenharia | fechada (2026-11-09)    |
| Destino do guard               | `/app/*` sem sessão → `/auth/sign-up` nesta fatia; a fatia 006 muda para `/auth/sign-in` | Permite entregar confirmação antes do sign-in       | Engenharia         | fechada (2026-11-09)    |
| Conta já confirmada            | `409` sem nova sessão                                                                    | Evita sessão duplicada e reenvio desnecessário      | Produto/Engenharia | fechada (2026-11-09)    |
| Falha no e-mail de nova sessão | Sessão permanece válida; falha é registrada                                              | Evita bloquear o acesso por falha de e-mail         | Engenharia         | fechada (default)       |
| Link de recuperação no e-mail  | Adicionado na fatia 007                                                                  | Evita link quebrado antes da página existir         | Produto/Engenharia | fechada (2026-11-09)    |
| TTL da sessão                  | 7 dias, configurável                                                                     | Define expiração e frequência de novo login         | Engenharia         | aberta (não bloqueante) |
| Banco de testes                | Postgres descartável ou repositório fake                                                 | Afeta testes de integração e E2E                    | Engenharia         | aberta (não bloqueante) |
