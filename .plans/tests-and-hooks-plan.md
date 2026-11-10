# Plano — testes de log, pgTAP, spec 001 e hooks git

## Contexto e problema

Quatro pendências pequenas, decididas pelo usuário: (1) só o sign-in prova que logs não vazam PII; (2) o pgTAP da 001 cobre pouco das constraints; (3) a spec 001 fala em rollback com teste/`if not exists`, mas o rollback é manual; (4) os hooks do Lefthook quebram com caminho com espaços e com arquivos TS.

## Objetivo e critérios de aceite

- sign-up, confirm e forgot-password têm teste que afirma que e-mail, senha, token e JWT não aparecem nos logs (se houver vazamento real, parar e reportar).
- `bun run db:test` passa com unicidade (23505), NOT NULL, limites de tamanho e acesso anônimo real (`set local role anon`).
- Spec 001 descreve as constraints extras e o rollback manual, sem divergir da migração.
- `git commit` normal (sem `LEFTHOOK_EXCLUDE`/`--no-verify`) passa neste worktree com espaços no caminho.

## Escopo e fora de escopo

Dentro: specs de integração da auth, `supabase/tests/001-auth-schema.test.sql`, `.specs/001-*.md`, `lefthook.yml`, `package.json` (lint-staged), docs QA/DEVELOPMENT se citarem a limitação.
Fora: migração SQL já aplicada, outras specs, spec 008, `.plans/002-008-orchestration.md`, e2e, servidores, qualquer comando destrutivo no banco compartilhado.

## Abordagem técnica

1. Replicar o spy de `console` do sign-in; `vi.restoreAllMocks` em `afterEach`.
2. pgTAP dentro de transação (rollback ao final); unicidade com e-mails normalizados idênticos.
3. Reescrever trechos da spec 001 para refletir a migração real.
4. Lefthook: `{1}` entre aspas no commitlint; lint-staged com eslint resolvendo config por pacote.

## Riscos e mitigação

- Banco compartilhado: somente leitura/transação.
- Vazamento real de PII nos logs: parar e reportar.
- Hooks: provar commitando de verdade.

## Plano de testes e QA manual

`bun run lint`, `types:check`, `test`, `build`, `db:test`; commit real sem bypass.
