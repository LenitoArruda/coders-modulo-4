# Auth forgot password — Spec

> **Status:** done
> **Atualizado em:** 2026-11-10
> **Autor:** Time de engenharia
> **Mapa:** `.plans/001-auth-breakdown.md`
> **Depende de:** `.specs/001-auth-schema.md`, `.specs/002-auth-session.md`, `.specs/003-auth-routes.md`, `.specs/004-auth-sign-up.md`
> **Plano:** `.plans/007-auth-forgot-password-plan.md`

## 1. Contexto e problema

Depois das fatias 004 a 006, a pessoa consegue criar conta, confirmar o e-mail e entrar. Se esquecer a senha, porém, não tem como pedir recuperação: o placeholder de `/auth/forgot-password` não envia e-mail e não existe token de reset. Sem essa fatia, a única saída seria perder a conta.

Esta fatia entrega a solicitação de recuperação com resposta genérica, para não revelar quais e-mails estão cadastrados, e emite um token de reset de uso único com link para `/auth/reset-password?token=...`. A troca de senha em si fica na fatia 008.

## 2. Usuários e jobs

| Usuário                                        | Job                                                                          | Frequência        |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ----------------- |
| Pessoa que esqueceu a senha                    | Solicitar um link de recuperação sem revelar se o e-mail existe              | Eventual          |
| Pessoa com conta não confirmada                | Pedir recuperação e conseguir definir a senha, confirmando o e-mail no reset | Eventual          |
| Pessoa com link inválido, expirado ou já usado | Entender o problema e solicitar um novo link                                 | Eventual          |
| Desenvolvedor(a)                               | Consumir um endpoint com resposta anti-enumeração e token previsível         | A cada integração |

Permissões: `/auth/forgot-password` e `POST /api/v1/auth/forgot-password` são públicos. O token de reset é a credencial de uso único que autoriza a troca na fatia 008. Nenhum papel administrativo participa do fluxo.

## 3. Resultado esperado

Uma pessoa consegue pedir a recuperação em `/auth/forgot-password`, recebe sempre a mesma resposta genérica e, se a conta existir, um e-mail en-US com link para `/auth/reset-password?token=...`. A resposta HTTP não permite descobrir se um e-mail está cadastrado.

O token é opaco, de uso único, com hash em repouso e expiração de 1 hora. Um novo pedido invalida tokens de reset anteriores ainda não usados. A página substitui o placeholder da fatia 003 e o link “Forgot password?” do sign-in passa a funcionar. O template de e-mail de nova sessão passa a incluir o link de recuperação.

## 4. Métricas de sucesso

Não aplicável nesta fatia. A verificação é feita pelos critérios de aceite e pelos testes de recuperação.

## 5. Escopo

### Dentro

- Página pública `/auth/forgot-password` em en-US, substituindo o placeholder, com campo de e-mail, estados de loading/erro/sucesso e link para o sign-in.
- Endpoint `POST /api/v1/auth/forgot-password` com resposta genérica para qualquer e-mail sintaticamente válido.
- E-mail en-US de recuperação com link para `/auth/reset-password?token=...`.
- Token opaco de reset, de uso único, com hash em repouso e expiração padrão de 1 hora.
- Invalidação de tokens de reset anteriores ainda não usados ao gerar um novo.
- Envio de recuperação para contas existentes, confirmadas ou não; o reset bem-sucedido da fatia 008 confirma o e-mail.
- Rate limiting básico no endpoint.
- Atualização do template de e-mail de nova sessão da fatia 002 para incluir o link para `/auth/forgot-password`.
- Atualização de testes, E2E e documentação afetada.

### Fora

