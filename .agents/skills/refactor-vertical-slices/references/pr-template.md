# Template de corpo do PR — refatoração de vertical slices

Use este template para gerar `.plans/refactor-<escopo>-pr.md` e passar ao `gh pr create --body-file`.
Substitua os placeholders. Não deixe seção vazia: escreva "n/a" com justificativa quando não se
aplicar.

---

## Título sugerido

```text
refactor(api): align vertical slices with request handler pattern
```

Para uma slice específica:

```text
refactor(<slice>): split controller into request handlers
```

---

## Corpo

```md
## Resumo

Refatoração das vertical slices da API para o padrão do projeto: camadas
`interface → application → domain` com `infrastructure` implementando portas, **um use case por
fluxo** e **um request handler por endpoint em relação 1:1 com o use case de entrada**.

Escopo: `<escopo>` (slices: `<lista>`).
Branch: `refactor/<escopo>`.
Artefatos: `.plans/refactor-<escopo>-audit.md`, `-plan.md`, `-qa.md`.

## Achados resolvidos

| ID      | Slice | Severidade | Regra | Resolução                                                         |
| ------- | ----- | ---------- | ----- | ----------------------------------------------------------------- |
| AUTH-01 | auth  | blocker    | R1/R4 | `auth.controller.ts` (7 endpoints) dividido em 7 request handlers |
| ...     | ...   | ...        | ...   | ...                                                               |

Achados adiados (com motivo e follow-up):

| ID  | Motivo | Follow-up |
| --- | ------ | --------- |
| ... | ...    | ...       |

## Mudanças por camada

### Interface

- `<slice>/interface/request-handlers/*.request-handler.ts` — um handler por endpoint.
- Guards, decorators, rate limiters preservados.

### Application

- `<slice>/application/<flow>.use-case.ts` — um use case por fluxo.
- `<slice>/application/ports/*.port.ts` — portas movidas/extraídas.
- Serviços internos compartilhados mantidos (ex.: `CreateSessionUseCase`).

### Domain

- Erros e validações puras mantidos sem dependência de framework/HTTP.

### Infrastructure

- `<slice>/infrastructure/*` — adaptadores implementando as portas.

### Módulo

- `<slice>/<slice>.module.ts` — handlers registrados e portas ligadas aos adaptadores.

## Preservação de comportamento

Contrato observável mantido (sem mudanças de rota, método, status, corpo, header, cookie, rate
limit, guard ou código de erro):

- [ ] Rotas e métodos idênticos.
- [ ] Status codes idênticos.
- [ ] Corpos de sucesso e erro idênticos (`{ code, message, fieldErrors? }`).
- [ ] Headers e cookies idênticos (flags incluídas).
- [ ] Guards e rate limits idênticos.
- [ ] Efeitos colaterais idênticos (e-mail, sessão, logs).
- [ ] Testes de integração existentes continuam passando sem enfraquecimento.

Evidências: `<links para testes/diff/QA manual>`.

## Gates executados

| Comando               | Resultado                |
| --------------------- | ------------------------ |
| `bun run lint`        | ✅                       |
| `bun run types:check` | ✅                       |
| `bun run test`        | ✅                       |
| `bun run build`       | ✅                       |
| `bun run test:e2e`    | n/a (sem mudança no web) |

## Riscos e follow-ups

- `<risco residual + mitigação>`
- `<follow-up com dono e critério de retomada>`

## Documentação

- [ ] `ARCHITECTURE.md` atualizado.
- [ ] `DEVELOPMENT.md` atualizado.
- [ ] `QA.md` atualizado (checklist de arquitetura).
- [ ] ADR criado/atualizado (padrão de request handler 1:1).

## Checklist

- [ ] Branch dedicada `refactor/<escopo>`.
- [ ] Working tree limpo antes da refatoração.
- [ ] Baseline verde antes de começar.
- [ ] Auditoria completa com contrato de comportamento.
- [ ] Plano em ondas cobrindo todos os blockers/majors.
- [ ] Nenhum `*.controller.ts` multi-endpoint no escopo.
- [ ] Cada endpoint com handler próprio e use case 1:1.
- [ ] Dependências apontam para dentro.
- [ ] Gates verdes.
- [ ] Reauditoria sem blockers/majors.
- [ ] Commit Conventional Commits com trailer.
```

---

## Regras para o corpo

- Seja específico: cite arquivos e IDs de achado.
- Não cole diffs gigantes; linke os artefatos em `.plans/`.
- Não prometa mudanças fora do escopo; registre como follow-up.
- Não marque checklist sem evidência.
- Se o PR for de uma slice só, adapte o título e a seção de mudanças por camada.
