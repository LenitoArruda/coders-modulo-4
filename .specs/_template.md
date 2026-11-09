# [Nome da feature] — Spec

> **Status:** draft | approved | implementing | done
> **Atualizado em:** YYYY-MM-DD
> **Autor:** [nome ou @handle]
> **Plano:** `.plans/<numero>-<slug>-plan.md`

<!--
Como usar este template:
- Salve o arquivo como `.specs/<numero>-<slug>.md` (3 dígitos; ex.:
  `001-expert-onboarding.md`).
- Substitua os placeholders e remova os comentários antes de salvar.
- Preencha apenas as seções relevantes; omita seções vazias em features pequenas.
- Descreva o QUÊ e o POR QUÊ. Arquivos, classes, bibliotecas e passos de implementação
  pertencem ao plano.
- Critérios de aceite devem ser verificáveis no formato:
  "Dado <contexto>, quando <ação>, então <resultado observável>."
- Toda decisão aberta precisa de impacto e dono.
- Status `approved` só depois de aprovação explícita do usuário.
-->

## 1. Contexto e problema

<!-- Qual dor concreta? Quem sente? Como é resolvido hoje? Por que agora?
     Inclua a necessidade de negócio: qual o custo de não resolver? -->

## 2. Usuários e jobs

<!-- Quem usa, com que frequência, em qual contexto? Quais papéis e permissões? -->

## 3. Resultado esperado

<!-- O que o usuário consegue fazer que não conseguia antes? Qual comportamento é observável? -->

## 4. Métricas de sucesso

<!-- Qual número ou evento deve mudar, de quanto para quanto, em quanto tempo? -->

## 5. Escopo

### Dentro

<!-- O que faremos nesta versão. -->

- ...

### Fora

<!-- O que explicitamente não faremos nesta versão. -->

- ...

## 6. Fluxos

### Fluxo principal

1. ...

### Fluxos alternativos e de exceção

- ...

## 7. Regras e casos de borda

<!-- Validações, limites, estados vazios/erro, concorrência, idempotência, etc. -->

## 8. Dados e contratos

<!-- Entradas, saídas, armazenamento, retenção, formatos, eventos e APIs. -->

## 9. Permissões e segurança

<!-- Quem pode ver, criar, editar e excluir? Há isolamento por workspace/tenant?
     Quais dados são sensíveis e como são protegidos? -->

## 10. Requisitos não funcionais

<!-- Latência, volume, custo, disponibilidade, acessibilidade e observabilidade. -->

## 11. Dependências e riscos

<!-- Sistemas, times, credenciais, decisões externas, riscos e mitigação. -->

## 12. Rollout e migração

<!-- Feature flag, compatibilidade, migração de dados, rollback e comunicação. -->

## 13. Estratégia de teste

<!-- Unitário, integração, E2E e manual. Cenários críticos e dados de teste. -->

## 14. Critérios de aceite

- [ ] Dado `<contexto>`, quando `<ação>`, então `<resultado observável>`.
- [ ] ...

## 15. Decisões e questões abertas

| Tema | Decisão ou pergunta | Impacto | Dono | Status |
| ---- | ------------------- | ------- | ---- | ------ |
| ...  | ...                 | ...     | ...  | aberta |
