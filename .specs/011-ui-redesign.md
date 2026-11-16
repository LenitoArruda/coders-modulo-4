# Redesign de UI e landing pública — Spec

> **Status:** approved
> **Atualizado em:** 2026-11-16
> **Autor:** OpenCode Agent
> **Depende de:** `.specs/003-auth-routes.md`, `.specs/004-auth-sign-up.md`, `.specs/005-auth-confirm-account.md`, `.specs/006-auth-sign-in.md`, `.specs/007-auth-forgot-password.md`, `.specs/008-auth-reset-password.md`
> **Plano:** `.plans/011-ui-redesign-plan.md`

## 1. Contexto e problema

As telas entregues até agora (auth, área privada e páginas 404) foram construídas para provar
fluxos, não para vender o produto. O resultado é um conjunto de páginas funcional, porém visual e
perceptualmente amador: formulários soltos sobre um card branco, shell privado sem identidade,
hierarquia fraca, ausência de presença de marca e nenhuma página pública de apresentação.

Isso tem custo concreto: a primeira impressão do produto é de protótipo, o que reduz confiança
em um produto que se propõe a ser uma plataforma profissional de Experts de IA. Também não existe
evidência visual de antes/depois, então não é possível avaliar objetivamente o ganho do redesign
nem proteger o resultado contra regressões futuras.

Esta fatia eleva a interface existente a um padrão profissional e adiciona a landing pública que
apresenta o produto. O comportamento de autenticação e de sessão não muda.

## 2. Usuários e jobs

| Usuário                                 | Job                                                                  | Frequência |
| --------------------------------------- | -------------------------------------------------------------------- | ---------- |
| Visitante que chega pela primeira vez   | Entender o que é a plataforma, para quem é e criar uma conta         | Uma vez    |
| Pessoa criando conta                    | Cadastrar-se com clareza e saber o que acontece depois do cadastro   | Uma vez    |
| Pessoa com conta existente              | Entrar, recuperar senha e confirmar e-mail com segurança e confiança | Recorrente |
| Pessoa autenticada                      | Reconhecer que está em um produto profissional e sair com facilidade | Recorrente |
| Pessoa que caiu em uma rota inexistente | Entender o que aconteceu e ter um caminho claro de volta             | Eventual   |

Permissões: a landing e as telas de auth continuam públicas; a área privada continua exigindo
sessão válida. Nenhuma regra de autorização muda nesta fatia.

## 3. Resultado esperado

Todas as páginas existentes passam a compartilhar uma direção visual própria, coerente e
profissional, com hierarquia tipográfica clara, uso intencional de espaço, superfícies e
profundidade, estados de formulário desenhados e presença de marca consistente entre as telas
públicas e a área privada. Um visitante não autenticado que abre `/` vê uma landing pública que
apresenta o produto e leva para sign-up ou sign-in; um visitante autenticado continua sendo
levado direto para `/app`.

O redesign é comprovado por screenshots antes/depois de cada página, capturados com Playwright
MCP, salvos em `.screenshots` com os sufixos `_before` e `_after`.

### Páginas cobertas

| Página           | Rota                          | Estado hoje                                            |
| ---------------- | ----------------------------- | ------------------------------------------------------ |
| Landing pública  | `/`                           | Redireciona para sign-in/app; não existe como página   |
| Criar conta      | `/auth/sign-up`               | Card genérico; estado de sucesso em bloco secundário   |
| Confirmar e-mail | `/auth/confirm?token=...`     | Card genérico; estados de pending, sucesso e erro      |
| Entrar           | `/auth/sign-in`               | Card genérico; banner de reset e erro de e-mail        |
| Recuperar senha  | `/auth/forgot-password`       | Card genérico; estado de link enviado                  |
| Redefinir senha  | `/auth/reset-password?token=` | Card genérico; token inválido, formulário e sucesso    |
| 404 de auth      | `/auth/*`                     | Card genérico                                          |
| Home privada     | `/app`                        | Shell com header/footer básicos e bloco de boas-vindas |
| 404 privada      | `/app/*`                      | Conteúdo simples sem presença visual                   |
| 404 raiz         | qualquer rota desconhecida    | Cai na 404 padrão do framework, sem identidade         |

### Direção de design

