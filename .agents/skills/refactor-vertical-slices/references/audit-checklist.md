# Checklist de auditoria de vertical slices

Use este checklist na **Fase 1** (auditoria) e novamente na **Fase 4** (reauditoria). O objetivo
é encontrar **todos** os pontos fora do padrão com evidência suficiente para alguém corrigir sem
adivinhar.

Escopo: `apps/api/src/modules/<slice>/`. `modules/shared` é transversal e fica fora por padrão.

---

## 1. Como auditar

1. Liste as slices dinamicamente:
   `apps/api/src/modules/*` (diretórios), excluindo `shared` salvo pedido explícito.
2. Para cada slice, percorra as camadas e registre o que existe.
3. Inventarie **todos** os endpoints e seus contratos observáveis (seção 3).
4. Aplique os checks das seções 4-9 e registre achados no formato da seção 2.
5. Classifique severidade e liste isenções.
6. Termine com `AUDIT_RESULT: ok|blocked` e a contagem por severidade.

Nunca invente achado sem evidência `arquivo:linha`. Nunca proponha o plano passo a passo (isso é
do Agente 2).

---

## 2. Formato de achado

```text
ID | slice | camada | severidade | regra violada | arquivo:linha | evidência | mudança exigida | risco
```

Exemplo:

```text
AUTH-01 | auth | interface | blocker | R1/R4 | interface/auth.controller.ts:1-320 | 7 endpoints na mesma classe | dividir em 7 request handlers 1:1 | médio: contrato de cookie/erro
```

### Severidades

| Severidade  | Significado                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| **blocker** | Viola 1:1, direção de dependência, contrato de comportamento ou deixa endpoint sem cobertura |
| **major**   | Lógica na camada errada, porta/adaptador mal posicionado, domínio impuro, camada ausente     |
| **minor**   | Nomenclatura, localização de arquivo, sufixo inconsistente, organização de teste             |

Regra prática: se o problema pode mudar comportamento observável ou impedir a prova de que o
comportamento foi preservado, é **blocker**. Se afeta manutenção/arquitetura sem mudar contrato,
é **major**. Se é só estilo/organização, é **minor**.

---

## 3. Inventário de comportamento (golden master)

Antes de refatorar, registre para **cada endpoint**:

- [ ] Método HTTP e caminho completo (com prefixo global, ex.: `/api/v1/auth/sign-up`).
- [ ] Decorators: `@HttpCode`, `@Header`, `@Redirect`, `@Res({ passthrough: true })`.
- [ ] Guards e ordem de execução.
- [ ] Rate limiter (nome, limite, janela, escopo por IP/usuário).
- [ ] Validação de entrada e formato do erro de validação.
- [ ] Status de sucesso.
- [ ] Corpo de sucesso (campos, tipos, aninhamento).
- [ ] Headers de resposta (incluindo `Set-Cookie`).
- [ ] Cookies: nome, flags (`HttpOnly`, `Secure`, `SameSite`, `Path`, `Max-Age`).
- [ ] Códigos de erro e corpo (`{ code, message, fieldErrors? }`).
- [ ] Efeitos colaterais (e-mail, sessão, auditoria, log).
- [ ] Teste de integração que cobre o endpoint (arquivo e caso).

Esse inventário é a referência do QA na Fase 4. Endpoint sem teste de integração é **blocker**,
porque não há como provar preservação.

---

## 4. Checks de estrutura da slice

- [ ] Existem as camadas esperadas: `domain`, `application`, `interface`; `infrastructure` quando
      há I/O.
- [ ] Arquivos seguem `kebab-case`; classes exportadas em `PascalCase`.
- [ ] Não há arquivo "catch-all" (`auth.service.ts`, `auth.helpers.ts`) concentrando fluxos.
- [ ] `application/ports/` existe quando há dependência externa.
- [ ] `interface/request-handlers/` existe quando há endpoints.
- [ ] `<slice>.module.ts` existe e registra handlers e providers.
- [ ] Não há código morto deixado por refatoração anterior.

---

## 5. Checks de request handler (interface)

