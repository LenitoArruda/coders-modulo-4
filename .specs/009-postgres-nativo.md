# PostgreSQL nativo sem Supabase — Spec

> **Status:** done
> **Atualizado em:** 2026-11-12
> **Autor:** Time de engenharia
> **Plano:** `.plans/009-postgres-nativo-plan.md`

## 1. Contexto e problema

A fundação usa o **Supabase local via CLI** para entregar PostgreSQL, mas o produto consome apenas
o banco: a autenticação é própria da API, não há uso de Supabase Auth e o Storage nunca foi usado.
Na prática, o projeto carrega uma stack inteira (PostgREST, Studio, Auth, Storage, Realtime, Edge
Runtime e caixa de e-mail local) para usar um único componente: o PostgreSQL.

Esse acoplamento tem custo concreto:

- o setup local exige CLI, configuração extensa e mais containers do que o necessário;
- o acesso ao banco passa pelo PostgREST e por credenciais `anon`/`service_role`, em vez de uma
  conexão PostgreSQL direta;
- a API precisa de três variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY` e
  `SUPABASE_SERVICE_ROLE_KEY`) quando bastaria uma string de conexão;
- o schema depende de papéis e grants específicos do Supabase, o que dificulta trocar de provedor
  PostgreSQL;
- a versão local do PostgreSQL está presa ao workaround do Supabase (15), enquanto o projeto já
  pode adotar uma versão estável e suportada;
- scripts, testes de banco, documentação, observabilidade e testes de carga replicam detalhes do
  Supabase, aumentando a superfície de manutenção.

Agora que o único requisito real é um PostgreSQL acessível por `DATABASE_URL`, remover o Supabase
simplifica o ambiente, reduz dependências e deixa o banco portável entre Docker local e qualquer
provedor gerenciado.

## 2. Usuários e jobs

| Usuário                 | Job                                                                                            | Frequência                             |
| ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| Pessoa desenvolvedora   | Subir o ambiente local, aplicar migrações, rodar testes de schema e inspecionar o banco        | A cada ambiente novo e dia de trabalho |
| Engenharia/operação     | Provisionar um PostgreSQL e conectar a API apenas com `DATABASE_URL`                           | A cada ambiente/deploy                 |
| Pessoa usando o produto | Cadastrar-se, confirmar e-mail, entrar, recuperar senha e sair sem perceber a troca de banco   | Indireta                               |
| Engenharia de segurança | Auditar credenciais, isolamento do banco, queries parametrizadas e ausência de chaves públicas | Eventual                               |

Permissões: apenas a API acessa o banco, usando a credencial de `DATABASE_URL`. O navegador nunca
abre conexão com o PostgreSQL e não recebe credencial de banco.

## 3. Resultado esperado

- `bun run infra:up` sobe **Grafana LGTM + PostgreSQL 18 via Docker**, sem CLI ou containers do
  Supabase.
- A API inicia com **apenas `DATABASE_URL`** como configuração de banco, sem `SUPABASE_*`.
- `bun run db:migrate` aplica migrações SQL versionadas em um banco vazio e é idempotente.
- `bun run db:test` executa os testes de schema no PostgreSQL nativo, sem `supabase test db`.
- Os fluxos de auth existentes (sign-up, confirmação, sign-in, `me`, sign-out, forgot-password e
  reset-password) continuam com o mesmo contrato e comportamento observável.
- Código, configuração e documentação vigente não dependem mais de Supabase, PostgREST,
  `anon`/`authenticated`/`service_role` nem da CLI do Supabase.
- A observabilidade continua registrando spans e métricas do PostgreSQL, agora apontando para o
  banco do Compose.

## 4. Métricas de sucesso

- **0 ocorrências** de `supabase`, `postgrest`, `service_role`, `SUPABASE_*` ou `supabase-js` em
  código de runtime, configuração, scripts, testes, Compose e documentação vigente (specs e planos
  históricos ficam de fora).
- **1 comando** (`bun run infra:up`) sobe toda a infraestrutura local necessária; **1 variável**
  (`DATABASE_URL`) configura o banco na API.
- **100%** dos testes unitários, de integração, de schema e E2E existentes passando.
- **2 execuções consecutivas** de `bun run db:migrate` no mesmo banco: a segunda não reaplica
  nenhuma migração.
- **0 containers** do Supabase em execução após subir o ambiente local.

## 5. Escopo

### Dentro

- Adicionar o PostgreSQL **18** ao Compose local, com healthcheck, volume, porta local e
  credenciais restritas ao ambiente de desenvolvimento.
- Fazer `infra:up` e `infra:down` orquestrarem apenas o Compose (LGTM + PostgreSQL), de forma
  idempotente, sem chamadas à CLI do Supabase.
- Introduzir `DATABASE_URL` como única variável de banco exigida pela API, validada no boot e
  tratada como segredo.
- Substituir o acesso via SDK do Supabase/PostgREST por **acesso direto ao PostgreSQL com `pg` e
  SQL parametrizado** (decisão aprovada).
- Preservar o comportamento dos repositórios de usuários, tokens e sessões: leitura, criação,
  atualização condicional, revogação, expiração, ordenação implícita e mapeamento de erros.
- Preservar os spans de banco e o mapeamento de falhas sem vazar SQL, dados de linha ou
  credenciais.
- Substituir as migrações da CLI por migrações SQL versionadas e um executor próprio com controle
  de migrações aplicadas, transação por migração e proteção contra execução concorrente.
- Manter o schema de `users`, `auth_tokens` e `sessions` (colunas, constraints, índices,
  relacionamentos e `ON DELETE CASCADE`), removendo papéis, grants e metadados específicos do
  Supabase.
- Manter RLS habilitado nas tabelas de auth, sem policies para papéis públicos, como defesa em
  profundidade; nenhum papel `anon`, `authenticated` ou `service_role` é criado.
- Converter os testes de schema para SQL executado contra o PostgreSQL do Compose, cobrindo
  constraints, cascata, consultas de token/sessão ativos, `updated_at` e ausência de papéis do
  Supabase.
- Adaptar o seed dos testes de carga para gravar e remover usuários via `DATABASE_URL`, mantendo
  a recusa de execução contra bancos não locais.
- Atualizar a coleta de métricas do PostgreSQL e os textos da dashboard para o novo serviço.
- Remover a CLI do Supabase, a configuração local, o SDK, os scripts de banco e as variáveis de
  ambiente do Supabase.
- Atualizar a documentação vigente (README, guia de agentes, arquitetura, desenvolvimento, QA e
  testes de carga) e registrar a decisão em ADR, substituindo o ADR do Supabase local.
- Descartar os dados do Supabase local. Não há migração de dados nesta entrega.

### Fora

- Escolher ou provisionar o provedor PostgreSQL de produção, backups, alta disponibilidade,
  pooler gerenciado e política de retenção.
- Migrar dados existentes do Supabase local; o banco local é descartável e sem dados reais.
- Alterar regras de negócio, schema lógico, contratos de auth, códigos de resposta ou textos de UI.
- Substituir o Mailtrap; o envio de e-mail continua pela API do Mailtrap, e a caixa de e-mail
  local do Supabase não será recriada.
- Implementar Storage, Auth, Realtime, Edge Functions ou qualquer outro produto do Supabase.
- Introduzir ORM ou query builder; a decisão é SQL puro com `pg`.
- Reescrever specs e planos históricos (`.specs/000`–`008` e planos já concluídos); eles registram
  o estado da época.
- Criar pipeline de CI ou automação de deploy.

## 6. Fluxos

### Fluxo principal — ambiente local

1. A pessoa desenvolvedora copia o `.env.example` para `.env` e preenche o `DATABASE_URL` local.
2. Executa `bun run infra:up`.
3. O Compose sobe o LGTM e o PostgreSQL 18; o comando aguarda o banco ficar saudável.
4. Executa `bun run db:migrate`; todas as migrações pendentes são aplicadas e registradas.
5. Executa `bun run db:test`; os testes de schema rodam contra o PostgreSQL local.
6. Executa `bun run dev`; a API conecta usando apenas `DATABASE_URL`.
7. Os fluxos de auth funcionam contra o banco nativo.
8. `bun run infra:down` para o Compose de forma idempotente.

### Fluxo principal — API em execução

1. A API valida `DATABASE_URL` no boot.
2. Abre um pool de conexões PostgreSQL.
3. Cada repositório executa SQL parametrizado e mapeia o resultado para o domínio.
4. Violações de constraint são traduzidas para os erros de domínio existentes (por exemplo,
   e-mail duplicado).
5. Atualizações condicionais preservam as garantias de uso único de token, sessão ativa e
   `email_confirmed_at`.
6. Falhas são registradas com operação e código SQL, sem SQL completo, dados de linha ou
   credenciais.

### Fluxos alternativos e de exceção

- `DATABASE_URL` ausente ou sintaticamente inválida: a API não inicia e informa o problema sem
  imprimir a credencial.
- Banco indisponível: falhas de conexão são reportadas sem expor a string de conexão; a API se
  recupera quando o banco volta, sem exigir reinício.
- Migração falha: a migração não é marcada como aplicada e o comando termina com erro; as
  migrações anteriores já aplicadas permanecem válidas.
- Duas execuções de migração simultâneas: apenas uma aplica; a outra aguarda ou sai sem reaplicar.
- Banco já migrado: a segunda execução não reaplica nada.
- Banco com dados do Supabase local: não é reaproveitado; o ambiente é recriado do zero.
- E-mail duplicado em corrida: a violação de unicidade vira o mesmo erro de domínio e o mesmo
  `409` de hoje.
- Token já consumido ou sessão revogada: a atualização condicional não afeta linhas e o fluxo
  responde como hoje.
- Postgres reinicia: o pool reconecta e as requisições seguintes voltam a funcionar.

## 7. Regras e casos de borda

- `DATABASE_URL` é obrigatória, deve usar esquema `postgres://` ou `postgresql://` e nunca pode
  aparecer em logs, respostas, traces ou mensagens de erro.
