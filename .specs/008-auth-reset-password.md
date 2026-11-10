# Auth reset password — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-09
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`, `.specs/006-auth-sign-in.md`, `.specs/007-auth-forgot-password.md`
> **Plano:** `.plans/008-auth-reset-password-plan.md` (a criar pelo `implement-me`)

## 1. Contexto e problema

A fatia 007 permite solicitar recuperação e envia um link com token, mas o placeholder de `/auth/reset-password` não valida o token, não atualiza a senha e não revoga sessões. Sem esta fatia, o e-mail de recuperação leva a uma página inútil e a pessoa continua sem acesso à conta.

Esta fatia conclui a jornada: valida o token, recebe nova senha e confirmação, atualiza o hash, consome o token, revoga todas as sessões ativas, envia o e-mail de sucesso e devolve a pessoa ao sign-in com uma mensagem de confirmação.

## 2. Usuários e jobs

| Usuário                                        | Job                                                            | Frequência        |
| ---------------------------------------------- | -------------------------------------------------------------- | ----------------- |
| Pessoa com o link de recuperação               | Definir uma nova senha e voltar ao sign-in                     | Eventual          |
| Pessoa com link inválido, expirado ou já usado | Entender o problema e solicitar um novo link                   | Eventual          |
| Pessoa com sessão ativa em outro dispositivo   | Ter as sessões encerradas após a troca de senha                | Eventual          |
| Pessoa com conta não confirmada                | Definir a senha e ter o e-mail confirmado no mesmo fluxo       | Eventual          |
| Desenvolvedor(a)                               | Validar token, política de senha, revogação e redirecionamento | A cada integração |

Permissões: `/auth/reset-password` e `POST /api/v1/auth/reset-password` são públicos. O token de reset é a credencial de uso único que autoriza a troca. Nenhum papel administrativo participa do fluxo.

## 3. Resultado esperado

Ao abrir `/auth/reset-password?token=...` com um token válido, a pessoa informa nova senha e confirmação, tem a senha atualizada, o token consumido, outras sessões revogadas e recebe um e-mail de sucesso. Em seguida é encaminhada para `/auth/sign-in?reset=success`, vê a mensagem de sucesso e consegue entrar com a nova senha.

Links inválidos, expirados ou já usados não alteram a senha, não criam sessão e mostram um caminho para solicitar um novo link. A página substitui o placeholder da fatia 003 e o sign-in passa a exibir a mensagem de sucesso.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de reset.

## 5. Escopo

### Dentro

- Página pública `/auth/reset-password?token=...` em en-US, substituindo o placeholder, com campos de nova senha e confirmação, estados de loading/erro/sucesso e link para solicitar novo link.
- Endpoint `POST /api/v1/auth/reset-password` que valida o token, a política de senha e a confirmação.
- Atualização do hash de senha e consumo do token de reset.
- Invalidação de outros tokens de reset ainda não usados.
- Revogação de todas as sessões ativas da pessoa.
- Confirmação do e-mail se ele ainda não estava confirmado, porque o token prova a posse do endereço.
- E-mail en-US de confirmação de alteração de senha.
- Redirecionamento para `/auth/sign-in?reset=success` após o sucesso.
- Atualização da página de sign-in para exibir a mensagem de sucesso quando recebe `reset=success`.
- Remoção do token da URL após o uso, com `replace` no histórico, e ausência de recursos externos que possam vazar o valor por `Referer`.
- Rate limiting básico no endpoint (por IP, 5/60 s por padrão).
- Atualização de testes, E2E e documentação afetada.

### Fora

- Solicitação de recuperação e emissão do token; isso entra na fatia 007.
- Sign-in, sessão única e e-mail de nova sessão de login; já entregues nas fatias 002 e 006.
- Sign-out e encerramento manual de sessão.
- Refresh token, renovação automática, “remember me”, MFA, SSO, login social e passkeys.
- Troca de senha por pessoa autenticada dentro de `/app` (fluxo de “change password”).
- Reenvio dedicado de confirmação de conta.
- Histórico de senhas, bloqueio de reutilização de senha antiga e política de expiração de senha.
- Notificação por outros canais (SMS, push) e suporte a múltiplos e-mails.
- Gestão de dispositivos/sessões e lista de sessões ativas.
- Edição de perfil, troca de e-mail, exclusão de conta e permissões por papel.
- Provedor de e-mail de produção e garantias avançadas de deliverability.

## 6. Fluxos

### Fluxo principal — concluir o reset

1. A pessoa abre o link `/auth/reset-password?token=...` recebido por e-mail.
2. Informa nova senha e confirmação e envia o formulário.
3. O web chama `POST /api/v1/auth/reset-password` com token, senha e confirmação.
4. A API valida o token, a política de senha e a confirmação.
5. A API valida a senha e a confirmação **antes** de consumir o token; um erro de senha não queima o token.
6. A API executa, nesta ordem: consome o token (uso único), atualiza o hash de senha, confirma o e-mail se ainda não estava confirmado, invalida os outros tokens de reset não usados e revoga **todas** as sessões ativas.
7. A API envia o e-mail de sucesso.
8. O web mostra a confirmação e redireciona para `/auth/sign-in?reset=success`.
9. O sign-in exibe a mensagem de sucesso e a pessoa entra com a nova senha.

### Fluxos alternativos e de exceção

- Token inválido, expirado ou já usado: a API responde `400` com `code` `INVALID_RESET_TOKEN`, o web mostra “This password reset link is invalid or has expired.” e oferece link para `/auth/forgot-password`.
- Senha fora da política ou confirmação diferente: a API responde `400` com erros por campo e não altera a senha.
- Falha no envio do e-mail de sucesso: a senha continua alterada, a falha é registrada e a pessoa vê a confirmação na tela.
- Muitas tentativas: a API responde `429` e o web orienta a aguardar.
- Pessoa com sessão ativa abre o link de reset: o fluxo funciona; após o sucesso, a sessão antiga deixa de valer e o cookie obsoleto é tratado como ausente pelo guard (a API responde `401`).
- Token válido para conta não confirmada: a senha é atualizada e o e-mail é confirmado no mesmo fluxo.
- Segundo uso do mesmo token: a API rejeita e a senha não muda novamente.

## 7. Regras e casos de borda

- O token de reset é opaco, de alta entropia, de uso único, com hash em repouso e expiração de 1 hora.
- O token é enviado no corpo da requisição para a API; o link do e-mail aponta para a página do web.
- O token é lido no servidor, removido da barra de endereços com `history.replaceState` assim que a página carrega e mantido no estado do formulário até o envio; a rota responde com `Referrer-Policy: no-referrer` e não carrega recursos externos. Um token ausente na URL mostra o estado de link inválido.
- A nova senha segue a mesma política do sign-up: mínimo de 8 e máximo de 128 caracteres, sem exigência de composição; a confirmação precisa ser idêntica.
- A senha é persistida apenas como hash forte e nunca aparece em logs, respostas ou mensagens de erro.
- O reset bem-sucedido marca o e-mail como confirmado se ele ainda não estava confirmado, porque o token de reset prova a posse do endereço.
- O reset bem-sucedido consome o token, invalida outros tokens de reset da pessoa e revoga todas as sessões ativas.
- Um token já usado não pode ser reutilizado para uma segunda troca de senha.
- O e-mail de sucesso é en-US e informa que a senha foi alterada; se a pessoa não reconhecer a ação, deve solicitar um novo reset.
- `/auth/reset-password` é pública e permanece acessível mesmo com sessão ativa, para permitir a troca a partir de qualquer dispositivo.
- O sign-in exibe a mensagem de sucesso quando recebe `reset=success`.
- A UI é light-only, acessível e responsiva em 360 px, 768 px e 1280 px.
- Nenhum token, senha ou PII é registrado em logs, traces ou métricas.

## 8. Dados e contratos

### `POST /api/v1/auth/reset-password`

```json
{
  "token": "opaque-reset-token",
  "password": "new correct horse battery staple",
  "passwordConfirmation": "new correct horse battery staple"
}
```

Respostas previstas:

- `200` — `{ "message": "Your password has been updated. Sign in with your new password." }`
- `400` — `INVALID_RESET_TOKEN` (token inválido/expirado/já usado) ou `VALIDATION_ERROR` com `fieldErrors.password`/`fieldErrors.passwordConfirmation`. Se o token e a senha forem inválidos ao mesmo tempo, vale `VALIDATION_ERROR` e o token não é consumido.
- Mensagens de senha e confirmação reutilizam as do sign-up (ex.: “Passwords do not match.”).
- `429` — excesso de tentativas, com header `Retry-After`.
- `500` — falha interna sem detalhes.

### Rate limiting

- Chave: IP. Padrão: 5 tentativas por janela de 60 s; a 6ª tentativa recebe `429`.
- Variáveis: `RESET_PASSWORD_RATE_LIMIT_MAX` e `RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS`, no padrão dos demais limitadores.
- O store é em memória por processo; um store compartilhado fica como evolução futura.

### E-mail de sucesso

- Assunto: “Your password has been changed”.
- Corpo en-US informando a alteração e orientando a solicitar novo reset se não foi a pessoa.
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local.

### Persistência

- `auth_tokens`: o token usado recebe `used_at`; outros tokens de reset ainda não usados do mesmo usuário são invalidados.
- `users`: `password_hash` é atualizado e `email_confirmed_at` é preenchido se ainda estiver vazio.
- `sessions`: todas as sessões ativas do usuário são revogadas.
- Não há transação de banco: a consistência vem da **ordem** das escritas (token → hash/confirmação → invalidar tokens → revogar sessões). Se uma etapa falhar após o consumo do token, a pessoa precisa solicitar um novo link; o fluxo nunca deixa sessão antiga válida após a resposta `200`. A atomicidade estrita em banco segue como evolução (ADR 0013).
- Os ports ganham `updatePassword` (usuários) e `revokeAllActive` (sessões); esses métodos são entregáveis desta fatia.

### Navegação

- `/auth/reset-password` é pública e acessível com ou sem sessão.
- Após o sucesso, redirecionar para `/auth/sign-in?reset=success`.
- O sign-in mostra a mensagem de sucesso quando recebe `reset=success`.
- Em caso de token inválido, oferecer link para `/auth/forgot-password`.

## 9. Permissões e segurança

- O endpoint é público e usa o token de reset como credencial de uso único.
- O token é de uso único, expira em 1 hora e é armazenado com hash; não é logado.
- A nova senha é validada e persistida como hash forte; nunca é retornada ou logada.
- O reset revoga todas as sessões ativas, inclusive sessões criadas por confirmação e sign-in.
- O token é removido da URL após o uso e não é enviado a recursos externos.
- Rate limiting reduz abuso no endpoint.
- A API não expõe detalhes internos de banco ou stack em erros.
- Nenhum token, senha ou PII aparece em logs, traces ou métricas.

## 10. Requisitos não funcionais

- `POST /api/v1/auth/reset-password` responde em até 1 s p95 no ambiente local.
- A página `/auth/reset-password` atende AA, funciona por teclado, tem foco visível, labels associados, erros com `aria-describedby` e layout funcional em 360 px, 768 px e 1280 px sem rolagem horizontal.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI e e-mails são en-US.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou senhas.
- Dois resets simultâneos com o mesmo token: apenas um consome o token (consumo condicional por `used_at is null`); o outro recebe `INVALID_RESET_TOKEN`.

## 11. Dependências e riscos

| Dependência ou risco                              | Impacto                                                              | Mitigação                                                      | Dono               |
| ------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------ |
| Spec 007 (token de reset e e-mail de recuperação) | Sem ela não há token para validar                                    | Implementar 007 antes                                          | Engenharia         |
| Spec 006 (rota de sign-in e sessão)               | Sem ela não há destino após o reset                                  | Reutilizar a rota e a mensagem de sucesso                      | Engenharia         |
| Spec 002 (revogação de sessão e porta de e-mail)  | Sem ela sessões antigas continuam válidas e não há e-mail de sucesso | Reutilizar os casos de uso                                     | Engenharia         |
| Vazamento de token por URL/logs                   | Comprometimento da troca de senha                                    | Remover da URL, não logar e não carregar recursos externos     | Engenharia         |
| Reutilização de token                             | Duas trocas de senha com o mesmo link                                | Uso único, `used_at` e invalidação de tokens anteriores        | Engenharia         |
| Revogação de sessões                              | Sessões antigas continuam válidas após o reset                       | Revogação atômica de todas as sessões do usuário               | Engenharia         |
| Conta não confirmada                              | Pessoa pode não conseguir entrar após o reset                        | Confirmar o e-mail no reset bem-sucedido                       | Produto/Engenharia |
| Falha no e-mail de sucesso                        | Pessoa pode não receber a notificação                                | Senha permanece alterada; falha é registrada e a tela confirma | Engenharia         |
| Banco de testes para integração                   | Testes de reset podem ficar frágeis                                  | Definir Postgres descartável ou repositório fake               | Engenharia         |

## 12. Rollout e migração

- Não há nova tabela; a tabela de tokens da fatia 001 já aceita `password_reset` desde a própria fatia 001.
- O placeholder de `/auth/reset-password` é substituído pela página real.
- A página de sign-in passa a exibir a mensagem de sucesso quando recebe `reset=success`.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; tokens e sessões são descartáveis no ambiente local.
- Comunicação: atualizar `.docs` e testes na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** validação de token de reset; expiração, uso único e invalidação; política de senha; confirmação de e-mail no reset; revogação de sessões; mensagem de sucesso.
- **Integração:** `POST /api/v1/auth/reset-password` com token válido, inválido, expirado, reutilizado, senha fraca e confirmação diferente; `GET /api/v1/auth/me` com JWT antigo após o reset; envio do e-mail de sucesso; ausência de PII/token nos logs.
- **E2E (Playwright):** solicitar reset, ler o e-mail na caixa local, abrir o link, definir nova senha, ver a mensagem de sucesso no sign-in, entrar com a nova senha; link inválido; senha diferente; segundo uso do mesmo token; sessão antiga invalidada.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US, inspeção do e-mail de sucesso e do cookie no navegador.
- **Dados de teste:** contas confirmadas e não confirmadas, e-mails e tokens únicos por execução; nenhum dado real.

## 14. Critérios de aceite

- [ ] Dado um token válido, quando a pessoa informa nova senha e confirmação iguais e dentro da política, então a senha é atualizada, o token é consumido, todas as sessões ativas são revogadas, o e-mail de sucesso é enviado e ela é redirecionada para `/auth/sign-in?reset=success`.
- [ ] Dado um token inválido, expirado ou já usado, quando a pessoa tenta redefinir, então a senha não é alterada, nenhuma sessão é criada e a página oferece caminho para solicitar um novo link.
- [ ] Dados senha fora da política ou confirmação diferente, quando o formulário é enviado, então a senha não é alterada, os erros aparecem junto aos campos e a interface continua acessível.
- [ ] Dada uma conta não confirmada, quando o reset é concluído, então o e-mail é confirmado e a pessoa consegue entrar com a nova senha.
- [ ] Dado um reset bem-sucedido, quando a pessoa tenta acessar `/app` com uma sessão antiga, então a sessão é rejeitada; ao entrar com a senha antiga, o acesso falha; com a nova senha, o acesso funciona.
- [ ] Dado o e-mail de sucesso, quando ele é inspecionado, então é en-US, informa a alteração e orienta a solicitar novo reset se não foi a pessoa; falha no envio não reverte a senha.
- [ ] Dado o fluxo de reset, quando a segurança é verificada, então há rate limiting, token de uso único com hash, remoção do token da URL, nenhum token/senha/PII em logs e o sign-in exibe a mensagem de sucesso.

## 15. Decisões e questões abertas

| Tema                         | Decisão ou pergunta                                | Impacto                                     | Dono               | Status                  |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------- | ------------------ | ----------------------- |
| Token de reset               | Uso único, 1 hora, hash em repouso                 | Define expiração e reutilização             | Engenharia         | fechada (default)       |
| Conta não confirmada         | O reset bem-sucedido também confirma o e-mail      | Evita pessoa sem acesso após trocar a senha | Produto/Engenharia | fechada (default)       |
| Revogação de sessões         | Todas as sessões ativas são revogadas após o reset | Protege a conta após troca de senha         | Produto/Engenharia | fechada (2026-11-09)    |
| Falha no e-mail de sucesso   | Senha permanece alterada; falha é registrada       | Evita reverter uma troca válida             | Engenharia         | fechada (default)       |
| Mensagem no sign-in          | `/auth/sign-in?reset=success` exibe confirmação    | Fecha a jornada com feedback claro          | Produto/Engenharia | fechada (2026-11-09)    |
| Política de senha            | Mínimo 8, máximo 128, sem composição obrigatória   | Alinha reset e sign-up                      | Produto/Segurança  | fechada (2026-11-10)    |
| Reutilização da senha antiga | Não há bloqueio nesta entrega                      | Reduz escopo; pode ser evoluído depois      | Produto/Segurança  | aberta (não bloqueante) |
| Rate limiting                | Por IP, 5 tentativas por 60 s, configurável        | Reduz abuso                                 | Engenharia         | fechada (2026-11-10)    |
| Atomicidade                  | Consistência por ordem das escritas, sem transação | Evita nova migração/RPC                     | Engenharia         | fechada (2026-11-10)    |
| Banco de testes              | Postgres descartável ou repositório fake           | Afeta testes de integração e E2E            | Engenharia         | aberta (não bloqueante) |
