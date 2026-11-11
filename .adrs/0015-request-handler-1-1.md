# ADR 0015 — Request handler 1:1 por endpoint e use case por fluxo

> **Status:** aceito · **Data:** 2026-11-11
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

O slice `auth` cresceu por fatias e concentrou sete endpoints em uma única `AuthController`, com seis
casos de uso e cinco rate limiters no mesmo construtor. A auditoria de `.plans/refactor-api-all-audit.md`
registrou dois blockers:

- `AUTH-01`: controller multi-endpoint, difícil de ler, testar isoladamente e evoluir sem tocar em
  fluxos vizinhos.
- `AUTH-02`: `GET /auth/me` devolvia o `AuthUser` injetado pelo guard sem um caso de uso de entrada,
  criando uma exceção silenciosa ao padrão "um caso de uso por fluxo".

O slice `hello` repetia o formato antigo (`HelloController`) para um único endpoint. Sem uma regra
explícita, cada nova rota poderia voltar a agrupar endpoints ou a pular a camada de aplicação. A
refatoração precisava preservar método, caminho, status, corpo, headers, cookies, rate limits, guards,
códigos de erro, mensagens e efeitos colaterais dos oito endpoints existentes.

## Decisão

1. **Um request handler por endpoint.** Cada endpoint vive em
   `apps/api/src/modules/<slice>/interface/request-handlers/<flow>.request-handler.ts`, com
   `@Controller("<recurso>")`, **exatamente um** método decorado com `@Get`/`@Post`/`@Put`/`@Patch`/
   `@Delete` e **exatamente um** `*UseCase` de endpoint injetado. Rate limiter, guard e decorators
   como `@CurrentUser()` são colaboradores permitidos.
2. **Um caso de uso por fluxo/intenção.** Sign-up, sign-in, sign-out, confirmação, solicitação de
   reset e troca de senha têm um `*UseCase` de endpoint cada. `CreateSessionUseCase` e
   `ValidateSessionUseCase` permanecem **serviços internos** da aplicação, reutilizados por mais de
   um fluxo; não viram casos de uso de endpoint nem são injetados em handlers.
3. **`GetCurrentUserUseCase` fino.** `GET /auth/me` é atendido por `GetCurrentUserRequestHandler`, que
   injeta apenas `GetCurrentUserUseCase`. O caso de uso recebe o `AuthUser` já resolvido pelo
   `SessionGuard`, devolve a mesma referência e **não relê** repositório nem porta. A sessão
   continua sendo validada no guard, como antes.
4. **Tradução de erro na interface.** Erros de domínio continuam sendo convertidos em
   `HttpException`/`BadRequestException` no handler, com os mesmos códigos, mensagens e
   `Retry-After`. `application` e `domain` não conhecem HTTP.
5. **Helpers compartilhados da interface.** `clientIp` e `readConfirmationToken` vivem em arquivos
   próprios em `interface/`, importados pelos handlers que precisam deles.
6. **Remoção do controller só no fim.** O `AuthController` multi-endpoint só é apagado depois que
   todos os handlers estão registrados e a suíte de integração de cada fluxo está verde, evitando
   rota duplicada (o Express usaria a primeira registrada).
7. **Contrato público mínimo do módulo.** `AuthModule` exporta apenas `SessionTokenPort`, necessário
   para os testes de integração assinarem JWTs via `moduleRef.get(SessionTokenPort)`.

O mesmo padrão foi aplicado a `hello`: `GetHelloRequestHandler` substituiu `HelloController`.

## Consequências

### Positivas

- Cada endpoint tem um arquivo pequeno, com uma responsabilidade e um caso de uso explícito.
- Testes unitários do handler cobrem ordem rate limit → validação → caso de uso e a tradução de
  erros sem subir a aplicação Nest; a integração continua provando guard, pipes, rota e serialização.
- Novos endpoints não aumentam construtores gigantes nem misturam dependências de fluxos distintos.
- O padrão fica verificável por inspeção: 8 decorators de rota e 8 `@Inject(*UseCase)` nos handlers.
- `GetCurrentUserUseCase` elimina a exceção do `/me` sem adicionar I/O.

### Negativas / trade-offs

- Mais arquivos por slice; fluxos simples ganham um handler e, às vezes, um caso de uso fino.
- Constantes e tipos de resposta antes centralizados no controller agora ficam co-localizados no
  handler; importadores externos precisam apontar para o novo caminho (não havia importadores).
- A ordem das operações passa a depender de disciplina por handler; os specs unitários e de
  integração são a rede de segurança.

## Alternativas consideradas

| Alternativa                                               | Por que foi descartada                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Manter o `AuthController` multi-endpoint                  | Não resolve `AUTH-01`, mantém construtor com 11 dependências e testes acoplados            |
| Abrir exceção para `/me` sem caso de uso                  | Mantém `AUTH-02`; o padrão deixaria de ser uniforme e verificável                          |
| `GetCurrentUserUseCase` reler o repositório               | Adiciona I/O e uma corrida desnecessária; o guard já resolveu e validou o `AuthUser`       |
| Mover rate limiters para `interface/rate-limiters/`       | Não é achado da auditoria; mudança de pasta sem requisito                                  |
| Transformar `CreateSession`/`ValidateSession` em handlers | São serviços internos reutilizados; virariam casos de uso artificiais sem endpoint próprio |
| Apagar o controller antes de migrar todos os endpoints    | Deixaria rotas ausentes durante a refatoração e quebraria a suíte de integração            |

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md)
- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [QA.md](../.docs/QA.md)
- [ADR 0004 — Arquitetura em camadas com vertical slices](./0004-camadas-e-vertical-slices.md)
- [Auditoria da refatoração](../.plans/refactor-api-all-audit.md)
- [Plano da refatoração](../.plans/refactor-api-all-plan.md)
