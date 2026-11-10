import { describe, expect, it } from "vitest";

import { escapeHtml, renderEmailLayout } from "./email-layout";

const html = renderEmailLayout({
  title: "Reset your password",
  preheader: "Use this link to choose a new password.",
  greeting: "Hi Ada,",
  blocks: [
    { type: "paragraph", text: "We received a request." },
    { type: "details", items: [{ label: "When", value: "November 10" }] },
    {
      type: "action",
      label: "Reset your password",
      url: "http://x.test/?a=1&b=2",
    },
    { type: "note", text: "You can ignore this." },
  ],
});

describe("renderEmailLayout", () => {
  it("deve gerar um documento light-only e responsivo", () => {
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('content="light only"');
    expect(html).not.toContain("prefers-color-scheme");
    expect(html).toContain("max-width:560px");
  });

  it("deve usar a paleta do design system com texto grafite sobre o botão pastel", () => {
    expect(html).toContain("#A0C4E2");
    expect(html).toContain("#171717");
    expect(html).not.toMatch(/(?<![-\w])color:#fff(fff)?[;"]/i);
  });

  it("deve renderizar título, preheader, saudação e blocos", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("Use this link to choose a new password.");
    expect(html).toContain("Hi Ada,");
    expect(html).toContain("We received a request.");
    expect(html).toContain("November 10");
    expect(html).toContain("You can ignore this.");
  });

  it("deve renderizar o botão e o link de fallback com a URL escapada", () => {
    const href = 'href="http://x.test/?a=1&amp;b=2"';

    expect(html.split(href)).toHaveLength(3);
    expect(html).toContain("copy and paste this link");
  });

  it("deve escapar HTML em qualquer texto recebido", () => {
    const unsafe = renderEmailLayout({
      title: "<b>t</b>",
      preheader: "<i>p</i>",
      greeting: "Hi <script>,",
      blocks: [{ type: "note", text: "<img src=x>" }],
    });

    expect(unsafe).not.toContain("<script>");
    expect(unsafe).not.toContain("<img");
    expect(unsafe).not.toContain("<b>t</b>");
    expect(unsafe).toContain("&lt;script&gt;");
  });
});

describe("escapeHtml", () => {
  it("deve escapar os caracteres especiais", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });
});
