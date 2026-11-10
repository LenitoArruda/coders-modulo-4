// Gera observability/dashboards/api-overview.json. Rode: node observability/gen-dashboard.mjs
//
// Fontes de dados reais da API (Bun + OpenTelemetry):
//  - Loki: log "HTTP request completed" com structured metadata (method, path, statusCode, durationMs, requestId)
//    e eventos de auth (outcome). É a fonte mais rica por endpoint.
//  - Prometheus: traces_spanmetrics_* (RED por span, gerado pelo Tempo/collector) e otelcol_* (saúde da pipeline).
//    As métricas http_server_* da API não estão sendo emitidas hoje.
//  - Tempo: traces por requisição.
import { writeFileSync } from "node:fs";

const prom = { type: "prometheus", uid: "prometheus" };
const loki = { type: "loki", uid: "loki" };
const tempo = { type: "tempo", uid: "tempo" };
const SVC = "coders-modulo-4-api";
const S = `{service_name="${SVC}"}`;
const REQ = `${S} |= "HTTP request completed"`;
const SM = `service="${SVC}"`;

let id = 0;
let y = 0;
const panels = [];
const row = (title) => {
  panels.push({
    id: ++id,
    type: "row",
    title,
    collapsed: false,
    gridPos: { h: 1, w: 24, x: 0, y },
    panels: [],
  });
  y += 1;
};
// Adiciona uma linha de painéis; cada item tem w (largura) e h (altura, igual para a linha).
const line = (h, items) => {
  let x = 0;
  for (const p of items) {
    const { w, ...rest } = p;
    panels.push({ id: ++id, gridPos: { h, w, x, y }, ...rest });
    x += w;
  }
  y += h;
};

const thr = (...steps) => ({
  mode: "absolute",
  steps: steps.map(([color, value]) => ({ color, value })),
});
const stat = (
  title,
  ds,
  expr,
  { w = 4, unit, decimals, thresholds, description, color } = {},
) => ({
  type: "stat",
  title,
  description,
  datasource: ds,
  w,
  options: {
    reduceOptions: { calcs: ["lastNotNull"] },
    colorMode: color ?? "background",
    graphMode: "none",
    textMode: "value",
  },
  fieldConfig: {
    defaults: {
      unit,
      decimals,
      thresholds: thresholds ?? thr(["blue", null]),
      noValue: "0",
    },
    overrides: [],
  },
  targets: [
    { refId: "A", datasource: ds, queryType: "instant", instant: true, expr },
  ],
});
const ts = (
  title,
  ds,
  targets,
  { w = 12, unit, stack, description, min } = {},
) => ({
  type: "timeseries",
  title,
  description,
  datasource: ds,
  w,
  options: {
    legend: {
      displayMode: "table",
      placement: "bottom",
      calcs: ["lastNotNull", "max"],
    },
    tooltip: { mode: "multi", sort: "desc" },
  },
  fieldConfig: {
    defaults: {
      unit,
      min,
      custom: {
        lineWidth: 2,
        fillOpacity: stack ? 30 : 10,
        showPoints: "never",
        stacking: { mode: stack ? "normal" : "none" },
      },
    },
    overrides: [],
  },
  targets: targets.map((t, i) => ({
    refId: "ABCDEFGH"[i],
    datasource: ds,
    ...t,
  })),
});
const logs = (title, expr, { w = 12 } = {}) => ({
  type: "logs",
  title,
  datasource: loki,
  w,
  options: {
    showTime: true,
    wrapLogMessage: true,
    sortOrder: "Descending",
    enableLogDetails: true,
    prettifyLogMessage: false,
  },
  targets: [{ refId: "A", datasource: loki, expr }],
});
const table = (
  title,
  ds,
  targets,
  { w = 12, transformations = [], overrides = [], unit } = {},
) => ({
  type: "table",
  title,
  datasource: ds,
  w,
  transformations,
  options: { showHeader: true, cellHeight: "sm" },
  fieldConfig: { defaults: { unit, custom: { align: "auto" } }, overrides },
  targets: targets.map((t, i) => ({ refId: "ABCD"[i], datasource: ds, ...t })),
});
const bars = (title, ds, expr, { w = 12, unit, legendFormat } = {}) => ({
  type: "bargauge",
  title,
  datasource: ds,
  w,
  options: {
    orientation: "horizontal",
    displayMode: "gradient",
    reduceOptions: { calcs: ["lastNotNull"] },
    showUnfilled: true,
  },
  fieldConfig: {
    defaults: {
      unit,
      min: 0,
      thresholds: thr(["green", null], ["yellow", 500], ["red", 1000]),
    },
    overrides: [],
  },
  targets: [
    {
      refId: "A",
      datasource: ds,
      queryType: "instant",
      instant: true,
      legendFormat,
      expr,
    },
  ],
});

