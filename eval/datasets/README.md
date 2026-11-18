# Datasets de avaliação (spec 018)

> **Atualizado em:** 2026-11-18 · **Dono:** [`.docs/OBSERVABILITY.md`](../../.docs/OBSERVABILITY.md)

Esta pasta contém os quatro datasets sintéticos usados pelo gate determinístico de IA. O scorer é
puro: **nenhum modelo externo é chamado**, não há persistência em banco e os relatórios gerados
ficam em `eval/reports/` (ignorado pelo Git).

> **Regra de segurança:** todos os casos são **sintéticos**. Não versione prompt de sistema,
> template de prompt, resposta real, PII, chave, token, hash, URL sensível, trecho de arquivo ou
> dado de usuário. Use apenas texto inventado para teste. Em caso de dúvida, consulte
> [`.docs/RULES.md §5`](../../.docs/RULES.md#5-segurança-e-privacidade).

---

## 1. Arquivos

| Arquivo                                                      | Métrica             | O que mede                                                                  | Casos |
| ------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------- | ----- |
| [`expert-answer-quality.json`](./expert-answer-quality.json) | `answer_quality`    | A resposta candidate contém os termos esperados e mantém status consistente | 5     |
| [`citation-fidelity.json`](./citation-fidelity.json)         | `citation_fidelity` | As citações retornadas correspondem às fontes esperadas                     | 5     |
| [`rag-no-answer.json`](./rag-no-answer.json)                 | `no_answer`         | Quando não há base relevante, a resposta não inventa citações               | 5     |
| [`multimedia-intent.json`](./multimedia-intent.json)         | `media_intent`      | A intenção de mídia é reconhecida com o tipo esperado                       | 5     |

---

## 2. Esquema

Cada arquivo é um objeto com `name`, `revision` (string, usada para rastrear a versão do dataset),
`description`, `metrics` (lista com uma métrica), `thresholds` (mapa métrica → limiar) e `cases`.

```jsonc
{
  "name": "nome-do-dataset",
  "revision": "identificador-de-revisao",
  "description": "descrição curta em PT-BR",
  "metrics": ["nome_da_metrica"],
  "thresholds": { "nome_da_metrica": 0.8 },
  "cases": [
    {
      "id": "id-unico-do-caso",
      "input": "pergunta sintética usada como entrada",
      "candidate": {
        "answer": "resposta sintética avaliada",
        "answerStatus": "um dos status públicos",
        "sources": [],
        "citations": [],
        "mediaKind": "apenas quando aplicável",
      },
      "expected": {
        "answerContains": [],
        "sourceIds": [],
        "mediaKind": "apenas quando aplicável",
        "noAnswer": true,
      },
    },
  ],
}
```

Campos por dataset:

| Dataset                 | `candidate`                                      | `expected`       |
| ----------------------- | ------------------------------------------------ | ---------------- |
| `expert-answer-quality` | `answer`, `answerStatus`                         | `answerContains` |
| `citation-fidelity`     | `answer`, `answerStatus`, `sources`, `citations` | `sourceIds`      |
| `rag-no-answer`         | `answer`, `answerStatus`, `citations`            | `noAnswer`       |
| `multimedia-intent`     | `answer`, `answerStatus`, `mediaKind`            | `mediaKind`      |

`answerStatus` usa os valores públicos da aplicação (`plain`, `with_source`, `no_match`,
`retrieval_unavailable`). Campos não aplicáveis a um dataset podem ser omitidos.

---

## 3. Execução

Na raiz do monorepo:

```bash
bun run obs:eval
bun run obs:eval --dataset eval/datasets/expert-answer-quality.json
bun run obs:eval --baseline eval/reports/baseline.json
bun run obs:eval --out eval/reports/current.json
```

| Código | Significado                                   |
| ------ | --------------------------------------------- |
| `0`    | todos os limiares atendidos                   |
| `1`    | pelo menos um limiar não atendido             |
| `2`    | dataset ausente/inválido ou baseline inválido |

O relatório mostra `score`, `limiar`, `PASS`/`FAIL` e `delta` por métrica quando `--baseline` é
informado. O limiar padrão é `0.8` e pode ser sobrescrito por dataset.

> Use `bun run obs:eval` antes de alterar prompt, modelo, retrieval ou renderização de citações.
> É o gate local disponível enquanto a stack LangSmith licenciada não é validada.

---

## 4. Como adicionar ou revisar casos

1. Escolha o dataset dono da métrica; não crie um quarto arquivo para um caso sem métrica nova.
2. Escreva `input` e `candidate` com dados **inventados**, curtos e sem PII.
3. Preencha `expected` apenas com o campo que a métrica avalia.
4. Use um `id` estável e único dentro do dataset.
5. Incremente `revision` quando o conteúdo dos casos mudar.
6. Rode `bun run obs:eval` e registre o resultado (sem valores sensíveis) no plano/QA da mudança.
7. Se o limiar mudar, justifique no plano e atualize `thresholds` e a tabela da
   [spec 018](../../.specs/018-langsmith-local.md).

Limiares mais altos não significam qualidade real medida em produção: as metas `≥ 90%`, `≥ 85%` e
p95 `< 4 s` das specs 012/016 permanecem pendentes de medição em ambiente com modelo e banco reais
(ver [`.docs/AI.md §11`](../../.docs/AI.md#11-validações-bloqueadas-ou-parciais)).