- A identidade visual atual é a base, não a camisa de força: a paleta pastel-azul, o grafite e o
  light-only permanecem reconhecíveis, mas o sistema de tokens pode **evoluir** (escala de
  neutros, superfícies, elevação, cores semânticas de sucesso/alerta/erro e um azul de marca com
  contraste adequado para ação primária).
- Hierarquia vem de tipografia, espaço e contraste, não de excesso de cor, sombra ou gradiente.
- Cada tela deve ter uma única ação primária evidente e caminhos secundários discretos.
- Telas de auth deixam de ser "um card no vazio": precisam de presença de marca, contexto do
  produto e continuidade visual com a landing e a área privada.
- A área privada deve parecer um produto em uso, não um placeholder: identidade do usuário,
  navegação preparada para crescer e estados de "o que vem agora" sem inventar features.
- Padrões proibidos: aparência de template shadcn sem customização, gradientes chamativos,
  neon, dark mode, sombras pesadas, ícones sem rótulo, texto branco sobre pastel.
- O redesign deve parecer intencional e distinto, não uma variação genérica de dashboard.

### Landing pública (conteúdo)

- Deve apresentar, em en-US: proposta de valor, os Experts iniciais (CEO, CMO, CTO), os
  conectores do MVP (upload de PDF, Markdown, Google Drive, Notion), como funciona em passos
  curtos, e CTAs para criar conta e entrar.
- O conteúdo deve vir exclusivamente de `.docs/BUSINESS.md`. Não inventar métricas, clientes,
  depoimentos, preços, prazos ou números de desempenho.
- O conteúdo principal deve ser renderizado no servidor e os CTAs devem ser links reais,
  funcionando sem JavaScript.
- Não há seção de preços, blog, carreiras ou integrações fora do MVP.

## 4. Métricas de sucesso

Não há analytics nesta fase. O sucesso é medido por evidências verificáveis:

- 100% das páginas da tabela da seção 3 com screenshots `_before` e `_after` em desktop e mobile.
- 100% dos fluxos E2E existentes verdes, sem redução de cobertura ou de asserções.
- Zero ocorrência de rolagem horizontal em 360px, 768px e 1440px nas páginas cobertas.
- Zero violação de contraste AA nas páginas cobertas, verificada na revisão de QA.
- Nenhuma tela coberta usando UI padrão do framework (404 padrão) ou componente sem estilo.
- `bun run lint`, `bun run types:check`, `bun run test`, `bun run test:e2e` e `bun run build`
  verdes ao final.

## 5. Escopo

### Dentro

- Redesign visual de todas as páginas da tabela da seção 3, incluindo os estados de formulário
  já existentes (default, pending, erro, sucesso, token inválido).
- Nova landing pública em `/`, mantendo o redirecionamento de usuários autenticados para `/app`.
- Redesign dos shells públicos e privados (marca, navegação, identidade do usuário, sign out).
- Redesign das páginas 404 de `/auth`, `/app` e raiz.
- Evolução dos tokens do design system e atualização de `.docs/DESIGN.md` e
  `.docs/DESIGN_SYSTEM.md` com os valores e regras novos.
- Captura de screenshots antes/depois com Playwright MCP, em `.screenshots`, e configuração do
  servidor Playwright MCP no projeto.
- Ajuste dos testes E2E apenas para refletir nova apresentação/copy, preservando os mesmos fluxos
  e o mesmo nível de cobertura.

### Fora

- Novas features de produto: dashboard real, Experts, conectores, chat, onboarding além do
  cadastro.
- Alterações em regras de autenticação, sessão, confirmação e recuperação de senha.
- Dark mode, i18n, temas alternativos ou modo de alto contraste dedicado.
- Redesign de e-mails transacionais e de telas de e-mail do provedor.
- Rotas privadas novas, itens de navegação de features inexistentes e páginas de marketing além
  da landing.
- `loading.tsx` e `error.tsx` de rota; os estados dentro das páginas e formulários entram, os
  boundaries globais ficam para outra fatia.
- Testes visuais automatizados por snapshot/diff de imagem; os screenshots são evidência de QA,
  não gate de CI.

## 6. Fluxos

### Fluxo principal — visitante novo