// ───────────────────────────── 1. Visão geral ─────────────────────────────
row("Visão geral (período selecionado)");
line(4, [
  stat("Requisições", loki, `sum(count_over_time(${REQ} [$__range]))`, {
    w: 4,
    description: "Logs 'HTTP request completed' no período.",
  }),
  stat(
    "Taxa de erro 5xx",
    loki,
    `(sum(count_over_time(${REQ} | statusCode=~"5.." [$__range])) or vector(0)) / sum(count_over_time(${REQ} [$__range]))`,
    {
      w: 4,
      unit: "percentunit",
      decimals: 2,
      thresholds: thr(["green", null], ["yellow", 0.005], ["red", 0.01]),
    },
  ),
  stat(
    "Respostas 4xx",
    loki,
    `sum(count_over_time(${REQ} | statusCode=~"4.." [$__range]))`,
    { w: 4, thresholds: thr(["green", null], ["yellow", 1], ["orange", 50]) },
  ),
  stat(
    "Latência p95",
    loki,
    `max(quantile_over_time(0.95, ${REQ} | unwrap durationMs [$__range]))`,
    {
      w: 4,
      unit: "ms",
      thresholds: thr(["green", null], ["yellow", 500], ["red", 1000]),
    },
  ),
  stat(
    "Warnings + erros (logs)",
    loki,
    `sum(count_over_time(${S} | detected_level=~"warn|error|fatal" [$__range]))`,
    { w: 4, thresholds: thr(["green", null], ["yellow", 1], ["red", 100]) },
  ),
  stat(
    "API enviando telemetria",
    prom,
    `clamp_max(sum(rate(traces_spanmetrics_calls_total{${SM}}[5m])) > bool 0, 1)`,
    {
      w: 4,
      description:
        "1 = a API gerou spans nos últimos 5 min; 0 = sem tráfego/telemetria.",
      thresholds: thr(["red", null], ["green", 1]),
    },
  ),
]);

// ───────────────────────────── 2. Tráfego, erros e latência ─────────────────────────────
row("Tráfego, erros e latência");
line(8, [
  ts(
    "Requisições por status HTTP",
    loki,
    [
      {
        legendFormat: "{{statusCode}}",
        expr: `sum by (statusCode) (count_over_time(${REQ} | statusCode!="" [$__auto]))`,
      },
    ],
    { stack: true, description: "Contagem por intervalo." },
  ),
  ts(
    "Latência da API: p50 / p95 / p99",
    loki,
    [0.5, 0.95, 0.99].map((q) => ({
      legendFormat: `p${q * 100}`,
      expr: `max(quantile_over_time(${q}, ${REQ} | unwrap durationMs [$__auto]))`,
    })),
    { unit: "ms", min: 0 },
  ),
]);
line(8, [
  ts(
    "Requisições por rota",
    loki,
    [
      {
        legendFormat: "{{method}} {{path}}",
        expr: `sum by (method, path) (count_over_time(${REQ} [$__auto]))`,
      },
    ],
    { stack: true },
  ),
  ts(
    "Taxa de erro por rota (4xx/5xx)",
    loki,
    [
      {
        legendFormat: "{{statusCode}} {{path}}",
        expr: `sum by (statusCode, path) (count_over_time(${REQ} | statusCode=~"[45].." [$__auto]))`,
      },
    ],
    { stack: true },
  ),
]);

