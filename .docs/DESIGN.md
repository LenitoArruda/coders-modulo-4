# DESIGN.md — Direção visual

> **Status:** ativo · **Atualizado em:** 2026-11-16
> **Implementação:** consulte [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) para tokens e componentes.

Define a identidade visual do produto. Vale para **toda** interface, incluindo telas
administrativas, estados vazios, erros e e-mails transacionais.

---

## 1. Princípios

1. **Clareza antes de decoração.** Cada elemento deve ter uma função.
2. **Hierarquia por espaço, tipografia e contraste**, não por excesso de cor.
3. **Leveza.** Superfícies claras, tons pastéis e sombras discretas.
4. **Consistência.** Componentes novos reutilizam tokens e padrões existentes.
5. **Acessibilidade e responsividade são requisitos**, não acabamento.

**Sensação desejada:** calmo, confiável, profissional e humano — não "tech futurista".

---

## 2. Tema

- **Apenas light theme.** Não implementar dark mode.
- Não usar `prefers-color-scheme: dark` nem classes `dark:`.
- ✅ O token base define `color-scheme: light` em `packages/ui/src/styles/globals.css`; o dark
  mode do starter foi removido do `apps/web`.

---

## 3. Paleta

### 3.1 Cores de marca

A paleta pastel-azul continua sendo a base reconhecível; a ação primária passou a usar um azul
profundo com contraste AA para suportar texto branco. Os pastéis ficam para superfícies, tiles
e apoio visual (sempre com texto grafite).

| Token           | Hex       | Uso                                                           |
| --------------- | --------- | ------------------------------------------------------------- |
| `primary`       | `#1D4F7A` | Ação primária, links e foco (texto branco: contraste ≈ 8,6:1) |
| `secondary`     | `#CFE8EF` | Tiles, monogramas e avatares (texto grafite)                  |
| `tint`          | `#C6DBF0` | Detalhes decorativos de marca (ex.: numeral do 404)           |
| `accent`        | `#85C7DE` | Detalhe do logotipo e indicadores                             |
| `surface`       | `#F3F8FB` | Faixas de seção, painel de marca e fundo da área privada      |
| `border`        | `#D3E2EC` | Divisores e contornos de superfícies                          |
| `border-strong` | `#AED1E6` | Contornos de itens interativos/cartões em destaque            |
| `input`         | `#6F94AD` | Borda de campos (contraste ≥ 3:1 sobre branco)                |

### 3.2 Neutros e estados

| Token              | Hex       | Uso                                      |
| ------------------ | --------- | ---------------------------------------- |
| `background`       | `#FFFFFF` | Fundo principal                          |
| `foreground`       | `#171717` | Texto principal                          |
| `muted-foreground` | `#52525B` | Texto secundário                         |
| `success`          | `#14532D` | Texto/ícone de sucesso (fundo `#E8F5EC`) |
| `warning`          | `#7A4A00` | Texto/ícone de alerta (fundo `#FFF4DC`)  |
| `destructive`      | `#B42318` | Texto/ícone de erro (fundo `#FEF3F2`)    |

### 3.3 Regras de uso

- **Texto sobre pastel é sempre grafite, nunca branco.** Texto branco só sobre `primary`.
- Use **uma** cor de destaque por tela: o azul `primary` na ação principal. O restante é neutro.
- Não crie gradientes, neon ou cores fora dos tokens sem aprovação.
- Estados semânticos usam os tokens acima **sempre com ícone + texto**, nunca só cor.
- Contraste mínimo: **4.5:1** para texto e **3:1** para elementos de UI (WCAG AA).
- Nenhum hex solto em páginas e componentes; use as variáveis de `globals.css`.

---

## 4. Tipografia

| Uso       | Fonte      | Observação                          |
| --------- | ---------- | ----------------------------------- |
| Interface | Geist Sans | Carregada via `next/font/local`     |
| Código    | Geist Mono | Apenas para código e dados técnicos |

Escala sugerida (baseline):

| Token       | Tamanho | Line-height | Uso                     |
| ----------- | ------- | ----------- | ----------------------- |
| `text-xs`   | 12px    | 16px        | Legendas e metadados    |
| `text-sm`   | 14px    | 20px        | Texto auxiliar e labels |
| `text-base` | 16px    | 24px        | Corpo padrão            |
| `text-lg`   | 18px    | 28px        | Destaque de corpo       |
| `text-xl`   | 20px    | 28px        | Título de seção pequeno |
| `text-2xl`  | 24px    | 32px        | Título de seção         |
| `text-3xl`  | 32px    | 40px        | Título de página        |
| `text-4xl`  | 40px    | 48px        | Hero                    |

