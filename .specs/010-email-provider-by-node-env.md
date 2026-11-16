# Email provider selection by NODE_ENV — Spec

> **Status:** done
> **Atualizado em:** 2026-11-16
> **Autor:** OpenCode Agent
> **Plano:** `.plans/010-email-provider-by-node-env-plan.md`

## 1. Contexto e problema

O envio de e-mail transacional da API (confirmação de conta, nova sessão, recuperação e troca de
senha) está acoplado a um único provedor (Mailtrap) e às variáveis `MAILTRAP_*`. Isso impede usar
um provedor adequado para produção e obriga a configuração de credenciais de Mailtrap mesmo quando
o ambiente não deveria usá-las.

É necessário selecionar o provedor de e-mail com base no ambiente de execução: produção deve usar
Resend e ambientes não produtivos devem usar Mailtrap, com valor padrão seguro e não obrigatório para
`NODE_ENV` em desenvolvimento.

## 2. Usuários e jobs

| Usuário              | Job                                                                     | Frequência                     |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| Desenvolvedor(a)     | Rodar a API localmente/dev sem definir `NODE_ENV` e enviar via Mailtrap | Diária no desenvolvimento      |
| Operador(a)/DevOps   | Configurar o ambiente de produção para enviar e-mails via Resend        | No deploy e em mudanças de env |
| Pessoa usuária final | Receber e-mails transacionais normalmente, independente do ambiente     | A cada fluxo de autenticação   |

## 3. Resultado esperado

A API passa a escolher o provedor de e-mail transacional conforme `NODE_ENV`:

- `production` → Resend.
- Qualquer outro valor (não produção), incluindo quando `NODE_ENV` não está definido → Mailtrap,
  assumindo `dev` como valor padrão efetivo.

A validação e o conjunto de variáveis de ambiente exigidas passam a refletir o provedor ativo, de
forma que produção não dependa de credenciais Mailtrap e não produção não dependa de credenciais
Resend. Os fluxos de autenticação que enviam e-mail continuam funcionando com o mesmo comportamento
observável para a pessoa usuária.

## 4. Métricas de sucesso

- 100% dos e-mails transacionais em ambiente com `NODE_ENV=production` são enviados pelo provedor
  Resend configurado.
- 100% dos e-mails transacionais em ambiente não produtivo (ou sem `NODE_ENV` explícito) são
  enviados pelo provedor Mailtrap configurado.
- A API inicializa com sucesso em desenvolvimento sem `NODE_ENV` definido, desde que as variáveis do
  provedor Mailtrap estejam válidas.

## 5. Escopo

### Dentro

- Introduzir `NODE_ENV` como variável de ambiente **opcional**, com padrão `dev` quando ausente ou
  não definida explicitamente.
- Seleção de provedor de e-mail por ambiente:
  - `NODE_ENV=production` (valor exato, comparação definida na implementação conforme convenção do
    projeto) → usar Resend.
  - Demais casos (não produção, incluindo `dev`, `test`, `staging` e valor ausente/padrão `dev`) →
    usar Mailtrap.
- Ajustar a configuração/validação de ambiente para exigir apenas as credenciais do provedor ativo
  em cada modo, mantendo mensagens de erro de configuração claras (variáveis ausentes/inválidas).
- Suporte a envio transacional via Resend para os mesmos tipos de e-mail já existentes (confirmação
  de conta, nova sessão, recuperação de senha e senha alterada), preservando remetente, assunto,
  conteúdo e destinatário.
- Manter suporte a Mailtrap em não produção, incluindo as opções já existentes de sandbox quando
  aplicável ao modo Mailtrap.
- Atualizar `.env.example`, documentação técnica (`.docs/*`) e specs afetadas para refletir o novo
  contrato de variáveis e a seleção por ambiente.
- Cobertura de testes para a seleção de provedor, o padrão de `NODE_ENV` e a validação condicional
  de variáveis.

### Fora

- Criação de novos tipos de e-mail ou alteração de copy/templates além do necessário para manter
  paridade entre provedores.
- Estratégias avançadas de deliverability, domínio dedicado, DKIM/SPF, webhooks, tracking, métricas
  de abertura/clique ou fallback automático entre provedores.
- Mudanças em fluxos de autenticação, regras de negócio, UI web ou contratos HTTP das rotas de auth,
  exceto o necessário para manter o envio funcionando.
- Suporte a múltiplos provedores simultâneos, roteamento por tenant/usuário ou feature flag de
  provedor.
- Provisionamento de contas/credenciais nos provedores e configuração de infraestrutura de produção.

## 6. Fluxos

### Fluxo principal — envio em não produção (Mailtrap)

1. A API inicia em ambiente sem `NODE_ENV` definido explicitamente (ou com valor não produtivo).
2. O ambiente efetivo é tratado como `dev` quando ausente, e o provedor selecionado é Mailtrap.
3. A configuração valida as variáveis necessárias para Mailtrap e carrega as opções aplicáveis.
4. Um fluxo de autenticação dispara um e-mail transacional.
5. O e-mail é enviado via Mailtrap com o mesmo conteúdo/remetente esperado.