// ───────────────────────────── 3. Endpoints ─────────────────────────────
row("Endpoints: o que funciona e o que não");
line(9, [
  table(
    "Resumo por rota e status",
    loki,
    [
      {
        queryType: "instant",
        instant: true,
        expr: `sum by (method, path, statusCode) (count_over_time(${REQ} | statusCode!="" [$__range]))`,
      },
    ],
    {
      w: 12,
      transformations: [
        { id: "labelsToFields", options: { mode: "columns" } },
        {
          id: "organize",
          options: {
            excludeByName: { Time: true },
            renameByName: {
              method: "Método",
              path: "Rota",
              statusCode: "Status",
              Value: "Total",
            },
          },
        },
        {
          id: "sortBy",
          options: { fields: {}, sort: [{ field: "Total", desc: true }] },
        },
      ],
      overrides: [
        {
          matcher: { id: "byName", options: "Status" },
          properties: [
            {
              id: "mappings",
              value: [
                {
                  type: "regex",
                  options: { pattern: "5..", result: { color: "red" } },
                },
                {
                  type: "regex",
                  options: { pattern: "4..", result: { color: "orange" } },
                },
                {
                  type: "regex",
                  options: { pattern: "2..", result: { color: "green" } },
                },
              ],
            },
            { id: "custom.cellOptions", value: { type: "color-text" } },
          ],
        },
      ],
    },
  ),
  bars(
    "Rotas mais lentas (p95, ms)",
    loki,
    `topk(10, quantile_over_time(0.95, ${REQ} | unwrap durationMs [$__range]) by (path))`,
    { w: 12, unit: "ms", legendFormat: "{{path}}" },
  ),
]);

// ───────────────────────────── 4. Autenticação ─────────────────────────────
row("Autenticação e eventos de negócio");
line(8, [
  ts(
    "Eventos de auth por resultado (outcome)",
    loki,
    [
      {
        legendFormat: "{{outcome}}",
        expr: `sum by (outcome) (count_over_time(${S} | outcome!="" [$__auto]))`,
      },
    ],
    {
      stack: true,
      description:
        "Ex.: invalid_credentials, ok... Pico de invalid_credentials sugere brute force.",
    },
  ),
  logs(
    "Eventos de auth (sign-up, sign-in, senha, sessão, conta)",
    `${S} |~ "(?i)sign-up|sign-in|conta confirmada|senha|sessão|recuperação"`,
  ),
]);

// ───────────────────────────── 5. Logs ─────────────────────────────
row("Logs");
line(6, [
  ts(
    "Volume de logs por nível",
    loki,
    [
      {
        legendFormat: "{{detected_level}}",
        expr: `sum by (detected_level) (count_over_time(${S} [$__auto]))`,
      },
    ],
    { w: 24, stack: true },
  ),
]);
line(10, [
  logs("Warnings e erros", `${S} | detected_level=~"warn|error|fatal"`),
  logs("Stream completo da API", S),
]);

// ───────────────────────────── 6. Traces ─────────────────────────────
row("Traces (Tempo) e RED por span");
line(8, [
  ts(
    "Taxa de spans por operação (req/s)",
    prom,
    [
      {
        legendFormat: "{{span_name}}",
        expr: `sum by (span_name) (rate(traces_spanmetrics_calls_total{${SM}}[$__rate_interval]))`,
      },
    ],
    { unit: "reqps", stack: true },
  ),
  ts(
    "Spans com erro (req/s)",
    prom,
    [
      {
        legendFormat: "{{span_name}}",
        expr: `sum by (span_name) (rate(traces_spanmetrics_calls_total{${SM},status_code="STATUS_CODE_ERROR"}[$__rate_interval]))`,
      },
    ],
    { unit: "reqps", stack: true },
  ),
]);
line(8, [
  ts(
    "Latência dos spans p50 / p95 / p99",
    prom,
    [0.5, 0.95, 0.99].map((q) => ({
      legendFormat: `p${q * 100}`,
      expr: `histogram_quantile(${q}, sum by (le) (rate(traces_spanmetrics_latency_bucket{${SM}}[$__rate_interval])))`,
    })),
    { unit: "s", min: 0 },
  ),
  table("Traces mais lentos (> 300 ms)", tempo, [
    {
      queryType: "traceql",
      limit: 20,
      tableType: "traces",
      query: `{ resource.service.name = "${SVC}" && duration > 300ms }`,
    },
  ]),
]);
line(8, [
  table(
    "Traces com erro ou status >= 400",
    tempo,
    [
      {
        queryType: "traceql",
        limit: 20,
        tableType: "traces",
        query: `{ resource.service.name = "${SVC}" && (status = error || span.http.response.status_code >= 400) }`,
      },
    ],
    { w: 24 },
  ),
]);

