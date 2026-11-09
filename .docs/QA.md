# QA.md — Qualidade e verificação

> **Status:** ativo · **Atualizado em:** 2026-11-09
> **Use antes de declarar qualquer tarefa concluída.**

Este documento é a fonte de verdade sobre **como verificar** mudanças. Se um comando citado
aqui não existir no `package.json`, ele está marcado como 🧭 planejado.

---

## 1. Pré-requisitos

| Requisito               | Versão                              |
| ----------------------- | ----------------------------------- |
| Node.js                 | >= 24                               |
| Bun                     | 1.4.4                               |
| Docker Desktop          | em execução (Supabase e LGTM)       |
| Dependências instaladas | `bun install`                       |
| Navegador do Playwright | `bun x playwright install chromium` |

---

## 2. Comandos existentes hoje

Execute na raiz do monorepo:

| Comando               | O que faz                                                    |
| --------------------- | ------------------------------------------------------------ |
| `bun install`         | Instala dependências                                         |
| `bun run dev`         | Sobe `web` (3000), `docs` (3001) e `api` (3333) em paralelo  |
| `bun run build`       | Build de todos os apps/pacotes via Turbo                     |
| `bun run lint`        | ESLint em todos os apps/pacotes                              |
| `bun run lint:commit` | Valida a mensagem de commit preparada (Conventional Commits) |
| `bun run code:fix`    | ESLint `--fix` + Prettier em código, JSON, CSS e YAML        |
| `bun run format`      | Prettier em `**/*.{ts,tsx,md}`                               |
| `bun run types:check` | `tsc --noEmit` / typegen do Next em todos os apps/pacotes    |
| `bun run test`        | Testes unitários e de integração da API (Vitest)             |
| `bun run test:watch`  | Vitest em modo watch                                         |
| `bun run test:e2e`    | Smoke E2E do web (Playwright)                                |
| `bun run infra:up`    | Sobe LGTM (Compose) e Supabase local                         |
| `bun run infra:down`  | Para Supabase e LGTM (idempotente)                           |
| `bun run db:migrate`  | Aplica migrações pendentes no Supabase local                 |

> Use sempre `bun run <script>`. `bun build` e `bun test` são comandos nativos do Bun e **não**
> executam os scripts do `package.json`.

### 2.1 Comando do OpenCode

| Comando            | O que faz                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `/commit-and-push` | Analisa o diff, cria um commit Conventional Commits com `Co-authored-by: opencode <noreply@opencode.ai>` e faz push |

> O fluxo está em `.opencode/commands/commit-and-push.md`. Ele é obrigatório ao final de cada
> spec (skill `implement-me`). Fora disso, só execute com pedido explícito do usuário.

---

## 3. Execução por pacote

```sh
bunx turbo lint --filter=web --only
bunx turbo types:check --filter=api --only
bunx turbo test --filter=api --only
bunx turbo build --filter=web
```

> O Turbo executa também as dependências por padrão (`dependsOn`). Use `--only` quando quiser
> restringir a tarefa ao pacote filtrado; não use `--only` no `build`, que precisa das
> dependências.

---

## 4. Ordem obrigatória de verificação

1. `bun run code:fix` (quando houver correções automáticas pendentes)
2. `bun run lint`
3. `bun run types:check`
4. `bun run test`
5. `bun run build`
6. `bun run test:e2e` (quando a mudança afetar o web)
7. QA manual do fluxo alterado

O `build` é o **gate final**: se ele falha, a tarefa não está concluída.

---

## 5. QA por tipo de mudança

### 5.1 UI

- [ ] Light theme apenas; sem dark mode.
- [ ] Cores e tokens do design system.
- [ ] Contraste AA (texto sobre pastel é grafite).
- [ ] Navegação por teclado e foco visível.
- [ ] Labels e nomes acessíveis.
- [ ] Layout em 360px, 768px e 1280px, sem rolagem horizontal.
- [ ] Estados: loading, vazio, erro, disabled.
- [ ] Textos em PT-BR e sem erros.

### 5.2 API

- [ ] Status HTTP corretos (200, 201, 204, 400, 401, 403, 404, 409, 422, 500).
- [ ] Validação de entrada e mensagens de erro claras.
- [ ] Autenticação/autorização aplicadas.
- [ ] Paginação, filtros e ordenação quando aplicável.
- [ ] Nenhum detalhe interno (stack, SQL) exposto.
- [ ] Logs com contexto e sem PII.
- [ ] Logs, métricas e traces chegam ao LGTM (`service_name="coders-modulo-4-api"`).

### 5.3 Banco de dados

- [ ] Migração aplicável e reversível.
- [ ] Índices para consultas críticas.
- [ ] RLS/isolamento por tenant quando aplicável.
- [ ] Nenhuma perda de dados.
- [ ] Seed/dados de teste documentados.

### 5.4 Conectores e integrações

- [ ] Autenticação e renovação de token.
- [ ] Timeout, retry e rate limit tratados.
- [ ] Mapeamento de payload validado.
- [ ] Falha de uma fonte não derruba o fluxo inteiro.
- [ ] Segredos fora do código e dos logs.

### 5.5 Documentação

