# Auth sign-up — Spec

> **Status:** done
> **Atualizado em:** 2026-11-10
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`
> **Plano:** `.plans/004-auth-sign-up-plan.md`

## 1. Contexto e problema

As fatias 001 a 003 entregam schema, sessão e rotas, mas `/auth/sign-up` ainda é um placeholder. Não existe forma de criar conta, persistir a pessoa como não confirmada nem enviar o e-mail de confirmação. Sem sign-up, ninguém entra na plataforma e as fatias de confirmação, sign-in e recuperação não têm usuário para operar.

Esta fatia implementa o primeiro fluxo observável do épico: criar conta com nome, sobrenome, e-mail e senha, receber um e-mail com link de confirmação e permanecer sem sessão até a confirmação.

## 2. Usuários e jobs

| Usuário                            | Job                                                                                                                      | Frequência          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Visitante                          | Criar uma conta informando nome, sobrenome, e-mail e senha; entender erros de validação; receber o e-mail de confirmação | Uma vez no cadastro |
| Pessoa com cadastro não confirmado | Reenviar a confirmação ao tentar cadastrar o mesmo e-mail novamente                                                      | Eventual            |
| Desenvolvedor(a)                   | Consumir o endpoint com contrato de erro previsível e mensagens en-US                                                    | A cada integração   |

Permissões: `/auth/sign-up` e `POST /api/v1/auth/sign-up` são públicos. Nenhuma sessão, JWT ou cookie é criado nesta fatia.

## 3. Resultado esperado

Uma pessoa consegue abrir `/auth/sign-up`, preencher first name, last name, email, password e confirm password, enviar o formulário e receber um e-mail en-US com link para `/auth/confirm?token=...`. A conta fica persistida como **não confirmada** e nenhuma sessão é criada.

E-mails já confirmados retornam `409` sem duplicar a conta. E-mails não confirmados reenviam a confirmação e retornam `200` com mensagem genérica, sem duplicata. A página substitui o placeholder da fatia 003.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes do fluxo.

## 5. Escopo

### Dentro

- Página pública `/auth/sign-up` em en-US, substituindo o placeholder, com layout de autenticação, light-only, acessível por teclado e responsiva em 360 px, 768 px e 1280 px.
- Campos: first name, last name, email, password e confirm password, com labels visíveis, erros por campo e estados de loading, erro e sucesso.
- Endpoint `POST /api/v1/auth/sign-up` com validação de entrada e contrato de erro.
- Persistência de usuário com nome, sobrenome, e-mail normalizado e único, hash forte de senha e status de e-mail não confirmado.
- Token opaco de confirmação de uso único, com hash em repouso e expiração padrão de 24 horas.
- E-mail transacional en-US com link para `/auth/confirm?token=...`.
- Reenvio de confirmação quando o e-mail informado já existe e ainda não foi confirmado, sem criar duplicata.
- Rate limiting básico no endpoint.
- Atualização de testes, E2E e documentação afetada.

### Fora

- Confirmação da conta, criação de sessão, JWT, cookie e área `/app` autenticada; isso entra na fatia 005.
- Sign-in, sessão única, revogação de sessão e e-mail de nova sessão; isso entra na fatia 006.
- Recuperação e reset de senha; isso entra nas fatias 007 e 008.
- Sign-out, refresh token, MFA, SSO, login social e “remember me”.
- Tela dedicada de reenvio de confirmação; o reenvio acontece apenas ao repetir o sign-up com e-mail não confirmado.
- Edição de perfil, exclusão de conta, workspace, multi-tenancy e permissões por papel.
- Provedor de e-mail de produção e garantias de deliverability; o ambiente local usa a caixa de e-mail do Supabase local.
- i18n com troca de idioma; a UI desta entrega é fixa em en-US.

## 6. Fluxos

### Fluxo principal — criar conta

1. A pessoa abre `/auth/sign-up`.
2. Preenche first name, last name, email, password e confirm password.
3. O web envia os dados para `POST /api/v1/auth/sign-up`.
4. A API valida os campos, normaliza o e-mail, verifica duplicidade, cria o usuário como não confirmado, gera o token de confirmação e dispara o e-mail.
5. O web exibe a mensagem “Check your email to confirm your account.” e não cria sessão.
6. A pessoa recebe o e-mail com o link `/auth/confirm?token=...`, que será tratado na fatia 005.

### Fluxos alternativos e de exceção

- Campo obrigatório ausente, e-mail inválido, senha fora da política ou confirmação diferente: a API responde `400` com erro de validação e o web associa cada mensagem ao campo correspondente, sem criar conta.
- E-mail já cadastrado e confirmado: a API responde `409` e o web informa que já existe uma conta com esse e-mail.
- E-mail já cadastrado e ainda não confirmado: a API gera um novo token, invalida o token anterior não usado, reenvia o e-mail de confirmação e responde `200` com a mesma mensagem de sucesso genérica, sem criar duplicata.
- Falha no envio do e-mail: a API responde `503` com erro acionável e a pessoa pode tentar novamente; a conta não confirmada pode ser reutilizada no novo sign-up.
- Muitas tentativas em pouco tempo: a API responde `429` e o web orienta a aguardar.

## 7. Regras e casos de borda

- First name e last name são obrigatórios, recebem `trim` e têm limite máximo de 100 caracteres cada.
- E-mail é obrigatório, validado por formato, normalizado para minúsculas, sem espaços nas extremidades e único de forma case-insensitive; limite máximo de 254 caracteres.
- Senha e confirmação são obrigatórias; a confirmação precisa ser idêntica. Política padrão: mínimo de 8 e máximo de 128 caracteres, sem exigência de composição.
- A senha nunca é devolvida pela API, nunca aparece em logs e é persistida apenas como hash forte.
- O token de confirmação é opaco, de alta entropia, de uso único, com hash em repouso e expiração de 24 horas. Um novo token invalida o anterior ainda não usado.
- O link do e-mail aponta para o web em `/auth/confirm?token=...`; o token não deve aparecer em logs de aplicação, de proxy ou de observabilidade.
- O sign-up não cria sessão nem emite JWT; a conta permanece não confirmada até a fatia 005.
- O endpoint usa o schema de `users` e `auth_tokens` da fatia 001 e a porta de e-mail da fatia 002.
- `/auth/sign-up` é público; pessoa autenticada que abre a página é redirecionada para `/app` pela regra da fatia 003.
- Todos os textos visíveis e mensagens de erro são en-US; nomes de rotas, endpoints, campos, tabelas e identificadores também são en-US.
- A UI é light-only, sem `dark:` e sem contraste abaixo de AA.
- Nenhum token, senha ou PII aparece em logs, traces ou métricas.

## 8. Dados e contratos

### `POST /api/v1/auth/sign-up`

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "password": "correct horse battery staple",
  "passwordConfirmation": "correct horse battery staple"
}
```