### Fluxo principal — envio em produção (Resend)

1. A API inicia com `NODE_ENV=production`.
2. O provedor selecionado é Resend.
3. A configuração valida as variáveis necessárias para Resend.
4. Um fluxo de autenticação dispara um e-mail transacional.
5. O e-mail é enviado via Resend com o mesmo conteúdo/remetente esperado.

### Fluxos alternativos e de exceção

- `NODE_ENV` ausente: tratado como `dev` (não produção) e segue o fluxo de Mailtrap.
- `NODE_ENV` definido com valor diferente de `production` (ex.: `dev`, `development`, `test`,
  `staging`): segue o fluxo de Mailtrap.
- Variável obrigatória do provedor ativo ausente ou inválida: a API falha na validação de
  configuração no boot (ou no ponto de carregamento de env), com identificação clara da variável.
- Variáveis do provedor inativo presentes: não devem impedir a inicialização quando o provedor ativo
  está corretamente configurado (comportamento exato a definir, ver decisões abertas).
- Falha no envio pelo provedor ativo: o comportamento de erro permanece o já definido por cada
  fluxo de autenticação (ex.: respostas e logs sem vazar segredos/PII).

## 7. Regras e casos de borda

- `NODE_ENV` **não é obrigatória**. Quando não definida explicitamente, o valor padrão efetivo é
  `dev`.
- `NODE_ENV=production` seleciona **exclusivamente** Resend. Qualquer outro valor efetivo seleciona
  Mailtrap.
- A comparação de `NODE_ENV` deve ser determinística; espaços em branco e capitalização não devem
  causar seleção ambígua (detalhe de normalização documentado no plano/implementação).
- A seleção de provedor não altera os gatilhos de envio existentes: os mesmos eventos continuam
  disparando os mesmos e-mails.
- Nenhum segredo (tokens/chaves de API), conteúdo sensível ou PII é exposto em logs, erros ou
  documentação de exemplo; `.env.example` contém apenas nomes e placeholders.
- Em produção, credenciais de Mailtrap não devem ser exigidas; em não produção, credenciais de
  Resend não devem ser exigidas.
- Configuração inválida do provedor ativo deve falhar de forma explícita, sem fallback silencioso
  para o outro provedor.

## 8. Dados e contratos

### Variáveis de ambiente

| Variável   | Obrigatória | Padrão | Descrição                                                                        |
| ---------- | ----------- | ------ | -------------------------------------------------------------------------------- |
| `NODE_ENV` | Não         | `dev`  | Ambiente de execução; `production` seleciona Resend, demais selecionam Mailtrap. |

Variáveis específicas por provedor:

- **Resend (quando `NODE_ENV=production`)**: `RESEND_API_KEY` (segredo) e os dados de remetente
  compartilhados `MAIL_FROM_EMAIL` e `MAIL_FROM_NAME`.