- Nenhuma variável `SUPABASE_*` é exigida, aceita ou documentada para a API.
- A API é o único cliente do banco; o navegador não recebe host, porta, usuário, senha ou string
  de conexão.
- Todo SQL é parametrizado; valores de entrada nunca são concatenados na query.
- O schema preserva exatamente as colunas, constraints, índices, expressões de unicidade
  (`lower(email)`), timestamps e cascatas descritos nas specs de auth.
- O controle de migrações é interno ao projeto e independente de metadados do Supabase.
- Migrações são transacionais: uma migração com erro não deixa efeito parcial registrado.
- O executor de migrações é seguro sob concorrência e idempotente.
- As tabelas de auth mantêm RLS habilitado e nenhuma policy pública; o usuário da API é o dono do
  schema e acessa o banco diretamente.
- Os papéis `anon`, `authenticated` e `service_role` não existem no banco nativo e não são
  referenciados por migrations, testes ou documentação vigente.
- O PostgreSQL local escuta apenas em loopback e usa credenciais de desenvolvimento.
- O seed de carga só executa contra host local; qualquer `DATABASE_URL` não local é recusado.
- E-mails, tokens, senhas e JWTs continuam fora de logs e métricas.
- A versão local do PostgreSQL é 18; qualquer SQL usado deve funcionar nessa versão.