- Página `/auth/reset-password` e endpoint de troca de senha; isso entra na fatia 008.
- Validação do token de reset, atualização de senha, revogação de sessões e e-mail de sucesso; isso entra na fatia 008.
- Sign-in, sessão única e e-mail de nova sessão de login; já entregues nas fatias 002 e 006.
- Sign-out, refresh token, “remember me”, MFA, SSO, login social e passkeys.
- Troca de senha por pessoa autenticada dentro de `/app` (fluxo de “change password”).
- Reenvio dedicado de confirmação de conta.
- Histórico de senhas, bloqueio de reutilização de senha antiga e política de expiração de senha.
- Notificação por outros canais (SMS, push) e suporte a múltiplos e-mails.
- Gestão de dispositivos/sessões e lista de sessões ativas.
- Edição de perfil, troca de e-mail, exclusão de conta e permissões por papel.
- Provedor de e-mail de produção e garantias avançadas de deliverability.

## 6. Fluxos

### Fluxo principal — solicitar recuperação

1. A pessoa abre `/auth/forgot-password`.
2. Informa o e-mail e envia o formulário.
3. O web chama `POST /api/v1/auth/forgot-password`.
4. A API valida o formato do e-mail e responde sempre com a mesma mensagem genérica, independentemente de a conta existir.
5. Se a conta existir, a API invalida tokens de reset anteriores não usados, gera um novo token, persiste o hash e envia o e-mail com o link `/auth/reset-password?token=...`.
6. A pessoa recebe a mensagem genérica na tela e, se a conta existir, o e-mail de recuperação.
7. A pessoa abre o link e segue para a fatia 008.

### Fluxos alternativos e de exceção

- E-mail sintaticamente inválido: a API responde `400` com erro de campo; a resposta não revela existência de conta.
- E-mail inexistente: a API responde `200` com a mesma mensagem genérica e não envia e-mail.
- Conta não confirmada: a API responde `200` com a mesma mensagem genérica e envia o e-mail; o reset bem-sucedido da fatia 008 também confirma o e-mail.
- Falha no envio do e-mail de recuperação: a API mantém a resposta genérica, registra a falha sem PII e a pessoa pode tentar novamente.
- Muitas tentativas: a API responde `429` e o web orienta a aguardar, sem revelar se a conta existe.
- Pessoa com sessão ativa abre `/auth/forgot-password`: a página permanece acessível; o reset posterior revoga as sessões na fatia 008.

## 7. Regras e casos de borda

- `POST /api/v1/auth/forgot-password` responde com a mesma mensagem e o mesmo status para qualquer e-mail sintaticamente válido, exista ou não a conta. Isso evita enumeração de contas.
- O e-mail de recuperação só é enviado quando a conta existe; a diferença não é observável na resposta HTTP.
- O token de reset é opaco, de alta entropia, de uso único, com hash em repouso e expiração de 1 hora.
- Um novo pedido invalida tokens de reset anteriores ainda não usados do mesmo usuário.
- O token é enviado no corpo da requisição para a API na fatia 008; o link do e-mail aponta para a página do web.
- O token não aparece em logs, traces, métricas ou mensagens de erro.
- O e-mail de recuperação é en-US, informa a expiração de 1 hora e orienta a ignorar a mensagem se o pedido não foi feito.
- A recuperação funciona para contas confirmadas e não confirmadas; o token prova a posse do endereço e o reset da fatia 008 confirma o e-mail.
- O template de e-mail de nova sessão passa a incluir o link para `/auth/forgot-password`.
- `/auth/forgot-password` é público e permanece acessível mesmo com sessão ativa.
- A UI é light-only, acessível e responsiva em 360 px, 768 px e 1280 px.
- Nenhum token, senha ou PII é registrado em logs, traces ou métricas.

## 8. Dados e contratos

### `POST /api/v1/auth/forgot-password`

```json
{
  "email": "ada@example.com"
}
```

Respostas previstas:

- `200` — `{ "message": "If an account exists for this email, we sent a password reset link." }`
- `400` — e-mail ausente ou sintaticamente inválido, com erro de campo.
- `429` — excesso de tentativas.
- `500` — falha interna sem detalhes.

### E-mail de recuperação