- **Mailtrap (quando não produção)**: token de API Mailtrap e dados de remetente já utilizados
  (`MAILTRAP_API_TOKEN`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`), além das opções de sandbox
  existentes (`MAILTRAP_SANDBOX`, `MAILTRAP_SANDBOX_ID`) quando aplicável.
- **Remetente**: `MAIL_FROM_EMAIL` e `MAIL_FROM_NAME` são compartilhados entre os provedores.
- **Provedor inativo**: variáveis do provedor não selecionado são ignoradas e não participam da
  validação nem do boot.

### Contrato de envio

- Interface de envio transacional permanece única do ponto de vista da aplicação: destinatário,
  assunto, texto/HTML e metadados necessários ao envio.
- O provedor concreto é escolhido por configuração de ambiente, sem mudança no contrato observável
  dos fluxos que solicitam o envio.

## 9. Permissões e segurança

- Não aplicável a permissões de usuário final (mudança restrita à configuração de infraestrutura de
  envio).
- Chaves/tokens de provedores são segredos de ambiente: nunca versionados, nunca logados e nunca
  retornados em respostas.
- A separação por ambiente reduz risco operacional de enviar e-mails reais a partir de ambientes não
  produtivos quando Mailtrap (sandbox/teste) está configurado, e garante uso de provedor de produção
  quando `NODE_ENV=production`.

## 10. Requisitos não funcionais

- **Confiabilidade:** falha de configuração do provedor ativo é detectada cedo e de forma explícita.
- **Observabilidade:** seleção de provedor e falhas de envio seguem registradas sem expor segredos
  ou PII, alinhadas ao padrão atual de logging/telemetria.
- **Manutenibilidade:** a escolha de provedor fica centralizada na configuração/composição da API,
  evitando lógica duplicada nos casos de uso.
- **Compatibilidade:** ambientes de desenvolvimento e testes existentes continuam funcionando sem
  definir `NODE_ENV`, desde que configurados para Mailtrap.

## 11. Dependências e riscos

| Dependência ou risco                                      | Impacto                                    | Mitigação                                                | Dono                |
| --------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- | ------------------- |
| Credenciais e domínio/remetente verificados no Resend     | E-mails não saem em produção               | Validar env e documentar pré-requisitos de configuração  | Engenharia/Operação |
| Nomes e conjunto exato de variáveis do Resend             | Ambiguidade na configuração e na validação | Fechar na decisão aberta antes de implementar            | Engenharia          |
| Mudança na validação de env pode quebrar ambientes locais | Falha de boot em dev/test                  | Manter padrão `dev`/Mailtrap e atualizar `.env.example`  | Engenharia          |
| Paridade de campos de envio entre Mailtrap e Resend       | Diferenças de entrega/conteúdo             | Cobrir com testes e validar os quatro tipos de e-mail    | Engenharia          |
| Ambiguidade de valores de `NODE_ENV` (ex.: `prod`)        | Seleção de provedor incorreta              | Definir regra explícita (apenas `production` usa Resend) | Engenharia          |

## 12. Rollout e migração

- Atualizar `.env.example` e orientações de ambiente: `NODE_ENV` opcional (padrão `dev`) e blocos de
  variáveis separados por provedor.
- Ambientes de não produção devem garantir variáveis de Mailtrap válidas; produção deve garantir
  `NODE_ENV=production` e variáveis de Resend válidas.
- Migração sem alteração de dados; rollback por reversão da configuração/código, retornando ao
  provedor anterior conforme versão implantada.
- Não há feature flag nesta entrega; a seleção é determinada pelo ambiente.

## 13. Estratégia de teste

- **Unitário/configuração:** `NODE_ENV` ausente assume `dev` (Mailtrap); `production` seleciona
  Resend; valores não produtivos selecionam Mailtrap; validação exige apenas variáveis do provedor
  ativo e falha com variáveis ausentes/inválidas do provedor ativo.
- **Integração:** composição do módulo/envio usa o adaptador correto por ambiente e preserva o
  contrato de envio para os e-mails transacionais existentes.
- **Regressão:** fluxos de auth que disparam e-mail continuam com os mesmos resultados observáveis e
  sem vazamento de segredos/PII em logs.
- **Manual:** verificação em ambiente local sem `NODE_ENV` (Mailtrap/sandbox, conforme configuração)
  e verificação em ambiente configurado como produção (Resend) com credenciais válidas.

## 14. Critérios de aceite

- [x] Dado que `NODE_ENV` não está definido explicitamente, quando a API carrega a configuração,
      então o ambiente efetivo é `dev` (não produção), o provedor selecionado é Mailtrap e
      `NODE_ENV` não é tratado como variável obrigatória.
- [x] Dado que `NODE_ENV` está definido com um valor diferente de `production`, quando a API envia
      um e-mail transacional, então o envio ocorre via Mailtrap.
- [x] Dado que `NODE_ENV=production`, quando a API envia um e-mail transacional, então o envio
      ocorre via Resend.
- [x] Dado que o provedor ativo é Mailtrap, quando suas variáveis obrigatórias estão ausentes ou
      inválidas, então a configuração falha de forma explícita identificando as variáveis; variáveis
      de Resend não são exigidas.
- [x] Dado que o provedor ativo é Resend, quando suas variáveis obrigatórias estão ausentes ou
      inválidas, então a configuração falha de forma explícita identificando as variáveis; variáveis
      de Mailtrap não são exigidas.
- [x] Dados os fluxos de confirmação de conta, nova sessão, recuperação de senha e senha alterada,
      quando executados no ambiente correspondente, então cada e-mail é enviado pelo provedor
      selecionado com o conteúdo/remetente esperados e sem exposição de segredos ou PII em logs.

## 15. Decisões e questões abertas

| Tema                                    | Decisão ou pergunta                                                                                                                    | Impacto                                                                     | Dono               | Status               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ | -------------------- |
| Valor padrão de `NODE_ENV`              | Ausente/não definido explicitamente assume `dev` (não produção)                                                                        | Define seleção padrão para Mailtrap em dev                                  | Usuário/Engenharia | fechada (solicitado) |
| Regra de seleção                        | `production` → Resend; qualquer outro valor → Mailtrap                                                                                 | Define roteamento de provedor por ambiente                                  | Usuário/Engenharia | fechada (solicitado) |
| Variáveis de ambiente do Resend         | `RESEND_API_KEY` como segredo; `MAIL_FROM_EMAIL` e `MAIL_FROM_NAME` compartilhados com Mailtrap                                        | Define validação, `.env.example` e migração de ambientes                    | Engenharia         | fechada (2026-11-16) |
| Variáveis de Mailtrap em não produção   | `MAILTRAP_SANDBOX`/`MAILTRAP_SANDBOX_ID` continuam suportados quando Mailtrap é o provedor ativo; remetente permanece em `MAIL_FROM_*` | Preserva o setup local atual                                                | Engenharia         | fechada (2026-11-16) |
| Variáveis do provedor inativo presentes | Ignorar variáveis do provedor não selecionado; a validação exige apenas o provedor ativo                                               | Mantém ergonomia e evita quebrar ambientes que compartilham um único `.env` | Engenharia         | fechada (2026-11-16) |
