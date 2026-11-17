# Plano — Redesign de UI e landing pública

> Spec: `.specs/011-ui-redesign.md`
> Status: done (refação v2 — v1 preservada em `backup/011-ui-redesign-v1`)

## 1. Contexto

As telas atuais (auth, `/app` e 404s) são funcionais porém visualmente genéricas e não existe landing pública em `/` (`app/page.tsx` apenas redireciona por sessão). A spec 011 (aprovada) pede elevar a UI a um padrão profissional, adicionar a landing em `/` para visitantes, preservar todo o comportamento de auth/sessão, evoluir tokens/docs de design e comprovar o ganho com screenshots `_before`/`_after` (desktop 1440×900, mobile 390×844, full page, animações off, mesma conta/dados) capturados com Playwright MCP em `.screenshots/`, commitados sempre no PR.

Decisões registradas: Geist refinada (sem nova fonte), copy da landing proposta com base exclusiva em `.docs/BUSINESS.md` e aprovada pelo solicitante antes do merge, screenshots sempre versionados.

## 2. Objetivo e critérios de aceite

Entregar todas as páginas da tabela da spec com direção visual coerente/profissional, landing pública em `/` (redirect para `/app` se autenticado), shells públicos/privados e 404s redesenhados, tokens e docs (`DESIGN.md`, `DESIGN_SYSTEM.md`) atualizados, E2E existentes verdes com comportamento/cobertura preservados e novo E2E de landing/routing, screenshots before/after por página/viewport e gates verdes.

Critérios de aceite: mapeados 1:1 para a §14 da spec (landing e CTAs, redirect autenticado, direção visual/tokens consistentes, erros com `role="alert"`+`aria-*`, loading sem duplo envio, estados de sucesso `role="status"`, shell privado com identidade e sign out, 404s com identidade e caminho de volta, screenshots completos, sem overflow 360/768/1440, teclado/foco/skip link, contraste AA, `prefers-reduced-motion`, sem hex solto e docs atualizados, copy só de `BUSINESS.md`, E2E/gates verdes).

## 3. Escopo

### Dentro

- Redesign visual de: landing `/`, `/auth/sign-up`, `/auth/confirm?token=...`, `/auth/sign-in`, `/auth/forgot-password`, `/auth/reset-password?token=`, 404 auth (`/auth/*`), home privada `/app`, 404 privada (`/app/*`), 404 raiz.
- Estados de formulário existentes (default, pending, erro, sucesso, token inválido/ausente/usado, conta já confirmada, reset success em sign-in).
- Nova landing pública em `/` para visitante; manter redirect autenticado para `/app`.
- Redesign dos shells público/privado e páginas 404 (root + grupos).
- Evolução de tokens em `packages/ui/src/styles/globals.css` e atualização de `.docs/DESIGN.md` e `.docs/DESIGN_SYSTEM.md`.
- Configuração/validação do Playwright MCP em `.mcp.json` e captura before/after em `.screenshots/{desktop,mobile}/<pagina>_{before,after}.png`.
- Ajustes de E2E apenas para apresentação/copy, preservando fluxos e asserções de comportamento; novo E2E de landing.
- `app/not-found.tsx` raiz (identidade do produto) e ajuste de `NotFoundContent`/layouts conforme necessário.

### Fora

- Novas features de produto, mudanças em regras de auth/sessão/confirm/reset, dark mode/i18n, e-mails transacionais, rotas privadas novas, `loading.tsx`/`error.tsx` de rota, snapshots visuais automatizados em CI.

## 4. Abordagem técnica

- **Config antes de estilo:** Playwright MCP adicionado em `.mcp.json`; validar captura e obter **todos** os `_before` (desktop/mobile) antes de qualquer alteração de CSS/componentes/layout/páginas.
- **Tokens/design system:** evoluir a paleta reconhecível (pastel-azul/grafite, light-only) em variáveis semânticas (`--primary` com contraste AA para ação primária, superfícies, bordas, estados semânticos success/warning/destructive quando necessários com ícone+texto, ring/focus), manter Geist via `next/font/local`, refinar escala tipográfica/espaçamento/raio/sombra sem hex solto nas páginas. Atualizar `DESIGN.md`/`DESIGN_SYSTEM.md` na mesma mudança.
- **Primitivos:** estender/reutilizar `@repo/ui` (Button e, se útil, padrões de input/superfície) e componentes compartilhados em `apps/web` para consistência; formulários mantêm `useActionState`, `aria-invalid`, `aria-describedby`, `role="alert"`/`role="status"`, labels, `noValidate` e sem duplo envio.
- **Layouts:** auth com presença de marca/contexto (não "card no vazio") e continuidade com landing; app como produto em uso (identidade do usuário, navegação pronta para crescer, sign out claro). Skip link preservado e visível no foco.
- **Páginas:** landing server-rendered, conteúdo estático versionado derivado de `BUSINESS.md` (proposta de valor, Experts CEO/CMO/CTO, conectores PDF/Markdown/Google Drive/Notion, passos, CTAs links reais), sem JS bloqueante; `/app` com boas-vindas/estado "o que vem agora" sem inventar features; 404s com identidade e retorno claro.
- **Next.js/React:** Server Components por padrão, fronteira client mínima, `next/link`, sem `useEffect` para dados iniciais, `prefers-reduced-motion` respeitado.
- **Testes:** atualizar seletores/copy impactados preservando asserções de comportamento; adicionar E2E de landing/routing.

