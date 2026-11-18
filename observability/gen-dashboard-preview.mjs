// Structural preview of the provisioned Grafana dashboard.
// Reads the versioned JSON and writes a self-contained SVG. No data source,
// Docker service or third-party dependency is required.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "dashboards/api-overview.json");
const target = resolve(here, "dashboard-preview.svg");

const dashboard = JSON.parse(readFileSync(source, "utf8"));

const escapeXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const sourceOf = (panel) =>
  panel.datasource?.type ?? panel.targets?.[0]?.datasource?.type ?? "—";
const queryCount = (panel) => panel.targets?.length ?? 0;

const rows = [];
let currentRow = null;
for (const panel of dashboard.panels) {
  if (panel.type === "row") {
    currentRow = { title: panel.title, panels: [] };
    rows.push(currentRow);
    continue;
  }
  currentRow ??= { title: "Sem row", panels: [] };
  currentRow.panels.push(panel);
}

const visualizations = dashboard.panels.filter((panel) => panel.type !== "row");
const totalQueries = visualizations.reduce(
  (sum, panel) => sum + queryCount(panel),
  0,
);
const bySource = visualizations.reduce((counts, panel) => {
  const sourceName = sourceOf(panel);
  counts[sourceName] = (counts[sourceName] ?? 0) + 1;
  return counts;
}, {});

const colors = {
  loki: { fill: "#e8f1ff", stroke: "#3b82f6", text: "#1d4ed8" },
  prometheus: { fill: "#fff0e6", stroke: "#f97316", text: "#9a3412" },
  tempo: { fill: "#f3e8ff", stroke: "#a855f7", text: "#6b21a8" },
  "—": { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569" },
};

const width = 1200;
const margin = 32;
const cardWidth = (width - margin * 2 - 16) / 2;
const cardHeight = 46;
const cardGap = 8;
const parts = [];

let y = 24;
parts.push(
  `<rect x="0" y="0" width="${width}" height="100%" fill="#ffffff"/>`,
  `<text x="${margin}" y="${y + 26}" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#0f172a">API Overview — estrutura do dashboard</text>`,
  `<text x="${margin}" y="${y + 50}" font-family="system-ui, sans-serif" font-size="13" fill="#475569">UID ${escapeXml(dashboard.uid)} · refresh ${escapeXml(dashboard.refresh)} · janela ${escapeXml(dashboard.time?.from)} → ${escapeXml(dashboard.time?.to)}</text>`,
  `<rect x="${margin}" y="${y + 66}" width="${width - margin * 2}" height="34" rx="6" fill="#fff7ed" stroke="#fdba74"/>`,
  `<text x="${margin + 12}" y="${y + 88}" font-family="system-ui, sans-serif" font-size="12" fill="#9a3412">Representação da estrutura versionada — NÃO são dados reais de produção. Fonte: observability/dashboards/api-overview.json</text>`,
);
y += 124;

const metrics = [
  [`${rows.length}`, "rows"],
  [`${visualizations.length}`, "visualizações"],
  [`${totalQueries}`, "queries"],
  [
    `${bySource.loki ?? 0} Loki · ${bySource.prometheus ?? 0} Prometheus · ${bySource.tempo ?? 0} Tempo`,
    "painéis por fonte",
  ],
];
const metricWidth = (width - margin * 2 - 24) / metrics.length;
metrics.forEach(([value, label], index) => {
  const x = margin + index * (metricWidth + 8);
  parts.push(
    `<rect x="${x}" y="${y}" width="${metricWidth}" height="58" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>`,
    `<text x="${x + 12}" y="${y + 26}" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#0f172a">${escapeXml(value)}</text>`,
    `<text x="${x + 12}" y="${y + 46}" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">${escapeXml(label)}</text>`,
  );
});
y += 82;

for (const [rowIndex, row] of rows.entries()) {
  const columns = Math.max(1, Math.ceil(row.panels.length / 2));
  const blockHeight = 40 + columns * (cardHeight + cardGap) + 12;
  parts.push(
    `<rect x="${margin}" y="${y}" width="${width - margin * 2}" height="${blockHeight}" rx="8" fill="#fbfdff" stroke="#dbeafe"/>`,
    `<text x="${margin + 14}" y="${y + 25}" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#1e3a8a">${rowIndex + 1}. ${escapeXml(row.title)}</text>`,
    `<text x="${width - margin - 14}" y="${y + 25}" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">${row.panels.length} ${row.panels.length === 1 ? "painel" : "painéis"}</text>`,
  );

  row.panels.forEach((panel, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const x = margin + 14 + column * (cardWidth + 8);
    const py = y + 38 + line * (cardHeight + cardGap);
    const sourceName = sourceOf(panel);
    const palette = colors[sourceName] ?? colors["—"];
    const label = escapeXml(
      panel.title.length > 52 ? `${panel.title.slice(0, 51)}…` : panel.title,
    );
    const queries = queryCount(panel);
    const detail = `${panel.type} · ${sourceName} · ${queries} ${queries === 1 ? "query" : "queries"}`;
    parts.push(
      `<rect x="${x}" y="${py}" width="${cardWidth - 14}" height="${cardHeight}" rx="5" fill="${palette.fill}" stroke="${palette.stroke}"/>`,
      `<text x="${x + 10}" y="${py + 19}" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#0f172a">${label}</text>`,
      `<text x="${x + 10}" y="${py + 36}" font-family="system-ui, sans-serif" font-size="10" fill="${palette.text}">${escapeXml(detail)}</text>`,
    );
  });

  y += blockHeight + 12;
}

parts.push(
  `<text x="${margin}" y="${y + 8}" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Gerado por observability/gen-dashboard-preview.mjs — execute bun observability/gen-dashboard-preview.mjs para atualizar.</text>`,
);

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + 28}" viewBox="0 0 ${width} ${y + 28}" role="img" aria-label="Prévia estrutural do dashboard API Overview">`,
  `<title>API Overview — estrutura do dashboard (não dados de produção)</title>`,
  ...parts,
  `</svg>`,
  "",
].join("\n");

writeFileSync(target, svg, "utf8");
console.log(
  `prévia gerada: observability/dashboard-preview.svg (${rows.length} rows, ${visualizations.length} painéis, ${totalQueries} queries)`,
);