Regras:

- Largura de linha entre **65 e 75 caracteres**.
- Não use mais de **3 pesos** por tela.
- Títulos em **sentence case**; evitar CAIXA ALTA.
- Não use fonte menor que 12px.

---

## 5. Espaçamento, raio e sombra

- **Grid base:** 4px.
- **Escala:** 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Raios:** 8px para controles, 12px para cards, `full` para avatares e marcadores.
- **Sombras:** discretas e poucas. Prefira **borda** a sombra para separar superfícies.
- **Densidade:** generosa. Espaço em branco é parte do design.

---

## 6. Layout e responsividade

- Largura máxima de conteúdo: **1200–1280px**.
- Breakpoints (mobile-first, alinhados ao Tailwind):

| Faixa   | Largura    | Alvo                            |
| ------- | ---------- | ------------------------------- |
| Mobile  | < 640px    | 1 coluna                        |
| Tablet  | 640–1024px | 1–2 colunas                     |
| Desktop | > 1024px   | 2–3 colunas + navegação lateral |

Regras:

- Nenhuma rolagem horizontal em nenhum breakpoint.
- Testar em **360px, 768px e 1280px** no mínimo.
- Áreas de toque com no mínimo **44×44px**.
- Tabelas devem rolar ou virar cards no mobile.

---

## 7. Movimento

- Transições entre **150ms e 200ms**, com `ease-out`.
- Animar apenas `opacity` e `transform` sempre que possível.
- Respeitar `prefers-reduced-motion: reduce`.
- Não usar animações decorativas contínuas.

---

## 8. Conteúdo e tom

- **Landing pública (`/`):** conteúdo estático em en-US vindo apenas de `BUSINESS.md` (proposta,
  Experts, fontes do MVP, como funciona). Sem métricas, clientes, preços ou promessas inventadas.
  CTAs são links reais para `/auth/sign-up` e `/auth/sign-in`.
- **Telas de auth:** painel de marca ao lado do formulário no desktop; no mobile só a barra de
  marca, com o formulário primeiro.
- **Área privada:** identidade da conta (avatar com iniciais, nome, e-mail) e sign out sempre
  visíveis; próximos passos aparecem como "Coming soon", sem inventar features.
- **Identidade:** logotipo de três barras (um time de Experts lendo os mesmos dados) + nome.

- Textos de interface, telas de autenticação e e-mails transacionais em **en-US**; claros e diretos.
  A documentação interna continua em PT-BR.
- Preferir voz ativa e sentence case.
- Botões descrevem a ação: "Connect source", não "OK".
- Erros explicam **o que aconteceu** e **como resolver**.
- Evitar jargão técnico para o usuário final.
- As telas de auth (`/auth/*`) e a área privada (`/app/*`) seguem as mesmas regras visuais desta
  direção: light-only, tokens do design system, contraste AA e responsividade.

---

## 9. Faça e não faça

| ✅ Faça                                   | ❌ Não faça                                |
| ----------------------------------------- | ------------------------------------------ |
| Usar espaço em branco para separar blocos | Empilhar cards sem respiro                 |
| Uma ação primária por tela                | Vários botões primários competindo         |
| Pastéis com texto grafite                 | Texto branco sobre pastel                  |
| Bordas finas e sombras suaves             | Sombras pesadas e gradientes               |
| Ícones consistentes e com rótulo          | Ícones sozinhos sem significado claro      |
| Estados de loading, vazio e erro          | Deixar a tela "em branco" durante a espera |

---

## 10. Acessibilidade (obrigatório)

- Todo controle é acessível por teclado, com **foco visível**.
- Todo input tem **label** associado.
- Imagens têm `alt`; ícones decorativos têm `aria-hidden`.
- Não use cor como único indicador de estado.
- Contraste AA conforme seção 3.3.
- Mensagens de erro vinculadas ao campo via `aria-describedby`.

---

## 11. Relação com outros documentos

- **Implementação de tokens e componentes:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **Regras de engenharia e front-end:** [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Checklist de QA visual:** [QA.md](./QA.md)

> Os tokens desta direção estão implementados em `packages/ui/src/styles/globals.css` e
> consumidos pelo `apps/web` via `@repo/ui/styles/globals.css`.
