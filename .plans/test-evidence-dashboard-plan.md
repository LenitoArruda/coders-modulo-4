# Plano — Evidências de testes, cobertura e observabilidade

> **Status:** concluído (documentação e evidências; pendências registradas) · **Criado em:** 2026-11-18
> **Tipo:** melhoria de documentação e evidências (sem mudança de comportamento de runtime)
> **Origem:** revisão do Módulo 4 — nota 7,8/10; lacunas apontadas em cobertura de testes,
> evidências de dashboards/logs e documentação de erros em produção.

---

## 1. Contexto e problema

A avaliação reconheceu a implementação, mas apontou três lacunas de **apresentação de evidência**:

1. Testes são citados, mas faltam procedimentos reproduzíveis, resultados de sucesso/falha e
   cobertura medida/documentada.
2. A observabilidade está implementada, mas não há uma demonstração visual do dashboard nem
   exemplos concretos de logs gerados pela aplicação.
3. A documentação sobre erros encontrados em produção/diagnóstico é superficial.

O objetivo desta rodada é tornar a qualidade **verificável**, sem inventar resultados.

## 2. Objetivo e critérios de aceite

1. **AC-1** — `.docs/QA.md` traga uma seção de evidência de testes com: comandos exatos,
   ambiente, contagens de arquivos/testes, resultados de sucesso/falha e situação da cobertura.
2. **AC-2** — A cobertura seja medida com a ferramenta já disponível no repositório; se não houver
   provedor instalado, o limite é registrado explicitamente como pendência com o comando exato
   para habilitá-lo, sem afirmar número inexistente.
3. **AC-3** — `.docs/OBSERVABILITY.md` inclua um inventário demonstrativo do dashboard (rows,
   painéis, queries por fonte) e uma prévia visual estática gerada a partir do JSON versionado.
4. **AC-4** — Exemplos de logs estruturados emitidos pelo código sejam documentados com campos e
   mensagens, sem valores reais, e o rota de diagnóstico de erros de produção seja aprofundada.
5. **AC-5** — A prévia visual seja reproduzível por script sem dependências novas e identificada
   como representação da estrutura, não como dados reais de produção.
6. **AC-6** — Nenhum segredo, prompt, PII ou valor de `.env` seja introduzido; links relativos
   sejam válidos e `git diff --check` passe.

## 3. Escopo

### Dentro

- Ampliação de `.docs/QA.md` e `.docs/OBSERVABILITY.md`.
- Criação de um gerador de prévia visual (texto/SVG) e do artefato gerado em `observability/`.
- Atualização dos índices em `README.md`, `.docs/AGENTS.md` e `.specs/README.md` quando aplicável.
- Execução local dos comandos de teste/cobertura que não dependam de Docker.

### Fora

- Mudanças de comportamento em runtime, prompts, modelos, infraestrutura ou `.env`.
- Instalação de dependências sem justificativa e pedido explícito.
- Simulação de dados de produção ou capturas de tela rotuladas como reais.
- Commit/push sem pedido explícito nesta rodada.

## 4. Abordagem técnica

1. Mapear configuração de testes, cobertura e artefatos de dashboard (concluído).
2. Executar os comandos de verificação disponíveis e capturar contagens/resultados.
3. Gerar prévia visual do dashboard a partir de `api-overview.json`.
4. Escrever as seções de evidência no documento dono de cada assunto.
5. Validar links, whitespace e conteúdo sensível; entregar relatório final.

## 5. Arquivos e áreas previstos

- `.docs/QA.md` (evidências de testes e cobertura)
- `.docs/OBSERVABILITY.md` (dashboards, logs e diagnóstico de erros)
- `observability/gen-dashboard-preview.mjs` (novo, se aprovado pelo mapeamento)
- `observability/dashboard-preview.svg` (novo, artefato gerado)
- `README.md` e `.docs/AGENTS.md` (índices, se necessário)

## 6. Riscos e mitigação