- [ ] Links internos funcionam.
- [ ] Comandos citados existem ou estão marcados como planejados.
- [ ] Sem contradição com `RULES.md` ou `ARCHITECTURE.md`.
- [ ] Exemplos de código compilam/refletem a realidade.

### 5.6 Dependências

- [ ] Necessidade justificada (alternativa nativa?).
- [ ] Licença compatível.
- [ ] Impacto no bundle e na segurança avaliado.
- [ ] `bun.lock` atualizado.
- [ ] Documentação da stack atualizada.

### 5.7 Infraestrutura e observabilidade

- [ ] `bun run infra:up` sobe LGTM e Supabase e o Grafana responde em `http://localhost:3010`.
- [ ] `bun run db:migrate` aplica migrações pendentes e é idempotente.
- [ ] `bun run infra:down` para os serviços e funciona quando já estão parados.
- [ ] Nenhum container em loop de reinício (`docker ps` estável).
- [ ] Logs, métricas e traces visíveis no Grafana em até 30 s após uma requisição à API.
- [ ] Nenhum segredo aparece nos logs do coletor ou da aplicação.

### 5.8 Git e commits

- [ ] Mensagem segue Conventional Commits (`<tipo>(<escopo>): <descrição>`).
- [ ] O hook `commit-msg` está instalado (`.git/hooks/commit-msg`).
- [ ] `bun run lint:commit` passa para a mensagem preparada.
- [ ] Ao final de uma spec, `commit-and-push` foi executado (commit + push).
- [ ] `git status` sem segredos, artefatos gerados ou arquivos acidentais.

---

## 6. QA manual — template

Registre no relatório final:

```md
### Cenário: <nome>

1. Ação: <passo>
   Esperado: <resultado>
   Resultado: ok

2. Ação: <passo>
   Esperado: <resultado>
   Resultado: falha — <evidência>
```

Inclua ambiente (navegador/dispositivo) quando for UI.

---

## 7. Regressão mínima

Antes de finalizar, verifique se a mudança não quebrou:

- [ ] Rotas existentes (`/` em `web`, `docs` e API).
- [ ] Componentes compartilhados usados por mais de um app.
- [ ] Scripts do monorepo (`dev`, `build`, `lint`, `types:check`, `test`, `test:e2e`,
      `infra:up`, `infra:down`).
- [ ] Build de produção.
- [ ] Serviços de infraestrutura estáveis após `infra:up`/`infra:down`.

---

## 8. Definition of Done (DoD)

- [ ] Plano criado/atualizado em `.plans/<numero>-<slug>-plan.md`.
- [ ] `bun run lint` passa.
- [ ] `bun run types:check` passa.
- [ ] `bun run test` passa.
- [ ] `bun run build` passa.
- [ ] Testes adicionados/atualizados para toda mudança de comportamento.
- [ ] `bun run test:e2e` passa quando a mudança afeta o web.
- [ ] QA manual executado e registrado.
- [ ] UI acessível e responsiva (quando aplicável).
- [ ] Documentação afetada atualizada.
- [ ] Sem segredos ou artefatos gerados no diff.
- [ ] Mensagem de commit segue Conventional Commits (validada pelo commitlint).
- [ ] Ao final de uma spec, `commit-and-push` executado (commit + push).
- [ ] Relatório final entregue conforme [RULES.md](./RULES.md#8-relatório-final-obrigatório).

> O bloqueio antigo de lint (preset Babel) foi corrigido na fundação. Se ele voltar a ocorrer,
> trate como regressão e registre no relatório.

---

## 9. CI alvo (🧭)

Pipeline recomendado, nesta ordem:

```text
install → lint → types:check → test → build → test:e2e
```

Requisitos:

- Cache do Turbo entre execuções.
- Falhar em qualquer etapa com erro.
- Rodar em pull requests e na branch principal.
- Validar as mensagens de commit do PR com `commitlint --from <base> --to HEAD`.
- Não fazer deploy sem `lint`, `types:check`, `test` e `build` verdes.

> Ainda não existe configuração de CI no repositório (`.github/workflows`).

---

## 10. Lacunas conhecidas

| Lacuna                                      | Impacto                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Nenhum CI                                   | Verificação depende do ambiente local                                                                              |
| Commitlint apenas local                     | Como não há CI, mensagens só são validadas pelo hook `commit-msg`                                                  |
| Produto não implementado                    | Apenas a rota de hello world e a fundação existem                                                                  |
| `apps/docs` ainda é o starter               | Conteúdo público de documentação não definido                                                                      |
| Componentes legados em `packages/ui`        | `button`, `card` e `code` são mantidos por uso em `apps/docs`                                                      |
| Sem Vitest/Testing Library no pacote `ui`   | Componentes compartilhados não têm testes unitários                                                                |
| Supabase Analytics desabilitado             | `vector` exige Docker API em `2375`; a telemetria da app usa o LGTM                                                |
| PostgreSQL local em `15`                    | Workaround de ambiente; alinhar com a versão alvo antes de produção                                                |
| OXLint/OXFmt não adotados                   | ESLint + Prettier seguem como padrão nesta entrega                                                                 |
| Skills locais em `.agents/` não versionadas | A edição de `implement-me`/`create-spec`/`refine-spec` fica restrita à máquina; a política durável está em `.docs` |

Ao resolver uma lacuna, atualize esta tabela e o documento relacionado.