- Assunto: “Reset your password”.
- Corpo en-US com link `/auth/reset-password?token=...`, aviso de expiração de 1 hora e orientação para ignorar se não foi solicitado.
- Em desenvolvimento, o e-mail é inspecionável na caixa de e-mail do Supabase local.

### Persistência

- `auth_tokens` registra `purpose = password_reset`, `token_hash`, `expires_at` e `used_at`.
- O token anterior não usado do mesmo usuário e purpose é invalidado ao emitir um novo.
- O usuário é localizado pelo e-mail normalizado; a resposta não revela se ele existe.

### Navegação

- `/auth/forgot-password` é pública e acessível com ou sem sessão.
- O link “Forgot password?” do sign-in aponta para `/auth/forgot-password`.
- O link do e-mail aponta para `/auth/reset-password?token=...`, implementado na fatia 008.

## 9. Permissões e segurança

- O endpoint é público e não exige sessão.
- A resposta de solicitação não permite enumerar contas; o envio de e-mail é a única diferença interna.
- O token é de uso único, expira em 1 hora e é armazenado com hash; não é logado.
- O token não é incluído em URLs da API, apenas no link do web.
- Rate limiting reduz abuso e não revela existência de conta.
- A API não expõe detalhes internos de banco ou stack em erros.
- Nenhum token, senha ou PII aparece em logs, traces ou métricas.

## 10. Requisitos não funcionais

- `POST /api/v1/auth/forgot-password` responde em até 1 s p95 no ambiente local.
- A página `/auth/forgot-password` atende AA, funciona por teclado, tem foco visível, labels associados, erros com `aria-describedby` e layout funcional em 360 px, 768 px e 1280 px sem rolagem horizontal.
- A UI é light-only e usa os tokens e componentes do design system.
- Textos de UI e e-mails são en-US.
- Logs, métricas e traces continuam chegando ao LGTM sem PII, tokens ou senhas.
- A emissão e a invalidação de tokens são consistentes sob concorrência: dois pedidos simultâneos não podem deixar dois tokens válidos do mesmo purpose.

## 11. Dependências e riscos

| Dependência ou risco                                 | Impacto                                           | Mitigação                                                               | Dono       |
| ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| Spec 001 (users e auth_tokens)                       | Sem schema, não há usuário nem token              | Implementar 001 antes                                                   | Engenharia |
| Spec 002 (porta de e-mail e template de nova sessão) | Sem ela não há envio nem link no e-mail de sessão | Reutilizar a porta e atualizar o template                               | Engenharia |
| Spec 003 (rota `/auth/forgot-password`)              | Sem ela a página não tem onde viver               | Substituir o placeholder                                                | Engenharia |
| Spec 004 (usuários cadastrados)                      | Sem usuários, o fluxo não tem o que recuperar     | Implementar 004 antes                                                   | Engenharia |
| Enumeração de contas                                 | Respostas diferentes revelam e-mails cadastrados  | Resposta genérica e teste dedicado                                      | Segurança  |
| Vazamento de token por URL/logs                      | Comprometimento da troca de senha                 | Não logar, remover da URL na fatia 008 e não carregar recursos externos | Engenharia |
| Reutilização de token                                | Duas trocas de senha com o mesmo link             | Uso único, `used_at` e invalidação de tokens anteriores                 | Engenharia |
| Caixa de e-mail local e SMTP                         | Sem ela não é possível validar o link             | Configurar e documentar a inspeção de e-mails                           | Engenharia |
| Banco de testes para integração                      | Testes de reset podem ficar frágeis               | Definir Postgres descartável ou repositório fake                        | Engenharia |

## 12. Rollout e migração

- Não há nova tabela; a tabela de tokens da fatia 001 passa a aceitar o purpose `password_reset`.
- O placeholder de `/auth/forgot-password` é substituído pela página real.
- O template de e-mail de nova sessão é atualizado para incluir o link de recuperação.
- O link “Forgot password?” do sign-in passa a funcionar.
- Não há feature flag nesta entrega.
- Rollback: reverter o commit; tokens são descartáveis no ambiente local.
- Comunicação: atualizar `.docs` e testes na mesma mudança.