- [ ] Nenhum `*.controller.ts` **multi-endpoint** na slice. Com 2+ endpoints: **blocker**.
- [ ] `*.controller.ts` com 1 endpoint: **minor** de nomenclatura (deve virar request handler).
- [ ] Cada `*RequestHandler` tem **exatamente um** método com decorator de rota.
- [ ] Cada handler injeta **exatamente um** `*UseCase`.
- [ ] Rate limiter, guard, logger, presenter e mapper **não** contam como use case.
- [ ] Prefixo `@Controller(...)` pode ser compartilhado entre handlers; não é violação.
- [ ] Handler não importa `infrastructure/`, repositório, Supabase ou SDK.
- [ ] Handler não contém regra de negócio além de orquestração/tradução de erro.
- [ ] Tradução de erro de domínio → HTTP acontece na interface.
- [ ] Decorators de contrato preservados (`@HttpCode`, cookies, headers, guards).
- [ ] Nome do arquivo/classe descreve a intenção do endpoint.

---

## 6. Checks de use case (application)

- [ ] Um use case por fluxo/intenção; não há "service" que atende vários endpoints.
- [ ] Use case não importa `infrastructure/`, `interface/`, `@Controller` ou `@UseGuards`.
- [ ] Use case não conhece `Request`, `Response`, status HTTP ou `HttpException`.
- [ ] Use case recebe portas por injeção; não instancia adaptador concreto.
- [ ] Use case não chama outro use case de endpoint.
- [ ] Serviços internos compartilhados (`CreateSessionUseCase`) são permitidos e não são
      confundidos com use cases de endpoint.
- [ ] Entrada normalizada/validada antes de chegar ao domínio (ou validação pura no domínio).
- [ ] Saída tipada e estável.
- [ ] Unitários existem para os fluxos com regra relevante.

---

## 7. Checks de domínio

- [ ] `domain` não importa `@nestjs/*`, HTTP, banco, SDK ou `application`.
- [ ] Entidades/value objects guardam invariantes.
- [ ] Erros de domínio são classes próprias, sem status HTTP.
- [ ] Normalização/validação pura fica no domínio quando independe de framework.
- [ ] Não há `any`, `@ts-ignore` ou cast inseguro para "resolver" tipagem.

---

## 8. Checks de infraestrutura

- [ ] Adaptadores em `infrastructure/` implementam portas de `application`/`domain`.
- [ ] Nenhuma regra de negócio na infraestrutura.
- [ ] Adaptador não importa `interface/`.
- [ ] Nome segue `supabase-<x>.repository.ts` / `<vendor>-<x>.adapter.ts`.
- [ ] Erros de infraestrutura são traduzidos para erros de domínio/aplicação antes de subir.
- [ ] Módulo liga a porta ao adaptador (`{ provide: Port, useClass: Adapter }`).

---

## 9. Checks de dependência e contrato

- [ ] `application` não importa `infrastructure`.
- [ ] `domain` não importa `application`.
- [ ] `interface` não importa `infrastructure` diretamente.
- [ ] Não há dependência circular entre módulos.
- [ ] Rotas, métodos, status, corpos, headers, cookies, rate limits e erros são os mesmos de
      antes da refatoração.
- [ ] Efeitos colaterais (e-mail, sessão, log) preservados.
- [ ] Testes de integração existentes continuam cobrindo os endpoints.

---

## 10. Isenções e casos ambíguos

Registre com justificativa, não ignore:

| Caso                                | Tratamento                                            |
| ----------------------------------- | ----------------------------------------------------- |
| `modules/shared`                    | Fora do escopo; código transversal                    |
| Fakes e helpers em `src/test/fakes` | Isentos de camadas; são infraestrutura de teste       |
| Helpers puros sem I/O               | Podem ficar no domínio se não dependerem de framework |
| `CreateSessionUseCase` e similares  | Serviço interno da aplicação, não endpoint            |
| Controller de 1 endpoint            | `minor` (nomenclatura), não `blocker`                 |
| Prefixo `@Controller` compartilhado | Permitido; não é controller multi-endpoint            |

---

## 11. Saída da auditoria

O artefato `.plans/refactor-<escopo>-audit.md` deve conter:

1. Cabeçalho: escopo, branch, base, data, baseline dos gates.
2. Tabela de slices auditadas (camadas presentes, endpoints, status).
3. Inventário de comportamento (seção 3).
4. Tabela de achados no formato da seção 2.
5. Contagem por severidade.
6. Isenções e ambiguidades.
7. `AUDIT_RESULT: ok` ou `AUDIT_RESULT: blocked`.

Se não houver nenhum achado, registre `AUDIT_RESULT: ok` com "slice já conforme" e **não** invente
refatoração.