// ───────────────────────────── 7. Alertas ─────────────────────────────
row("Alertas");
line(7, [
  {
    type: "alertlist",
    title: "Alertas do Grafana",
    w: 24,
    options: {
      alertInstanceLabelFilter: "",
      alertName: "",
      dashboardAlerts: false,
      groupBy: [],
      groupMode: "default",
      maxItems: 20,
      sortOrder: 1,
      stateFilter: {
        firing: true,
        pending: true,
        noData: true,
        normal: false,
        error: true,
      },
      viewMode: "list",
    },
  },
]);

// ───────────────────────────── 8. Pipeline de telemetria ─────────────────────────────
row("Saúde da pipeline de telemetria (OpenTelemetry Collector)");
line(4, [
  stat("Collector no ar", prom, `max(up{job="otelcol-contrib"}) or vector(0)`, {
    w: 6,
    thresholds: thr(["red", null], ["green", 1]),
  }),
  stat(
    "Registros recusados/falhos (rate)",
    prom,
    `sum(rate(otelcol_receiver_refused_spans_total[5m]) + rate(otelcol_receiver_failed_spans_total[5m]) + rate(otelcol_receiver_refused_log_records_total[5m]) + rate(otelcol_receiver_failed_log_records_total[5m]) + rate(otelcol_receiver_refused_metric_points_total[5m]) + rate(otelcol_receiver_failed_metric_points_total[5m]))`,
    { w: 6, unit: "ops", thresholds: thr(["green", null], ["red", 0.001]) },
  ),
  stat(
    "Fila do exporter (uso)",
    prom,
    `max(otelcol_exporter_queue_size / otelcol_exporter_queue_capacity)`,
    {
      w: 6,
      unit: "percentunit",
      thresholds: thr(["green", null], ["yellow", 0.5], ["red", 0.9]),
    },
  ),
  stat("Memória do collector", prom, `max(otelcol_process_memory_rss)`, {
    w: 6,
    unit: "bytes",
  }),
]);
line(8, [
  ts(
    "Recebido pelo collector (por sinal)",
    prom,
    [
      {
        legendFormat: "spans",
        expr: `sum(rate(otelcol_receiver_accepted_spans_total[$__rate_interval]))`,
      },
      {
        legendFormat: "logs",
        expr: `sum(rate(otelcol_receiver_accepted_log_records_total[$__rate_interval]))`,
      },
      {
        legendFormat: "métricas",
        expr: `sum(rate(otelcol_receiver_accepted_metric_points_total[$__rate_interval]))`,
      },
    ],
    { unit: "ops" },
  ),
  ts(
    "Recusado / falho no collector",
    prom,
    [
      {
        legendFormat: "spans",
        expr: `sum(rate(otelcol_receiver_refused_spans_total[$__rate_interval]) + rate(otelcol_receiver_failed_spans_total[$__rate_interval]))`,
      },
      {
        legendFormat: "logs",
        expr: `sum(rate(otelcol_receiver_refused_log_records_total[$__rate_interval]) + rate(otelcol_receiver_failed_log_records_total[$__rate_interval]))`,
      },
      {
        legendFormat: "métricas",
        expr: `sum(rate(otelcol_receiver_refused_metric_points_total[$__rate_interval]) + rate(otelcol_receiver_failed_metric_points_total[$__rate_interval]))`,
      },
    ],
    { unit: "ops" },
  ),
]);

const dashboard = {
  uid: "coders-api-overview",
  title: "Coders Módulo 4 — Observabilidade da API",
  description:
    "Tráfego, erros, latência, endpoints, auth, logs, traces, alertas e saúde da telemetria.",
  tags: ["coders-modulo-4", "otel", "api"],
  timezone: "browser",
  schemaVersion: 39,
  version: 1,
  refresh: "30s",
  time: { from: "now-3h", to: "now" },
  editable: true,
  graphTooltip: 1,
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: { type: "grafana", uid: "-- Grafana --" },
        enable: true,
        hide: true,
        iconColor: "rgba(0, 211, 255, 1)",
        name: "Annotations & Alerts",
        type: "dashboard",
      },
    ],
  },
  links: [
    {
      title: "Explore logs",
      type: "link",
      url: "/explore",
      icon: "doc",
      targetBlank: true,
    },
  ],
  panels,
};
writeFileSync(
  new URL("./dashboards/api-overview.json", import.meta.url),
  JSON.stringify(dashboard, null, 2) + "\n",
);
console.log(`ok: ${panels.length} itens`);
