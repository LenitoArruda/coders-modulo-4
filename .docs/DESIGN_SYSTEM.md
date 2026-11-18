# DESIGN_SYSTEM.md — Design system

> **Status:** implementado (base) · **Atualizado em:** 2026-11-16
> **Base:** shadcn/ui sobre Tailwind CSS · **Direção visual:** [DESIGN.md](./DESIGN.md)

Este documento define **como** a UI é construída. O `DESIGN.md` define **como ela parece**.

> ✅ **Estado atual:** Tailwind CSS 4, shadcn/ui (`packages/ui/components.json`), `cn`, `cva` e
> `@radix-ui/react-slot` estão instalados. O primitivo `Button` e os tokens light-only estão em
> `packages/ui`.

---

## 1. Base e status

| Item                               | Estado                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| shadcn/ui                          | ✅ configurado em `packages/ui/components.json`                     |
| Tailwind CSS                       | ✅ 4.3.4                                                            |
| `clsx` + `tailwind-merge` (`cn`)   | ✅ `packages/ui/src/lib/cn.ts`                                      |
| `class-variance-authority` (`cva`) | ✅ 0.7.1                                                            |
| Primitivos Radix (via shadcn)      | ✅ `@radix-ui/react-slot` 1.5.0                                     |
| Ícones                             | 🧭 Lucide definido no `components.json`; pacote ainda não instalado |
| Componentes atuais                 | ✅ `Button` (default, secondary, ghost, link) em `components/ui`    |

---

## 2. Onde os componentes vivem

```text
packages/ui/src/
├── components/
│   ├── ui/                      # Primitivos shadcn (button, input, dialog...)
│   └── <composição>/            # Composições reutilizáveis entre apps
├── lib/
│   └── cn.ts                    # clsx + tailwind-merge
├── styles/
│   └── globals.css              # Tailwind, tokens e base styles
```

Regras:

- **Primitivos** ficam em `packages/ui` e são a única fonte de componentes base.
- **Composições específicas de uma tela** ficam no app (`apps/web/app/...`), não no pacote.
- Não duplique um primitivo do shadcn para "customizar"; use variantes.
- O pacote `ui` **não** contém regra de negócio, chamada de API ou acesso a dados.
- Importe sempre via `@repo/ui/...`. Ao mover arquivos, atualize o `exports` do pacote.

---

## 3. Tokens

Tokens são **variáveis CSS semânticas** definidas em `:root` em
`packages/ui/src/styles/globals.css`, expostas ao Tailwind via `@theme inline`. Componentes nunca
usam hex diretamente.

| Token                                     | Valor                             | Uso                                          |
| ----------------------------------------- | --------------------------------- | -------------------------------------------- |
| `--background` / `--foreground`           | `#FFFFFF` / `#171717`             | Fundo e texto principal                      |
| `--surface` / `--surface-strong`          | `#F3F8FB` / `#E4EFF6`             | Faixas, painéis, hover de itens neutros      |
| `--card` / `--card-foreground`            | `#FFFFFF` / `#171717`             | Cards                                        |
| `--popover` / `--popover-foreground`      | `#FFFFFF` / `#171717`             | Popovers                                     |
| `--primary` / `--primary-hover`           | `#1D4F7A` / `#163F62`             | Ação primária (texto `--primary-foreground`) |
| `--primary-foreground`                    | `#FFFFFF`                         | Texto sobre a ação primária                  |
| `--secondary` / `--secondary-foreground`  | `#CFE8EF` / `#171717`             | Tiles, monogramas, avatares                  |
| `--accent` / `--accent-foreground`        | `#85C7DE` / `#171717`             | Detalhes de marca                            |
| `--tint`                                  | `#C6DBF0`                         | Detalhes decorativos                         |
| `--muted` / `--muted-foreground`          | `#EEF4F8` / `#52525B`             | Superfície discreta e texto secundário       |
| `--border` / `--border-strong`            | `#D3E2EC` / `#AED1E6`             | Divisores e contornos                        |
| `--input`                                 | `#6F94AD`                         | Borda de campos (≥ 3:1)                      |
| `--ring`                                  | `#1D4F7A`                         | Anel de foco                                 |
| `--success` (+ `-surface`, `-border`)     | `#14532D` / `#E8F5EC` / `#86C79A` | Sucesso                                      |
| `--warning` (+ `-surface`, `-border`)     | `#7A4A00` / `#FFF4DC` / `#E6B85C` | Alerta                                       |
| `--destructive` (+ `-surface`, `-border`) | `#B42318` / `#FEF3F2` / `#F1A9A2` | Erro                                         |
| `--radius`                                | `0.5rem`                          | Raio padrão                                  |

Regras:

- Texto branco **somente** sobre `--primary` (via `--primary-foreground`); sobre `--secondary`,
  `--accent` e `--tint` use grafite.
- Cores semânticas (`success`, `warning`, `destructive`) existem e são sempre usadas com ícone +
  texto. Novos estados devem garantir contraste AA e ser documentados nesta tabela.