| Risco                                 | Mitigação                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Afirmar cobertura sem medição real    | Só documentar números produzidos por comando executado; senão marcar como 🧭   |
| Prévia visual parecer telemetria real | Título e legenda explícitos: "estrutura do painel, não dados de produção"      |
| Prettier reformate artefato gerado    | Gerar SVG determinístico e validar após o hook                                 |
| Docker indisponível para captura real | Documentar o bloqueio e fornecer procedimento reproduzível para quando existir |

## 7. Plano de testes

- `bun run test` (e variante de cobertura, se disponível).
- `bun run test:e2e` somente se já executável sem serviços externos.
- Validação de links relativos e `git diff --check`.
- Varredura do diff por segredos, prompts e PII.

## 8. QA manual

1. Conferir que cada número citado tem um comando executado correspondente.
2. Abrir a prévia visual e conferir rows/painéis contra `api-overview.json`.
3. Conferir que os exemplos de log usam apenas campos e mensagens do código.
4. Revisar o diff completo antes de qualquer publicação.

## 9. Evidências e pendências

### Mapeamentos concluídos

- **Testes/cobertura:** scripts e configs confirmados; nenhum provider de cobertura instalado;
  `turbo.json` com `outputs: []`; QA §§11–20 já registram contagens históricas, §22 passa a registrar
  a execução desta rodada e a pendência de cobertura.
- **Dashboard:** `api-overview.json` tem 10 rows / 51 visualizações / 64 queries (18 Loki, 42
  Prometheus, 4 Tempo); não havia artefato visual versionado de observabilidade.

### Evidências executadas

| Comando                                             | Resultado                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `bun run test`                                      | ok — API 91 arquivos / 627 testes (42,27 s); web 13 arquivos / 156 testes (3,37 s); 2/2 tarefas, 0 cache, 46,804 s |
| `bun run obs:eval`                                  | ok — 4/4 datasets, `overall: 0.800 PASS`                                                                           |
| `bunx turbo test --filter=web --only -- --coverage` | falha esperada (exit 1) — `MISSING DEPENDENCY @vitest/coverage-v8`                                                 |
| `bun observability/gen-dashboard-preview.mjs`       | ok — SVG gerado com 10 rows / 51 painéis / 64 queries                                                              |

### Critérios de aceite

- **AC-1** ✅ — QA §22 traz comandos, ambiente, contagens e resultados.
- **AC-2** ✅ — cobertura não existe; pendência e comando para habilitá-la registrados sem número
  inventado.
- **AC-3** ✅ — OBSERVABILITY §10 inventaria rows/painéis/queries e referencia a prévia SVG.
- **AC-4** ✅ — exemplos de logs sanitizados e fluxo de diagnóstico de erros documentados.
- **AC-5** ✅ — gerador sem dependências, determinístico, rotulado como estrutura (não produção).
- **AC-6** ✅ — 269 links/âncoras válidos, 0 problemas; `git diff --check` limpo; 0 ocorrências
  suspeitas em 17 arquivos Markdown; `bun run lint` ok (3 tarefas).

### Validação final (2026-11-18)

| Verificação                                | Resultado                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `bun run lint`                             | ok — 3 tarefas                                                                                         |
| `bun run types:check`                      | ok — 3 tarefas                                                                                         |
| verificador de links relativos/âncoras     | 269 links, 0 problemas, 0 linhas com trailing whitespace                                               |
| varredura de segredos/prompts no diff      | 17 arquivos, 0 ocorrências suspeitas                                                                   |
| `git diff --check`                         | limpo                                                                                                  |
| `bunx prettier --check` nos arquivos novos | plano e gerador ajustados com `--write`; SVG não tem parser no Prettier e é gerado deterministicamente |

### Pendências (fora desta rodada)

- Instalar provider de cobertura e medir percentuais reais (AC-2).
- Subir LGTM/Docker para captura ao vivo do Grafana e executar E2E novamente.
- CI inexistente; correlação de IDs, alertas e métricas de domínio seguem em aberto (§6 do doc).
