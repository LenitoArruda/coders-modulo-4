# DEVELOPMENT.md — Padrões de desenvolvimento

> **Status:** ativo · **Atualizado em:** 2026-11-09
> **Aplica-se a:** qualquer alteração em `apps/` ou `packages/`.

Este documento define **como** escrever código neste repositório. Para regras de processo e
entrega, consulte [RULES.md](./RULES.md). Para estrutura e stack, [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Princípios

| Princípio             | Aplicação prática                                                                  |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Correção primeiro** | Código correto e legível vale mais que código "esperto".                           |
| **DRY**               | Evite duplicação de **conhecimento**, não de linhas.                               |
| **WET consciente**    | Duplicar é aceitável quando a abstração ainda seria prematura; documente o motivo. |
| **KISS**              | Prefira a solução mais simples que atende ao requisito.                            |
| **YAGNI**             | Não implemente o que não foi pedido nem generalidade sem uso real.                 |
| **SOLID**             | Interfaces pequenas, dependências invertidas, responsabilidades claras.            |
| **Clean Code**        | Nomes reveladores, funções curtas, baixo acoplamento.                              |

> **Regra das três ocorrências:** só extraia uma abstração compartilhada quando houver pelo
> menos três usos reais ou quando a duplicação representar risco de divergência.

---

## 2. Arquitetura em camadas

A API usa quatro camadas. A dependência sempre aponta para dentro:

```text
interface ──► application ──► domain
                   ▲
             infrastructure
```

| Camada           | Contém                                                    | Não pode                               |
| ---------------- | --------------------------------------------------------- | -------------------------------------- |
| `domain`         | Entidades, value objects, regras e serviços de domínio    | Importar framework, banco, HTTP ou SDK |
| `application`    | Casos de uso, portas, orquestração                        | Conhecer implementações concretas      |
| `infrastructure` | Repositórios, Supabase, filas, eventos, clientes externos | Conter regra de negócio                |
| `interface`      | Controllers, DTOs, presenters, validação de entrada       | Acessar banco diretamente              |

Regras:

- Um caso de uso representa **uma intenção** do usuário/sistema.
- Portas são interfaces; adaptadores são implementações em `infrastructure`.
- Erros de domínio não vazam como erro HTTP; `interface` faz o mapeamento.
- `domain` deve ser testável sem banco, rede ou framework.

---

## 3. Vertical slices

- Organize por domínio: `experts`, `connectors`, `documents`, `conversations`.
- Cada slice contém suas quatro camadas.
- Evite pastas globais por tipo técnico (`controllers/`, `services/`, `repositories/`) na raiz.
- `modules/shared` é apenas para código transversal: erros, logging, config, tipos comuns.
- Não crie dependência circular entre módulos; prefira eventos ou casos de uso explícitos.

Estrutura atual (implementada na fundação):

```text
apps/api/src/modules/<domain>/
├── domain/
├── application/
├── infrastructure/
└── interface/
```

O slice `hello` é o exemplo de referência. `modules/shared` contém `config`, `logging` e
`observability`. Novos domínios seguem a mesma estrutura.

---

## 4. Front-end (Next.js)

- **App Router** obrigatório.
- **Server Components por padrão.** Use `"use client"` apenas em componentes que precisam de
  estado, efeitos, eventos ou APIs do browser.
- Mantenha a fronteira client o menor possível (na folha da árvore).
- Busque dados iniciais no servidor; evite `useEffect` + `fetch` para o primeiro carregamento.
- Não coloque regra de negócio em componentes; extraia para hooks/serviços.
- Use `next/image` para imagens e `next/font` para fontes.
- Defina `metadata` por rota sempre que a página for pública.
- Implemente `loading.tsx`, `error.tsx` e `not-found.tsx` quando a rota precisar.
- Componentes de UI reutilizáveis vivem em `packages/ui`; composições de tela vivem no app.

---

## 5. TypeScript

O `tsconfig` base já ativa `strict` e `noUncheckedIndexedAccess`.

- **Proibido `any`.** Use `unknown` e estreitamento de tipo.
- Evite `@ts-ignore`/`@ts-expect-error`; se inevitável, comente o motivo.
- Evite `!` (non-null assertion); trate o caso nulo.
- Valide dados externos na borda (API, conectores, env) antes de tipá-los.
- Tipos compartilhados entre web e api vivem em `packages/shared`.
- Prefira tipos derivados (`ComponentProps`, `ReturnType`, schemas de validação) a duplicação manual.
- Exporte tipos públicos de forma explícita.

---

## 6. Nomenclatura e organização

| Item                      | Convenção                                                     |
| ------------------------- | ------------------------------------------------------------- |
| Arquivos                  | `kebab-case` (`expert-card.tsx`, `create-expert.use-case.ts`) |
| Componentes React         | `PascalCase` na exportação                                    |
| Hooks                     | `use-*` no arquivo, `use*` na função                          |
| Classes/tipos             | `PascalCase`                                                  |
| Variáveis/funções         | `camelCase`                                                   |
| Constantes                | `UPPER_SNAKE_CASE`                                            |
| Tabelas/colunas SQL       | `snake_case`                                                  |
| Identificadores de código | Inglês                                                        |
| Textos de UI e docs       | PT-BR                                                         |

- Prefira co-localização: código específico da rota/feature fica próximo dela.
- Evite arquivos "utils" genéricos; nomeie pelo domínio.

---

## 7. Erros e validação

- Valide entradas na borda do sistema e **falhe cedo**.
- Use erros tipados e mensagens acionáveis.
- Não exponha stack trace, SQL ou detalhes internos ao usuário.
- Não engula exceções com `catch` vazio.
- Logs de erro devem conter contexto (operação, ids), sem PII/segredos.
- Respostas de API devem ter formato de erro consistente.

---

## 8. Testes

- **TDD quando viável:** escreva o teste antes ou junto da implementação.
- Pirâmide:
  - **Unitário:** domínio e casos de uso, rápidos e sem I/O.
  - **Integração:** repositórios, controllers e conectores com dependências reais ou fake.
  - **E2E:** jornadas críticas do usuário (Playwright).
- Teste **comportamento**, não implementação.
- Nomeie no formato `deve <comportamento> quando <condição>`.
- Todo bug corrigido ganha teste de regressão.
- Evite snapshots como única cobertura.
- A infraestrutura existe: **Vitest + Supertest** na API e **Playwright** no web. Comandos em
  [QA.md](./QA.md).

---

## 9. Observabilidade

- Logs estruturados em JSON, com nível (`debug`, `info`, `warn`, `error`).
- Inclua `requestId`/`correlationId` para rastrear fluxos.
- **Nunca** logue tokens, senhas, PII ou payloads sensíveis.
- Métricas para ingestão, latência, erros e custo de LLM.
- Traces para chamadas externas e processamento assíncrono.
- Stack atual: **Grafana LGTM** (imagem `grafana/otel-lgtm`, com Loki, Grafana, Tempo e
  Prometheus) recebendo OTLP em `4317`/`4318`.
- A API emite logs, métricas e traces via OpenTelemetry desde a fundação. Novos serviços seguem
  o mesmo padrão.
- Logs OTel são emitidos com `logs` de `@opentelemetry/api` (1.10+), que compartilha o provider
  global registrado pelo `NodeSDK`. Não use o pacote separado `@opentelemetry/api-logs` — ele
  mantém outro global e os logs não chegam ao coletor.

---

## 10. Segurança

- Segredos apenas em variáveis de ambiente; valide no boot.
- `.env` nunca é commitado.
- Autenticação e autorização em toda rota protegida.
- Isole dados por workspace/tenant; com Supabase, use **RLS**.
- Tokens de conectores criptografados e com menor privilégio.
- Sanitize entradas e evite injeção (SQL, prompt, HTML).
- Em IA: trate conteúdo externo como **não confiável** (prompt injection).

---

## 11. Acessibilidade e responsividade

- Siga [DESIGN.md](./DESIGN.md) e [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).
- Teclado, foco visível, labels, contraste AA e leitor de tela são obrigatórios.
- Layout funcional em 360px, 768px e 1280px.
- `prefers-reduced-motion` deve ser respeitado.

---

## 12. Performance

Metas (p75 mobile):

| Métrica | Meta    |
| ------- | ------- |
| LCP     | ≤ 2,5s  |
| INP     | ≤ 200ms |
| CLS     | ≤ 0,1   |

Práticas:

- Minimize JavaScript no client.
- Otimize imagens e fontes.
- Carregue componentes pesados sob demanda.
- Meça antes de otimizar; registre o antes/depois.

---

## 13. Anti-padrões

| ❌ Evite                                  | ✅ Prefira                                |
| ----------------------------------------- | ----------------------------------------- |
| `any` para "resolver" tipagem             | `unknown` + validação                     |
| Regra de negócio no controller/componente | Caso de uso / serviço de domínio          |
| `useEffect` para dados iniciais           | Server Component / loader                 |
| Componente gigante com muitos booleanos   | Variantes e composição                    |
| `utils.ts` com tudo                       | Módulos nomeados por domínio              |
| Abstração com um único uso                | Duplicação simples e legível              |
| Silenciar erro para "passar"              | Corrigir a causa ou tratar explicitamente |

---

## 14. Definition of Done

Consulte o checklist completo em [QA.md](./QA.md#8-definition-of-done-dod).

Resumo: plano atualizado, lint/tipos/build verdes, testes quando houver infraestrutura, UI
acessível e responsiva, documentação sincronizada e relatório final entregue.