- `prefers-reduced-motion: reduce` zera animações e transições em `globals.css`.
- Não use `dark:` nem variantes de tema escuro.
- Ao adicionar um primitivo shadcn, complete os tokens exigidos pelo componente (`popover`,
  `destructive`, `chart`, `sidebar`) mantendo a paleta definida em
  [DESIGN.md](./DESIGN.md).

---

## 4. API dos componentes

Todo componente compartilhado deve:

- Aceitar `className` e combiná-lo com `cn()`.
- Expor variantes via `cva` (`variant`, `size`), não via múltiplos booleanos.
- Suportar `asChild` quando fizer sentido (composição de links/botões).
- Encaminhar `ref` e props nativas do elemento.
- Ter `displayName`.
- Ser previsível: mesmas props, mesmo comportamento em todos os apps.

Exemplo de contrato:

```tsx
type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };
```

Regras:

- Não invente props para necessidades de uma única tela; componha.
- Não coloque lógica de negócio em `packages/ui`.
- Componentes interativos usam `"use client"` no menor arquivo possível.
- Server Components são o padrão; não transforme a árvore inteira em client.

---

## 5. Estados obrigatórios

Todo componente interativo deve cobrir:

| Estado        | Requisito                                     |
| ------------- | --------------------------------------------- |
| Default       | Aparência base                                |
| Hover         | Mudança sutil de cor/superfície               |
| Focus-visible | Anel de foco visível (`--ring`)               |
| Active        | Feedback de pressão                           |
| Disabled      | Reduzir opacidade e bloquear interação        |
| Loading       | Indicador + bloquear ação, mantendo a largura |
| Invalid       | Borda/erro com texto e `aria-invalid`         |

Composições compartilhadas do `apps/web` (`app/_components/`): `brand.tsx` (logotipo e link de
marca), `icons.tsx` (ícones SVG decorativos com `aria-hidden`), `form-parts.tsx` (`FormAlert`
com `role="alert"`, `StatusNotice` com `role="status"`, `FieldLabel`, `FieldHint`, `FieldError`,
`RequiredNote`, `FormFooter`), `shared-styles.ts` (skip link, links e campos),
`not-found-content.tsx` e `landing.tsx`.

Estados de tela: **vazio**, **carregando**, **erro** e **sem permissão** devem ser desenhados,
não improvisados.

---

## 6. Formulários

- Todo campo tem `label` visível e associado (`htmlFor`/`id`).
- Placeholder não substitui label.
- Erro exibido próximo ao campo e vinculado com `aria-describedby`.
- Campo obrigatório é indicado de forma textual e semântica.
- Validação no blur/submit; não valide a cada tecla de forma agressiva.
- Botão de submit deve indicar loading e impedir duplo envio.

---

## 7. Acessibilidade

Checklist mínimo por componente:

- [ ] Funciona apenas com teclado.
- [ ] Foco visível e na ordem correta.
- [ ] `role`, `aria-*` e nome acessível corretos.
- [ ] Contraste AA.
- [ ] Não depende só de cor.
- [ ] Ícones decorativos com `aria-hidden`.
- [ ] Respeita `prefers-reduced-motion`.
- [ ] Testado com leitor de tela (NVDA/VoiceOver) nos fluxos críticos.

---

## 8. Responsividade

- Mobile-first: estilos base para mobile, enhancements via breakpoints.
- Sem larguras fixas que quebrem em telas pequenas.
- Área de toque mínima de 44×44px.
- Tabelas: rolagem horizontal controlada ou transformação em cards.
- Sidebars viram drawer no mobile.
- Testar em 360px, 768px e 1280px.

---

## 9. Testes de UI

Vitest está instalado na API, mas o pacote `ui` ainda **não** tem Vitest + Testing Library.
Quando forem adicionados:

- Testar **comportamento** e acessibilidade (roles, labels), não detalhes de implementação.
- Evitar snapshots como única cobertura.
- Cobrir estados: default, loading, erro, vazio e disabled.
- Testes E2E (Playwright) cobrem jornadas críticas, não cada componente.

---

## 10. Governança

- Adicionar um primitivo exige: estados, acessibilidade, responsividade e atualização deste doc.
- Componente sem uso real não entra no pacote compartilhado.
- Componente depreciado deve ser marcado e removido em uma tarefa explícita.
- Mudanças de token impactam todos os apps; valide visualmente antes de mergear.

---

## 11. Definition of Done de UI

- [ ] Usa tokens e componentes existentes.
- [ ] Light theme apenas.
- [ ] Acessível por teclado e leitor de tela.
- [ ] Responsivo em 360px, 768px e 1280px.
- [ ] Estados de loading, vazio e erro implementados.
- [ ] Sem regressão visual nas telas afetadas.
- [ ] Documentação atualizada quando há novo componente ou token.

---

## 12. Próximos passos (ordem sugerida)

1. ~~Definir tokens semânticos de sucesso/alerta/erro~~ (feito na spec 011).
2. Instalar `lucide-react` quando o primeiro ícone real for necessário.
3. Configurar Vitest + Testing Library para o pacote `ui`.
4. Adicionar novos primitivos apenas com uso real, cobrindo estados e acessibilidade.