## 8. Dados e contratos

### Variável de ambiente

| Variável       | Obrigatória | Formato                          | Uso                                   |
| -------------- | ----------- | -------------------------------- | ------------------------------------- |
| `DATABASE_URL` | Sim         | `postgresql://user:pass@host/db` | Conexão da API e dos scripts de banco |

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` deixam de existir
no `.env.example`, na validação de ambiente e na documentação vigente.

### Schema

| Tabela        | Contrato preservado                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `users`       | Nome, sobrenome, e-mail normalizado e único case-insensitive, hash de senha, confirmação e timestamps |
| `auth_tokens` | Token opaco de uso único por hash, `purpose`, expiração, consumo e cascata a partir do usuário        |
| `sessions`    | Sessão server-side com origem, expiração, revogação e cascata a partir do usuário                     |

- A API mantém os mesmos endpoints, payloads e códigos de resposta das specs 002–008.
- Não há API REST exposta pelo banco; o PostgREST deixa de existir.
- O banco local é recriado do zero; nenhum dado do Supabase é importado.
- A tabela de controle de migrações é um detalhe interno e não faz parte do domínio.

## 9. Permissões e segurança

- `DATABASE_URL` é segredo de servidor e vive apenas em `.env`/ambiente do processo; nunca em
  `NEXT_PUBLIC_*`, código, logs ou respostas.
- A credencial local do Compose é exclusiva de desenvolvimento e não deve ser reutilizada em
  produção.
- As chaves de demonstração do Supabase local não têm valor de produção e deixam de existir no
  projeto; se algum ambiente externo tiver usado esses valores, devem ser considerados expostos.
- O banco não é exposto à internet no ambiente local; a porta publicada fica restrita a loopback.
- RLS permanece habilitado sem policies públicas como defesa em profundidade, mesmo com a API
  conectando como dono do schema.
- Erros de banco não vazam SQL, nomes de colunas sensíveis, valores de linha, stack ou string de
  conexão.
- O isolamento por workspace/tenant continua fora desta entrega, como já estava.

## 10. Requisitos não funcionais

- **Setup reproduzível:** uma máquina limpa com Bun, Node.js e Docker executa `bun install`,
  `bun run infra:up` e `bun run db:migrate` sem instalar ferramenta global.
- **Idempotência:** `infra:up`, `infra:down`, `db:migrate` e o seed de carga podem ser repetidos
  sem efeitos duplicados.
- **Saúde do banco:** o Compose só é considerado pronto quando o PostgreSQL responde ao
  healthcheck.
- **Concorrência:** o executor de migrações não aplica a mesma migração duas vezes.
- **Confiabilidade:** o pool de conexões é limitado, fecha no shutdown e não vaza conexões.
- **Observabilidade:** traces continuam com spans `db.system=postgresql` e as métricas do
  PostgreSQL continuam chegando ao LGTM, agora com o novo nome de serviço.
- **Performance:** os thresholds dos testes de carga existentes (`hello`, `me`, `sign-out`,
  `sign-in`) não sofrem regressão mensurável; nenhuma meta nova é inventada nesta entrega.
- **Compatibilidade:** o SQL e o schema funcionam no PostgreSQL 18 local e em um PostgreSQL
  gerenciado compatível, usando apenas `DATABASE_URL`.

## 11. Dependências e riscos

| Dependência/Risco                              | Impacto                                                              | Mitigação                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Docker Desktop em execução                     | Sem ele, PostgreSQL e LGTM não sobem                                 | `infra:up` falha com mensagem clara antes de tentar subir                     |
| Dependência `pg` no lugar do SDK do Supabase   | Muda a camada de acesso e exige reescrita dos repositórios           | SQL parametrizado, testes de repositório e testes de schema                   |
| Diferenças semânticas entre PostgREST e SQL    | `maybeSingle`, `single`, timestamps e códigos de erro podem divergir | Testes de integração por fluxo e de schema cobrindo os casos críticos         |
| Migração aplicada sem controle confiável       | Risco de schema parcial ou reaplicação                               | Controle próprio, transação por migração e teste de idempotência/concorrência |
| Remoção de RLS/roles específicos do Supabase   | Pode abrir ou bloquear acesso indevido                               | Manter RLS sem policies, usar dono do schema e testar privilégios             |
| Perda dos dados locais do Supabase             | Dados de desenvolvimento somem                                       | Aceito: ambiente descartável, sem dados reais                                 |
| Versão 18 do PostgreSQL no Docker              | Imagem/tag pode não estar disponível ou mudar comportamento          | Fixar a versão e validar migrações e testes de schema                         |
| Conflito de porta local com PostgreSQL externo | `infra:up` falha na subida                                           | Porta definida no Compose e refletida no `DATABASE_URL` de exemplo            |
| Provedor de banco de produção ainda aberto     | Deploy pode exigir SSL/pooler específicos                            | `DATABASE_URL` mantém a aplicação portável; decisão fica em aberto            |
| Configuração do coletor de métricas            | Dashboard pode ficar sem métricas do banco                           | Atualizar endpoint e `service.name` junto com o Compose                       |

## 12. Rollout e migração

- **Tipo de entrega:** mudança interna de infraestrutura, sem feature flag e sem impacto direto
  em usuários do produto.
- **Ordem de rollout:**
  1. parar a stack antiga do Supabase;
  2. remover CLI, configuração, SDK, variáveis e artefatos específicos;
  3. adicionar o serviço PostgreSQL 18 ao Compose e atualizar `infra:up/down`;
  4. trocar a camada de acesso e as migrações;
  5. converter os testes de schema e o seed de carga;
  6. atualizar observabilidade e documentação;
  7. recriar o banco local e validar o fluxo completo de auth.
- **Dados:** não há migração. O banco local do Supabase é descartado e o novo PostgreSQL é
  migrado do zero.
- **Compatibilidade:** `.env` locais precisam substituir as três variáveis do Supabase por
  `DATABASE_URL`; a API deve falhar com mensagem clara se a variável nova estiver ausente.
- **Rollback:** reverter a mudança, restaurar a configuração antiga e recriar o Supabase local.
  Como não há dados reais, o rollback não exige restauração de dados.
- **Comunicação:** README, QA, arquitetura e guia de agentes passam a documentar apenas o caminho
  nativo; um ADR registra a substituição da decisão anterior.

## 13. Estratégia de teste

### Unitário

- Validação de `DATABASE_URL`: ausente, vazia, esquema inválido e valor válido; nenhuma mensagem
  expõe a credencial.
- Repositórios: mapeamento de linhas, queries parametrizadas, resultado vazio, atualização
  condicional verdadeira/falsa e tradução de violação de unicidade para e-mail duplicado.
- Erros de banco: operação e código registrados, sem SQL completo, linha ou string de conexão.
- Spans de banco: atributos de tabela/operação e status de erro preservados.

### Integração

- Todos os fluxos de auth existentes (002–008) continuam passando com os fakes em memória.
- Nenhum teste de integração da API depende de Supabase, PostgREST ou das variáveis removidas.
- E2E do web permanece inalterado, pois usa a API fake local.

### Banco de dados

- Aplicar todas as migrações em um banco vazio e validar o schema.
- Reaplicar e confirmar que nada é executado novamente.
- Executar duas migrações concorrentes e confirmar que cada uma é aplicada uma única vez.
- Forçar uma migração com erro e confirmar que ela não é registrada nem deixa efeito parcial.
- Testes SQL de schema: constraints, unicidade case-insensitive, cascata, consultas de token e
  sessão ativos, `updated_at`, RLS habilitado, ausência de policies e ausência dos papéis
  `anon`, `authenticated` e `service_role`.

### Carga e manual

- `load:seed` e `load:clean` funcionam via `DATABASE_URL` e recusam banco não local.
- Jornada manual completa com PostgreSQL real: sign-up → confirmação → sign-in → `me` →
  sign-out → forgot-password → reset-password.
- Confirmar que não há containers, portas, processos ou CLI do Supabase em execução.
- Executar `bun run lint`, `bun run types:check`, `bun run test`, `bun run build` e
  `bun run test:e2e`.

## 14. Critérios de aceite

- [x] Dado um ambiente limpo com Docker, quando executo `bun run infra:up`, então o PostgreSQL 18 e o LGTM sobem saudáveis e nenhum container ou processo do Supabase é iniciado.
- [x] Dado o ambiente local no ar, quando executo `bun run infra:down`, então PostgreSQL e LGTM param e uma segunda execução termina sem erro.
- [x] Dado um banco vazio e `DATABASE_URL` válido, quando executo `bun run db:migrate`, então todas as migrações são aplicadas e registradas.
- [x] Dado um banco já migrado, quando executo `bun run db:migrate` novamente, então nenhuma migração é reaplicada.
- [x] Dado um banco vazio, quando executo `bun run db:test`, então os testes de schema passam no PostgreSQL 18 sem a CLI do Supabase.
- [x] Dado apenas `DATABASE_URL` configurado entre as variáveis de banco, quando a API inicia, então o boot conclui sem exigir `SUPABASE_*`.
- [x] Dado `DATABASE_URL` ausente ou inválido, quando a API inicia, então o processo falha com mensagem clara e não imprime a credencial.
- [x] Dado o banco indisponível, quando a API recebe uma requisição de auth, então responde com o contrato de erro existente, sem SQL, stack ou string de conexão.
- [x] Dado um sign-up com e-mail já existente, quando a API tenta criar a conta, então responde `409` e não cria linha duplicada.
- [x] Dado um token de confirmação válido, quando a confirmação é processada, então o token é consumido uma única vez, a conta é confirmada e a sessão é criada.
- [x] Dado um token de reset válido, quando a senha é trocada, então a senha antiga deixa de funcionar, as sessões são revogadas e o token não pode ser reutilizado.
- [x] Dado um token já usado ou uma sessão revogada, quando a API valida o acesso, então o comportamento é o mesmo de antes da migração.
- [x] Dado o seed de carga, quando executo `bun run load:seed` e `bun run load:clean`, então os usuários `loadtest-*` são criados e removidos via `DATABASE_URL`, e um banco não local é recusado.
- [x] Dado o ambiente em execução, quando consulto os traces e métricas no Grafana, então os spans de banco e as métricas do PostgreSQL aparecem com o novo serviço, sem referência ao Supabase.
- [x] Dado o repositório após a mudança, quando busco por `supabase`, `postgrest`, `service_role` ou `SUPABASE_` em código, configuração, scripts, testes e documentação vigente, então não há ocorrências de runtime (specs e planos históricos excluídos).
- [x] Dado o repositório após a mudança, quando executo `bun run lint`, `bun run types:check`, `bun run test` e `bun run build`, então todos passam.

## 15. Decisões e questões abertas

| Tema                            | Decisão ou pergunta                                                                               | Impacto                                                         | Dono       | Status                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- | ----------------------- |
| Acesso ao banco                 | Usar `pg` com SQL puro e parametrizado; sem ORM ou query builder                                  | Define a reescrita dos repositórios e o estilo das queries      | Engenharia | fechada (2026-11-12)    |
| Migrações e testes de schema    | Manter SQL versionado, executor próprio com controle de aplicadas e testes SQL no PostgreSQL real | Substitui a CLI e o pgTAP sem trocar de ecossistema             | Engenharia | fechada (2026-11-12)    |
| Versão local do PostgreSQL      | PostgreSQL 18                                                                                     | Define a imagem do Compose e a compatibilidade do SQL           | Engenharia | fechada (2026-11-12)    |
| Dados locais existentes         | Descartar o banco do Supabase e recriar do zero                                                   | Não há migração de dados; perda aceita no ambiente local        | Engenharia | fechada (2026-11-12)    |
| RLS e papéis                    | Manter RLS habilitado sem policies públicas e sem criar `anon`, `authenticated` ou `service_role` | Preserva defesa em profundidade sem herdar o modelo do Supabase | Engenharia | fechada (2026-11-12)    |
| E-mail local                    | Continuar apenas com Mailtrap; não recriar a caixa de e-mail local do Supabase                    | Muda o QA manual; não muda o comportamento da API               | Engenharia | fechada (2026-11-12)    |
| Provedor PostgreSQL de produção | Qual serviço gerenciado será usado? Exige SSL, pooler ou restrições de rede?                      | Define configuração de deploy e política de conexão             | Engenharia | aberta (não bloqueante) |
| Pool de conexões                | Qual tamanho máximo e timeout? Depende do provedor e do número de instâncias da API               | Afeta capacidade e esgotamento de conexões                      | Engenharia | aberta (não bloqueante) |
| Backups e retenção              | Qual política de backup, retenção e restauração será adotada?                                     | Fora do escopo desta entrega, mas necessária antes de produção  | Engenharia | aberta (não bloqueante) |
