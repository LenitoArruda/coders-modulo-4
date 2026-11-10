/**
 * Shared HTML shell for transactional email, following .docs/DESIGN.md:
 * light-only, brand palette, graphite text on pastel surfaces, one primary
 * action, 8px controls and a 12px card. Email clients ignore external CSS and
 * most modern layout, so the markup is table based with inline styles.
 *
 * Every string passed in is plain text and is escaped here; callers never build
 * HTML themselves.
 */

const COLOR = {
  page: "#CFE8EF",
  card: "#FFFFFF",
  border: "#AED1E6",
  primary: "#A0C4E2",
  foreground: "#171717",
  muted: "#52525B",
} as const;

const FONT_STACK =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailBlock =
  | { type: "paragraph"; text: string }
  /** Smaller, muted text for caveats such as "ignore this message". */
  | { type: "note"; text: string }
  | { type: "details"; items: { label: string; value: string }[] }
  /** The single primary action. Also renders a copy-and-paste fallback link. */
  | { type: "action"; label: string; url: string };

export type EmailLayoutInput = {
  /** Used as the document title and the heading of the card. */
  title: string;
  /** Inbox preview text, hidden in the body. */
  preheader: string;
  greeting: string;
  blocks: EmailBlock[];
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${COLOR.foreground};">${escapeHtml(text)}</p>`;
}

function note(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:20px;color:${COLOR.muted};">${escapeHtml(text)}</p>`;
}

function details(items: { label: string; value: string }[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:0;font-size:14px;line-height:20px;color:${COLOR.muted};">${escapeHtml(item.label)}</td></tr>
<tr><td style="padding:0 0 8px;font-size:16px;line-height:24px;font-weight:600;color:${COLOR.foreground};">${escapeHtml(item.value)}</td></tr>`,
    )
    .join("\n");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
<tr><td bgcolor="${COLOR.page}" style="padding:16px 16px 8px;background-color:${COLOR.page};border:1px solid ${COLOR.border};border-radius:8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>
</td></tr>
</table>`;
}

function action(label: string, url: string): string {
  const href = escapeHtml(url);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="${COLOR.primary}" style="background-color:${COLOR.primary};border-radius:8px;">
<a href="${href}" target="_blank" style="display:inline-block;min-height:20px;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:600;color:${COLOR.foreground};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:14px;line-height:20px;color:${COLOR.muted};">If the button does not work, copy and paste this link into your browser:<br /><a href="${href}" target="_blank" style="color:${COLOR.foreground};text-decoration:underline;word-break:break-all;">${href}</a></p>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "paragraph":
      return paragraph(block.text);
    case "note":
      return note(block.text);
    case "details":
      return details(block.items);
    case "action":
      return action(block.label, block.url);
  }
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const body = input.blocks.map(renderBlock).join("\n");

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.page};font-family:${FONT_STACK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.page};font-size:1px;line-height:1px;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.page}" style="background-color:${COLOR.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 16px;font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:700;color:${COLOR.foreground};">Experts</td></tr>
<tr><td bgcolor="${COLOR.card}" style="background-color:${COLOR.card};border:1px solid ${COLOR.border};border-top:4px solid ${COLOR.primary};border-radius:12px;padding:32px 24px;font-family:${FONT_STACK};">
<h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:${COLOR.foreground};">${escapeHtml(input.title)}</h1>
${paragraph(input.greeting)}
${body}
</td></tr>
<tr><td style="padding:16px 8px 0;font-family:${FONT_STACK};font-size:12px;line-height:16px;color:${COLOR.muted};">You are receiving this email because of activity on your Experts account.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
