#!/usr/bin/env node
// Publica uma review de PR do GitHub a partir dos achados do agente `code-reviewer`.
//
// Uso:
//   node post-review.mjs --pr <url> --findings <arquivo.json> [--dry-run]
//
// - Valida cada comentário inline contra as linhas realmente presentes no diff do PR.
//   Comentários que não podem ser ancorados vão para o comentário geral.
// - Calcula o veredito: ao menos um `issue` OU decoração `blocking` => REQUEST_CHANGES;
//   caso contrário => APPROVE. Nunca publica review neutra de propósito.
// - Se o GitHub recusar o veredito (ex.: autor do PR == revisor), republica como COMMENT
//   deixando o veredito explícito no corpo, e avisa no resultado.
//
// Requer a GitHub CLI (`gh`) autenticada. Sem dependências npm.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LABELS = new Set([
  "praise",
  "nitpick",
  "suggestion",
  "issue",
  "todo",
  "question",
  "thought",
  "chore",
  "note",
]);

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--pr") args.pr = argv[++i];
    else if (a === "--findings") args.findings = argv[++i];
    else fail(`Argumento desconhecido: ${a}`);
  }
  if (!args.pr || !args.findings) {
    fail(
      "Uso: post-review.mjs --pr <url> --findings <arquivo.json> [--dry-run]",
    );
  }
  return args;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function gh(args, input) {
  const res = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) fail(`Não foi possível executar o gh: ${res.error.message}`);
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function ghJson(args) {
  const res = gh(args);
  if (!res.ok)
    fail(`gh ${args.join(" ")} falhou:\n${res.stderr || res.stdout}`);
  return JSON.parse(res.stdout);
}

function parsePrUrl(url) {
  const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url ?? "");
  if (!m) fail(`URL de PR inválida: ${url}`);
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

// Linhas comentáveis por arquivo: RIGHT = código novo (+ e contexto), LEFT = removido (- e contexto).
function commentableLines(files) {
  const map = new Map();
  for (const file of files) {
    const right = new Set();
    const left = new Set();
    let oldLine = 0;
    let newLine = 0;
    for (const line of (file.patch ?? "").split("\n")) {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (hunk) {
        oldLine = Number(hunk[1]);
        newLine = Number(hunk[2]);
      } else if (line.startsWith("+")) right.add(newLine++);
      else if (line.startsWith("-")) left.add(oldLine++);
      else if (line.startsWith("\\")) continue;
      else if (oldLine || newLine) {
        right.add(newLine++);
        left.add(oldLine++);
      }
    }
    map.set(file.filename, { right, left });
  }
  return map;
}

function normalize(raw, index) {
  const label = String(raw.label ?? "")
    .toLowerCase()
    .trim();
  if (!LABELS.has(label))
    fail(`Achado #${index + 1}: label inválido "${raw.label}"`);
  const subject = String(raw.subject ?? "").trim();
  if (!subject) fail(`Achado #${index + 1}: subject vazio`);

  const decorations = [
    ...new Set(
      (raw.decorations ?? []).map((d) => String(d).toLowerCase().trim()),
    ),
  ].filter(Boolean);
  const blocking = label === "issue" || decorations.includes("blocking");
  if (label === "issue" && !decorations.includes("blocking"))
    decorations.unshift("blocking");

  return {
    path: raw.path ? String(raw.path) : "",
    line: Number.isInteger(raw.line) ? raw.line : null,
    startLine: Number.isInteger(raw.start_line) ? raw.start_line : null,
    side: raw.side === "LEFT" ? "LEFT" : "RIGHT",
    label,
    decorations,
    subject,
    discussion: String(raw.discussion ?? "").trim(),
    blocking,
  };
}

function formatBody(f) {
  const deco = f.decorations.length ? ` (${f.decorations.join(", ")})` : "";
  const head = `**${f.label}${deco}:** ${f.subject}`;
  return f.discussion ? `${head}\n\n${f.discussion}` : head;
}

function location(f) {
  if (!f.path) return "";
  return f.line ? `\`${f.path}:${f.line}\`` : `\`${f.path}\``;
}

function buildSummary({ verdict, summary, findings, inline, general }) {
  const counts = new Map();
  for (const f of findings) counts.set(f.label, (counts.get(f.label) ?? 0) + 1);
  const blocking = findings.filter((f) => f.blocking);

  const lines = [];
  lines.push(
    verdict === "REQUEST_CHANGES"
      ? "## ❌ Code review — alterações solicitadas"
      : "## ✅ Code review — aprovado",
  );
  lines.push("");
  if (summary) lines.push(summary.trim(), "");

  if (blocking.length) {
    lines.push(`### Pontos bloqueantes (${blocking.length})`, "");
    for (const f of blocking) {
      const loc = location(f);
      lines.push(`- ${loc ? `${loc} — ` : ""}**${f.label}:** ${f.subject}`);
    }
    lines.push("");
  }

  if (findings.length) {
    lines.push(
      "### Resumo dos comentários",
      "",
      "| Label | Qtd |",
      "| --- | ---: |",
    );
    for (const [label, n] of [...counts.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`| \`${label}\` | ${n} |`);
    }
    lines.push(
      "",
      `${inline.length} inline · ${general.length} neste comentário geral`,
      "",
    );
  }

  if (general.length) {
    lines.push("### Comentários gerais", "");
    for (const f of general) {
      const loc = location(f);
      lines.push(
        `- ${loc ? `${loc} — ` : ""}${formatBody(f).replace(/\n\n/g, "\n  ")}`,
      );
    }
    lines.push("");
  }

  lines.push(
    verdict === "REQUEST_CHANGES"
      ? "> Veredito: **request changes** — há ao menos um `issue` ou comentário `blocking`."
      : "> Veredito: **aprovado** — nenhum `issue` nem comentário `blocking`.",
  );
  return lines.join("\n");
}