1. Visitante abre `/` e vê a landing com proposta de valor, Experts, conectores e como funciona.
2. Escolhe "Create your account" e chega a `/auth/sign-up`.
3. Cria a conta, vê o estado de sucesso com o próximo passo (confirmar e-mail) e segue para
   `/auth/sign-in`.
4. Entra e chega à home privada redesenhada.

### Fluxo principal — usuário existente

1. Usuário abre `/auth/sign-in`, informa e-mail e senha e entra em `/app`.
2. Na home privada reconhece a identidade da conta e consegue sair pelo shell.

### Fluxos alternativos e de exceção

- Usuário autenticado abre `/`: é redirecionado para `/app` sem ver a landing.
- Usuário erra credenciais: vê erro redesenhado, com foco no resumo e campos preservados.
- Usuário tenta entrar sem confirmar o e-mail: vê o erro com o caminho de confirmação.
- Recuperação de senha: formulário, estado de link enviado, token inválido e sucesso do reset
  mantêm o comportamento atual com a nova apresentação.
- Confirmação de e-mail: estado de processamento automático, sucesso e erro com retry.
- Rota inexistente: 404 redesenhada com caminho claro de volta (sign-up/sign-in ou home).
- Viewports mobile e tablet: nenhum conteúdo cortado, ações continuam alcançáveis e os shells se
  adaptam sem menu inacessível.

## 7. Regras e casos de borda

- Os nomes acessíveis e textos que os testes E2E usam hoje são contrato de regressão: se a copy
  mudar, o teste correspondente deve ser atualizado com o mesmo rigor, nunca removido.
- Redirecionamentos existentes (`returnTo`, `/` com sessão, `/auth/confirm` sem token,
  `/auth/reset-password` sem token) permanecem iguais, exceto `/` para visitante não autenticado.
- A landing não pode exigir JavaScript para exibir conteúdo ou navegar pelos CTAs.
- Nenhuma página pode depender de largura fixa, imagem externa ou fonte remota bloqueante.
- O foco visível é obrigatório em todos os controles, incluindo links, botões e skip link.
- Erros continuam vinculados ao campo com `aria-describedby` e resumo com `role="alert"`.
- Estados de sucesso continuam anunciados com `role="status"` e não podem depender só de cor.
- O token de confirmação/redefinição não pode aparecer na UI, em screenshot ou em log.
- Screenshots não podem conter dados sensíveis reais; usar conta e dados semeados de teste.
- A landing não promete capacidades fora do MVP descrito em `.docs/BUSINESS.md`.

## 8. Dados e contratos

- Nenhuma mudança em endpoints, ações de formulário, payloads ou schema de banco.
- Nenhum novo dado persistido. A landing é conteúdo estático versionado.
- Screenshots são artefatos de QA em `.screenshots`, com a estrutura:
  - `.screenshots/desktop/<pagina>_before.png`
  - `.screenshots/desktop/<pagina>_after.png`
  - `.screenshots/mobile/<pagina>_before.png`
  - `.screenshots/mobile/<pagina>_after.png`
- `<pagina>` segue a rota em kebab-case: `landing`, `auth-sign-up`, `auth-confirm`,
  `auth-sign-in`, `auth-forgot-password`, `auth-reset-password`, `auth-not-found`, `app-home`,
  `app-not-found`, `root-not-found`.
- Viewports canônicos: desktop 1440×900 e mobile 390×844, página inteira, animações desligadas,
  fontes carregadas e a mesma conta/dados entre before e after.
- `.docs/DESIGN.md` e `.docs/DESIGN_SYSTEM.md` passam a ser a fonte dos tokens e regras novos.

## 9. Permissões e segurança

- A landing e as telas de auth continuam públicas; nenhuma tela privada pode ser exposta pelo
  redesign.
- O shell privado continua renderizado somente após validação de sessão no servidor.
- Nenhum token, cookie ou dado de sessão pode aparecer em HTML, screenshot ou mensagem de UI.
- Screenshots usam somente dados de teste; não usar conta real nem e-mail real.
- Links e CTAs da landing não podem aceitar destinos arbitrários vindos da URL.

## 10. Requisitos não funcionais

- **Acessibilidade:** WCAG 2.2 AA; foco visível; contraste 4.5:1 em texto e 3:1 em UI; teclado
  completo; landmarks e headings corretos; `prefers-reduced-motion` respeitado.