## 13. Estratégia de teste

- **Unitário:** validação de e-mail; resposta genérica; geração, hash, expiração, uso único e invalidação de token de reset; comportamento para conta não confirmada.
- **Integração:** `POST /api/v1/auth/forgot-password` com e-mail existente, inexistente, não confirmado, inválido e rate limited; envio do e-mail; ausência de PII/token nos logs.
- **E2E (Playwright):** abrir `/auth/forgot-password`, solicitar recuperação, confirmar a mensagem genérica e localizar o e-mail na caixa local com o link `/auth/reset-password?token=...`.
- **Manual:** teclado, leitor de tela, foco visível, contraste AA, 360/768/1280 px, light-only, textos en-US, inspeção do e-mail de recuperação e do template de nova sessão.
- **Dados de teste:** contas confirmadas e não confirmadas, e-mails e tokens únicos por execução; nenhum dado real.

## 14. Critérios de aceite

- [ ] Dado qualquer e-mail sintaticamente válido, quando a pessoa solicita recuperação em `/auth/forgot-password`, então a API responde `200` com a mesma mensagem genérica, exista ou não a conta, e nenhum dado de cadastro é revelado.
- [ ] Dada uma conta existente, quando a recuperação é solicitada, então um e-mail en-US é enviado com link `/auth/reset-password?token=...`, token de uso único que expira em 1 hora e invalida tokens anteriores não usados.
- [ ] Dado um e-mail inexistente, quando a recuperação é solicitada, então a API responde `200` com a mesma mensagem genérica e nenhum e-mail é enviado.
- [ ] Dada uma conta não confirmada, quando a recuperação é solicitada, então a API responde `200` com a mesma mensagem genérica, o e-mail é enviado e o reset da fatia 008 poderá confirmar o endereço.
- [ ] Dado um e-mail sintaticamente inválido, quando o formulário é enviado, então a API responde `400` com erro de campo, sem criar token e sem revelar existência de conta.
- [ ] Dada falha no envio do e-mail, quando a recuperação é solicitada, então a resposta continua genérica, a falha é registrada sem PII e a pessoa pode tentar novamente.
- [ ] Dado o fluxo e a documentação, quando a entrega é verificada, então há rate limiting, o e-mail de nova sessão contém o link de recuperação, a UI é en-US/light-only/acessível e nenhum token ou PII aparece em logs.

## 15. Decisões e questões abertas

| Tema                                         | Decisão ou pergunta                                               | Impacto                                        | Dono               | Status                  |
| -------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | ------------------ | ----------------------- |
| Resposta de recuperação                      | Sempre genérica para e-mail sintaticamente válido                 | Evita enumeração de contas                     | Produto/Segurança  | fechada (2026-11-09)    |
| TTL do token de reset                        | 1 hora, uso único                                                 | Define expiração e mensagem de erro            | Engenharia         | fechada (default)       |
| Conta não confirmada                         | Recebe recuperação; o reset bem-sucedido também confirma o e-mail | Evita pessoa sem acesso após trocar a senha    | Produto/Engenharia | fechada (default)       |
| Falha no e-mail de recuperação               | Resposta continua genérica; falha é registrada                    | Evita revelar existência de conta              | Engenharia         | fechada (default)       |
| Link de recuperação no e-mail de nova sessão | Adicionado nesta fatia                                            | Torna o e-mail de sessão útil para recuperação | Produto/Engenharia | fechada (2026-11-09)    |
| Rate limiting                                | Limites configuráveis por e-mail e/ou IP                          | Reduz abuso sem revelar contas                 | Engenharia         | aberta (não bloqueante) |
| Banco de testes                              | Postgres descartável ou repositório fake                          | Afeta testes de integração e E2E               | Engenharia         | aberta (não bloqueante) |