## 5. Arquivos e áreas afetadas

- `.mcp.json` (Playwright MCP).
- `.screenshots/desktop/*_{before,after}.png`, `.screenshots/mobile/*_{before,after}.png`.
- `.plans/011-ui-redesign-plan.md`, `.specs/011-ui-redesign.md`.
- `packages/ui/src/styles/globals.css`, possivelmente `packages/ui/src/components/ui/*`.
- `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/not-found.tsx` (novo).
- `apps/web/app/_components/*` (shared styles, not-found, landing/shell/superfície conforme necessário).
- `apps/web/app/auth/layout.tsx`, `apps/web/app/auth/not-found.tsx`, `apps/web/app/auth/_components/auth-card.tsx`.
- `apps/web/app/auth/**/page.tsx` e `*-form.tsx` (sign-up, sign-in, confirm, forgot-password, reset-password).
- `apps/web/app/app/layout.tsx`, `apps/web/app/app/page.tsx`, `apps/web/app/app/not-found.tsx`.
- `apps/web/lib/auth/route-rules.ts` e testes unitários se contrato de `/` mudar.
- `apps/web/e2e/*.spec.ts` (ajustes) e novo teste de landing.
- `.docs/DESIGN.md`, `.docs/DESIGN_SYSTEM.md` e docs técnicos se houver divergência real.

## 6. Passos de implementação

- [x] Resolver e aprovar a spec 011; registrar decisões abertas.
- [x] Configurar Playwright MCP em `.mcp.json`.
- [x] Validar captura e capturar screenshots `_before` (1440×900 e 390×844, full page, animações off, dados consistentes) para todas as páginas canônicas antes de qualquer mudança de estilo.
- [x] Evoluir tokens em `globals.css` e base de componentes compartilhados (contraste AA, foco, estados).
- [x] Implementar landing pública `/` (server, conteúdo de `BUSINESS.md`, CTAs links, redirect autenticado preservado).
- [x] Redesenhar shell/layout público de auth e páginas/formulários auth com estados preservados.
- [x] Redesenhar shell privado `/app` e home.
- [x] Implementar/redesenhar 404 raiz, 404 auth e 404 app.
- [x] Atualizar `.docs/DESIGN.md` e `.docs/DESIGN_SYSTEM.md`.
- [x] Atualizar E2E existentes e adicionar E2E de landing/routing.
- [x] Capturar screenshots `_after` correspondentes.
- [x] Executar gates (`lint`, `types:check`, `test`, `test:e2e`, `build`) e QA manual de fluxos/redesign.
- [x] `commit-and-push` e relatório final.

## 7. Riscos e mitigação

- **Antes irrecuperável após estilo:** etapa bloqueante antes de alterar CSS/UI.
- **Playwright MCP indisponível:** validar cedo; fallback com Playwright CLI/test runner documentado se necessário.
- **E2E acoplado a copy:** atualizar apenas o necessário, preservando comportamento.
- **Mudança em `/`:** ajustar routing E2E/docs e garantir redirect autenticado.
- **Contraste AA com pastéis:** validar tokens e evitar texto branco sobre pastel.
- **Escopo subjetivo/copy:** checklist objetivo; copy da landing proposta sujeita à sua aprovação antes do merge.

## 8. Plano de testes

- Unitários web existentes verdes; ajustar se contrato mudar intencionalmente (ex.: `/` visitante).
- E2E existentes preservam fluxos/asserções de comportamento.
- Novo E2E: landing `/` visitante, redirect autenticado, CTAs para sign-up/sign-in.
- Regressão: `bun run lint`, `bun run types:check`, `bun run test`, `bun run build`, `bun run test:e2e`.

## 9. QA manual

- Páginas/estados em 360/768/1440 e viewports de captura, sem overflow horizontal.
- Teclado: foco visível, ordem lógica, skip link, controles acionáveis.
- Formulários: erro (`role="alert"`, `aria-*`), pending (loading, sem duplo envio), sucesso (`role="status"`).
- `/` visitante vs autenticado, `returnTo`, 404s (raiz/auth/app).
- Contraste AA, `prefers-reduced-motion`, sem tokens/dados sensíveis em UI/screenshots.

## 10. Rollout e rollback

- PR único, sem flag/migração. Rollback por revert. Docs de design atualizados no mesmo PR.