function submit({ owner, repo, number, payload }) {
  return gh(
    [
      "api",
      "-X",
      "POST",
      `repos/${owner}/${repo}/pulls/${number}/reviews`,
      "--input",
      "-",
    ],
    JSON.stringify(payload),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { owner, repo, number } = parsePrUrl(args.pr);

  let input;
  try {
    input = JSON.parse(readFileSync(args.findings, "utf8"));
  } catch (error) {
    fail(`Não foi possível ler ${args.findings}: ${error.message}`);
  }
  if (input.review_result === "blocked") {
    fail(
      `O agente não conseguiu concluir a análise:\n${input.summary ?? "(sem detalhe)"}`,
    );
  }

  const pr = ghJson(["api", `repos/${owner}/${repo}/pulls/${number}`]);
  if (pr.state !== "open") {
    if (!args.dryRun) fail(`O PR #${number} está ${pr.state}; nada a revisar.`);
    console.error(
      `⚠ O PR #${number} está ${pr.state}; seguindo apenas porque é --dry-run.`,
    );
  }

  const files = [];
  for (let page = 1; ; page++) {
    const batch = ghJson([
      "api",
      `repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
    ]);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  const lines = commentableLines(files);

  const findings = (input.findings ?? []).map(normalize);
  const inline = [];
  const general = [];
  for (const f of findings) {
    const entry = lines.get(f.path);
    const sideSet = entry && (f.side === "LEFT" ? entry.left : entry.right);
    if (!f.path || !f.line || !sideSet || !sideSet.has(f.line)) {
      general.push(f);
      continue;
    }
    const comment = {
      path: f.path,
      line: f.line,
      side: f.side,
      body: formatBody(f),
    };
    if (f.startLine && f.startLine < f.line && sideSet.has(f.startLine)) {
      comment.start_line = f.startLine;
      comment.start_side = f.side;
    }
    inline.push({ finding: f, comment });
  }

  const verdict = findings.some((f) => f.blocking)
    ? "REQUEST_CHANGES"
    : "APPROVE";
  const body = buildSummary({
    verdict,
    summary: input.summary,
    findings,
    inline,
    general,
  });

  const payload = {
    commit_id: pr.head.sha,
    event: verdict,
    body,
    comments: inline.map((i) => i.comment),
  };

  const report = {
    pr: `${owner}/${repo}#${number}`,
    head: pr.head.sha,
    verdict,
    totalFindings: findings.length,
    inline: inline.length,
    general: general.length,
    blocking: findings.filter((f) => f.blocking).length,
  };

  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...report, payload }, null, 2));
    return;
  }

  let res = submit({ owner, repo, number, payload });
  let note = null;

  // Autor do PR não pode aprovar/reprovar o próprio PR: publica como COMMENT, veredito no corpo.
  if (!res.ok && /own pull request/i.test(res.stderr + res.stdout)) {
    note =
      "O GitHub não permite aprovar/solicitar mudanças no próprio PR; publicado como COMMENT com o veredito no corpo.";
    payload.event = "COMMENT";
    payload.body = `> ⚠️ Veredito pretendido: **${verdict}** (não registrado pelo GitHub: o revisor é o autor do PR).\n\n${body}`;
    res = submit({ owner, repo, number, payload });
  }

  // Âncora inline recusada: move todos os comentários para o corpo e tenta de novo.
  if (
    !res.ok &&
    /unprocessable|422/i.test(res.stderr + res.stdout) &&
    payload.comments.length
  ) {
    const moved = findings.filter((f) => inline.some((i) => i.finding === f));
    const allGeneral = [...general, ...moved];
    payload.comments = [];
    payload.body = buildSummary({
      verdict,
      summary: input.summary,
      findings,
      inline: [],
      general: allGeneral,
    });
    if (payload.event === "COMMENT") {
      payload.body = `> ⚠️ Veredito pretendido: **${verdict}** (não registrado pelo GitHub: o revisor é o autor do PR).\n\n${payload.body}`;
    }
    note = `${note ? `${note} ` : ""}O GitHub recusou os comentários inline; todos foram movidos para o comentário geral.`;
    report.inline = 0;
    report.general = allGeneral.length;
    res = submit({ owner, repo, number, payload });
  }

  if (!res.ok) fail(`Falha ao publicar a review:\n${res.stderr || res.stdout}`);

  const posted = JSON.parse(res.stdout);
  console.log(
    JSON.stringify(
      { ...report, postedEvent: payload.event, url: posted.html_url, note },
      null,
      2,
    ),
  );
}

main();