- **Responsividade:** testar em 360px, 768px e 1440px; sem overflow horizontal; toque mínimo de
  44×44px; shells adaptáveis.
- **Performance:** landing renderizada no servidor; sem JS cliente bloqueante para o conteúdo
  principal; CLS < 0,1 e LCP < 2,5s em 4G simulada; sem imagens acima do necessário.
- **Consistência:** uma única fonte de tokens; nenhuma cor hex solta em página; estados de
  componente equivalentes entre telas.
- **Idioma:** toda UI e copy pública em en-US; documentação interna em PT-BR.
- **Manutenibilidade:** componentes e padrões reutilizáveis entre as telas; sem CSS duplicado por
  página.

## 11. Dependências e riscos

- **Playwright MCP:** não está configurado hoje (`.mcp.json` só tem Grafana). Configurar antes de
  qualquer alteração visual e validar com uma captura de teste. Risco: indisponibilidade do
  pacote/servidor no ambiente; fallback documentado no plano se necessário.
- **Skills obrigatórias:** `frontend-design` e `web-design-guidelines` devem ser carregadas e
  aplicadas na implementação; o plano e o relatório registram o uso real.
- **E2E acoplado a copy:** mudanças de texto quebram asserções. Mitigação: rodar a suíte a cada
  tela alterada e atualizar somente o necessário.
- **Mudança de comportamento em `/`:** hoje redireciona para sign-in; passa a renderizar landing.
  Mitigação: atualizar `routing` E2E e qualquer documento que descreva a raiz.
- **Licença de fonte:** se a direção exigir uma fonte de display nova, precisa ser licenciada,
  self-hosted e aprovada antes de entrar. Sem aprovação, usar a família atual com escala
  refinada.
- **Peso do repositório:** screenshots em PNG podem crescer. Mitigação: somente as páginas
  canônicas, dois viewports, compressão e decisão registrada sobre versionamento.
- **Escopo visual aberto:** "profissional e elegante" é subjetivo. Mitigação: checklist objetivo
  de QA visual + screenshots aprovados pelo solicitante.

## 12. Rollout e migração

- Sem feature flag: a mudança é visual e entra em um PR único, com screenshots como evidência.
- Não há migração de dados.
- Rollback é o revert do PR; nenhum dado ou contrato é afetado.
- `.docs/DESIGN.md` e `.docs/DESIGN_SYSTEM.md` são atualizados no mesmo PR para evitar
  divergência entre intenção e código.

## 13. Estratégia de teste

- **E2E existentes:** sign-up, confirm, sign-in, forgot, reset e routing devem passar; ajustar
  apenas seletores/copy impactados, sem enfraquecer asserções de comportamento.
- **Novo E2E de landing:** visitante vê a landing em `/`; usuário autenticado é redirecionado
  para `/app`; CTAs levam a sign-up e sign-in.
- **Manual com Playwright MCP:** navegar por todas as páginas em desktop e mobile, validar
  teclado, foco, zoom, estados de erro/sucesso e ausência de overflow.
- **Acessibilidade:** inspeção de landmarks, headings, labels, `aria-describedby`, `role` de
  alerta/status e contraste.
- **Visual:** screenshots before/after por página e viewport, com a mesma conta semeada; revisão
  lado a lado antes de finalizar.
- **Regressão:** `bun run lint`, `types:check`, `test`, `test:e2e` e `build`.

## 14. Critérios de aceite

- [ ] Dado um visitante não autenticado, quando abre `/`, então vê a landing com proposta de
      valor, Experts (CEO, CMO, CTO), conectores do MVP, como funciona e CTAs para criar conta e
      entrar.
- [ ] Dado um usuário autenticado, quando abre `/`, então é redirecionado para `/app` sem ver a
      landing.
- [ ] Dado um visitante na landing, quando aciona o CTA primário ou o secundário, então chega a
      `/auth/sign-up` ou `/auth/sign-in` respectivamente.
- [ ] Dado qualquer página da tabela da seção 3, quando é aberta, então usa a mesma direção
      visual, tokens, tipografia e padrões de foco e espaçamento.
- [ ] Dado um formulário de auth com erro, quando é enviado inválido, então o resumo e o erro de
      campo aparecem com a nova apresentação, `role="alert"`, `aria-invalid` e
      `aria-describedby` preservados.