Respostas previstas:

- `201` — conta criada e e-mail de confirmação enviado: `{ "message": "Check your email to confirm your account.", "user": { "id": "...", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com" } }`
- `200` — e-mail já cadastrado e não confirmado: confirmação reenviada, sem duplicata, com a mesma mensagem genérica.
- `400` — erro de validação com `code`, `message` e `fieldErrors` por campo.
- `409` — e-mail já cadastrado e confirmado.
- `429` — excesso de tentativas.
- `503` — falha ao disparar o e-mail de confirmação; a pessoa pode tentar novamente.

Formato de erro padrão:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Check the highlighted fields and try again.",
  "fieldErrors": {
    "email": "Enter a valid email address."
  }
}
```

### Persistência

- `users`: cria a linha com `email_confirmed_at` nulo, `password_hash` e timestamps.
- `auth_tokens`: cria a linha com `purpose = email_confirmation`, `token_hash`, `expires_at` e `used_at` nulo.
- O token anterior não usado do mesmo usuário e purpose é invalidado ao reenviar a confirmação.
- As tabelas não são acessíveis diretamente pelo navegador; todo acesso passa pela API.

### E-mail

- Assunto: “Confirm your account”.
- Corpo em en-US, com o link `/auth/confirm?token=...`, aviso de expiração de 24 horas e orientação para ignorar a mensagem se o cadastro não foi feito.
- O e-mail é entregue pela caixa de e-mail do Supabase local em desenvolvimento. O provedor de produção fica em aberto.

### Configuração

- Reutiliza a conexão de banco e a porta de e-mail da fatia 002.
- O TTL do token de confirmação é configurável, com padrão de 24 horas.
- Nenhum segredo, token ou senha é versionado; `.env.example` documenta apenas nomes e valores de demonstração.

## 9. Permissões e segurança

- `/auth/sign-up` e o endpoint de sign-up são públicos; não exigem sessão.
- Senhas usam hash forte e nunca são logadas, retornadas ou incluídas em mensagens de erro.
- Tokens de confirmação são opacos, de uso único, com hash em repouso e expiração; não são logados.
- O sign-up pode revelar que um e-mail já confirmado existe (`409`), decisão aceita para esta entrega; não expõe outros dados da conta.
- Rate limiting básico protege o endpoint contra abuso; os limites são configuráveis.
- O endpoint usa o contrato de erro da fatia 002 e não expõe stack trace, SQL ou nomes de tabelas.
- Logs estruturados incluem operação e identificadores internos, sem PII, senha, token ou payload sensível.

## 10. Requisitos não funcionais

- `POST /api/v1/auth/sign-up` responde em até 1 s p95 no ambiente local, incluindo a validação e o disparo do e-mail local.
- A página `/auth/sign-up` atende AA, funciona por teclado, tem foco visível, labels associados, erros com `aria-describedby` e layout funcional em 360 px, 768 px e 1280 px sem rolagem horizontal.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI e e-mails são en-US.
- Logs, métricas e traces da API continuam chegando ao LGTM, sem PII ou tokens.
- O fluxo é idempotente do ponto de vista do usuário: repetir o sign-up com e-mail não confirmado reenvia a confirmação e não cria duplicata.

## 11. Dependências e riscos

| Dependência ou risco                          | Impacto                                    | Mitigação                                                             | Dono               |
| --------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- | ------------------ |
| Spec 001 (users e auth_tokens)                | Sem schema, o sign-up não persiste         | Implementar 001 antes                                                 | Engenharia         |
| Spec 002 (porta de e-mail e contrato de erro) | Sem ela, não há envio nem erro padronizado | Reutilizar a porta e o contrato                                       | Engenharia         |
| Spec 003 (rota `/auth/sign-up` e layout)      | Sem ela, a página não tem onde viver       | Substituir o placeholder                                              | Engenharia         |
| Caixa de e-mail local e SMTP                  | Sem ela, não é possível validar o link     | Configurar o SMTP local e documentar como inspecionar e-mails         | Engenharia         |
| Provedor de e-mail de produção                | Entrega real fica indefinida               | Manter porta de e-mail agnóstica e registrar a decisão                | Engenharia         |
| Vazamento de token em URL/logs                | Comprometimento de confirmação             | Não logar token, remover da URL após uso e restringir observabilidade | Engenharia         |
| E-mail duplicado e contas não confirmadas     | Pessoa pode ficar sem acesso               | Reenvio no sign-up de e-mail não confirmado                           | Produto/Engenharia |
| Banco de testes para integração               | Testes de API podem ficar frágeis          | Definir Postgres descartável ou repositório fake                      | Engenharia         |
| Política de senha aberta                      | Validação pode mudar                       | Usar o padrão 8–128 até decisão final                                 | Produto/Segurança  |

## 12. Rollout e migração

- Não há nova migração de schema; usa as tabelas da fatia 001.
- O placeholder de `/auth/sign-up` é substituído pela página real.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; usuários criados no ambiente local são descartáveis.
- Comunicação: atualizar `.docs` e testes na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** validação de nome, e-mail, senha e confirmação; normalização e unicidade de e-mail; geração, hash, expiração e invalidação de token; regra de reenvio para e-mail não confirmado.
- **Integração:** `POST /api/v1/auth/sign-up` com sucesso, validação, duplicidade confirmada, reenvio de não confirmada, rate limit e falha de e-mail; contrato de erro; ausência de senha/token nos logs.
- **E2E (Playwright):** abrir `/auth/sign-up`, validar erros de formulário, criar conta com e-mail único, confirmar a mensagem de sucesso e localizar o e-mail na caixa local com o link `/auth/confirm?token=...`.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US e inspeção do e-mail local.
- **Dados de teste:** e-mails únicos por execução; nenhum dado real ou credencial de produção.

## 14. Critérios de aceite

- [x] Dado um visitante em `/auth/sign-up`, quando envia first name, last name, email, password e confirm password válidos, então uma conta não confirmada é criada e um e-mail de confirmação en-US é enviado.
- [x] Dados campos ausentes, e-mail inválido, senha fora da política ou confirmação diferente, quando o formulário é enviado, então nenhuma conta é criada, os erros aparecem junto aos campos e a interface continua acessível por teclado e leitor de tela.
- [x] Dado um e-mail já confirmado, quando alguém tenta se cadastrar, então a API responde `409` e não cria duplicata; dado um e-mail não confirmado, então a API responde `200`, reenvia a confirmação e não duplica a conta.
- [x] Dado um sign-up bem-sucedido, quando o e-mail é inspecionado, então o link aponta para `/auth/confirm?token=...`, o token é de uso único, expira em 24 horas e não aparece em logs.
- [x] Dado um sign-up bem-sucedido, quando a resposta é inspecionada, então nenhuma sessão, JWT ou cookie é criado e `/app` continua protegido.
- [x] Dado excesso de tentativas, quando o endpoint é chamado repetidamente, então a API responde `429` sem revelar detalhes internos.
- [x] Dado o fluxo e a documentação, quando a entrega é verificada, então a página e o e-mail usam en-US, a UI é light-only, acessível e responsiva, e nenhuma senha ou token aparece em logs.

## 15. Decisões e questões abertas

| Tema                        | Decisão ou pergunta                                                 | Impacto                               | Dono              | Status                  |
| --------------------------- | ------------------------------------------------------------------- | ------------------------------------- | ----------------- | ----------------------- |
| E-mail duplicado            | Confirmado: `409`. Não confirmado: `200` com reenvio da confirmação | Evita conta bloqueada sem confirmação | Produto/Segurança | fechada (2026-11-09)    |
| Política de senha           | Mínimo 8, máximo 128, sem composição obrigatória                    | Define validação de sign-up e reset   | Produto/Segurança | aberta (não bloqueante) |
| TTL do token de confirmação | 24 horas, uso único                                                 | Define expiração e mensagem de erro   | Engenharia        | fechada (default)       |
| Provedor de e-mail          | SMTP local do Supabase em dev; produção a definir                   | Define configuração e entrega real    | Engenharia        | aberta (não bloqueante) |
| Banco de testes             | Postgres descartável ou repositório fake                            | Afeta testes de integração e E2E      | Engenharia        | aberta (não bloqueante) |
| Reenvio de confirmação      | Coberto pelo sign-up de e-mail não confirmado; sem tela dedicada    | Mantém o escopo enxuto                | Produto           | fechada (2026-11-09)    |