- [ ] Dado um formulário em envio, quando está pendente, então o botão indica loading, bloqueia
      duplo envio e mantém a largura.
- [ ] Dado o estado de sucesso de sign-up, confirmação, recuperação e reset, quando ocorre, então
      é anunciado com `role="status"` e mostra o próximo passo com estilo consistente.
- [ ] Dado um usuário autenticado em `/app`, quando vê o shell, então reconhece sua identidade e
      consegue sair pelo controle de sign out.
- [ ] Dado uma rota inexistente em `/auth/*`, `/app/*` ou na raiz, quando é aberta, então vê uma
      404 com identidade do produto e um caminho claro de volta.
- [ ] Dado cada página coberta, quando capturada com Playwright MCP, então existem
      `.screenshots/desktop/<pagina>_before.png`, `_after.png`,
      `.screenshots/mobile/<pagina>_before.png` e `_after.png`.
- [ ] Dado before e after da mesma página, quando comparados, então usam a mesma conta, os mesmos
      dados, o mesmo viewport e não contêm informações sensíveis.
- [ ] Dado o redesign, quando inspecionado em 360px, 768px e 1440px, então não há rolagem
      horizontal nem conteúdo cortado.
- [ ] Dado o uso apenas de teclado, quando se percorre cada página, então o foco é sempre visível,
      a ordem é lógica e o skip link funciona.
- [ ] Dado qualquer texto e elemento de UI, quando verificado, então o contraste atende AA e
      nenhum estado depende exclusivamente de cor.
- [ ] Dado `prefers-reduced-motion: reduce`, quando ativado, então animações não essenciais são
      reduzidas.
- [ ] Dado o conjunto de tokens, quando consultado em `globals.css`, então nenhuma página usa hex
      solto e todos os tokens novos estão documentados em `DESIGN.md`/`DESIGN_SYSTEM.md`.
- [ ] Dado o conteúdo da landing, quando revisado, então só usa informações de `BUSINESS.md`, sem
      métricas, clientes, depoimentos, preços ou promessas inventadas.
- [ ] Dado a suíte E2E, quando executada, então todos os fluxos passam e as asserções de
      comportamento foram preservadas.
- [ ] Dado o repositório, quando os gates rodam, então `lint`, `types:check`, `test`, `test:e2e`
      e `build` passam.

## 15. Decisões e questões abertas

| Tema                  | Decisão ou pergunta                                                                                                                                        | Impacto                                                                                                                | Dono        | Status   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| Identidade visual     | Evoluir tokens, paleta, tipografia e docs, mantendo light-only, AA e reconhecimento da marca.                                                              | Define o teto de qualidade do redesign.                                                                                | Solicitante | decidida |
| Landing pública       | Incluir landing em `/`, preservando redirect para `/app` quando autenticado.                                                                               | Muda o comportamento da raiz e o E2E de routing.                                                                       | Solicitante | decidida |
| Captura de evidências | Configurar Playwright MCP antes do redesign e capturar before/after em `.screenshots`.                                                                     | Sem before válido não há prova do ganho.                                                                               | Engenharia  | decidida |
| Versionar screenshots | Commitar `.screenshots` (desktop+mobile, before/after) sempre no PR, como evidência rastreável do redesign.                                                | Aumenta o peso do repositório, mas garante rastreabilidade; manter apenas as páginas/viewports canônicos e compressão. | Solicitante | decidida |
| Fonte de display      | Refinar apenas a família atual (Geist, já self-hosted) nesta fatia; nova fonte display só com aprovação/licença explícita em outra spec.                   | Mantém personalidade visual dentro do stack atual, sem dependência/peso/licença novos.                                 | Solicitante | decidida |
| Revisão de copy       | Solicitante revisa e aprova a copy final da landing (en-US, baseada exclusivamente em `.docs/BUSINESS.md`) antes do merge; a implementação propõe o texto. | Evita promessa indevida e retrabalho de texto.                                                                         | Solicitante | decidida |
| Registro antes/depois | Os screenshots `_before` devem ser gerados no mesmo commit/tag do estado atual e não podem ser recapturados depois de qualquer mudança de estilo.          | Garante comparação honesta.                                                                                            | Engenharia  | decidida |
