import { describe, expect, it } from "vitest";

import { BlockedSourceUrlError, InvalidSourceUrlError } from "./source.errors";
import {
  assertPublicAddresses,
  assertPublicHostname,
  extractHtmlContent,
  isBlockedIpAddress,
  normalizeSourceUrl,
  titleForUrl,
} from "./source-url-policy";

describe("normalizeSourceUrl", () => {
  it("remove fragmentos, parâmetros de rastreamento e normaliza o host", () => {
    expect(
      normalizeSourceUrl(
        "  HTTPS://Example.COM:443/docs/guide?utm_source=mail&q=1&fbclid=abc#section  ",
      ),
    ).toBe("https://example.com/docs/guide?q=1");
  });

  it("remove a barra final da raiz", () => {
    expect(normalizeSourceUrl("http://example.com/")).toBe(
      "http://example.com",
    );
  });

  it("recusa esquemas, credenciais e URLs longas", () => {
    expect(() => normalizeSourceUrl("file:///etc/passwd")).toThrow(
      InvalidSourceUrlError,
    );
    expect(() => normalizeSourceUrl("ftp://example.com/a")).toThrow(
      InvalidSourceUrlError,
    );
    expect(() => normalizeSourceUrl("https://user:pass@example.com")).toThrow(
      InvalidSourceUrlError,
    );
    expect(() =>
      normalizeSourceUrl(`https://example.com/${"a".repeat(255)}`),
    ).toThrow(InvalidSourceUrlError);
  });
});

describe("política de SSRF", () => {
  it("bloqueia faixas privadas, loopback, metadados e endereços especiais", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.5",
      "169.254.169.254",
      "192.168.1.1",
      "172.20.0.1",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(true);
    }
  });

  it("aceita endereços públicos", () => {
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
    expect(isBlockedIpAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("rejeita hostnames internos e residuos DNS antes da busca", () => {
    expect(() => assertPublicHostname("localhost")).toThrow(
      BlockedSourceUrlError,
    );
    expect(() => assertPublicHostname("api.cluster.local")).toThrow(
      BlockedSourceUrlError,
    );
    expect(() => assertPublicHostname("metadata.google.internal")).toThrow(
      BlockedSourceUrlError,
    );
    expect(() => assertPublicHostname("127.0.0.1")).toThrow(
      BlockedSourceUrlError,
    );
    expect(() => assertPublicHostname("example.com")).not.toThrow();
  });

  it("exige ao menos um endereço DNS público", () => {
    expect(() => assertPublicAddresses([])).toThrow(BlockedSourceUrlError);
    expect(() => assertPublicAddresses(["8.8.8.8", "10.0.0.1"])).toThrow(
      BlockedSourceUrlError,
    );
    expect(() => assertPublicAddresses(["8.8.8.8"])).not.toThrow();
  });
});

describe("extractHtmlContent", () => {
  it("extrai título e texto sem scripts, estilos ou entidades ativas", () => {
    const page = `
      <html><head><title>Release &amp; Notes</title><style>body{color:red}</style></head>
      <body><h1>Hello</h1><script>alert('x')</script><p>Team &lt;docs&gt; &nbsp; update.</p></body></html>
    `;

    expect(extractHtmlContent(page)).toEqual({
      title: "Release & Notes",
      text: "Hello Team <docs> update.",
    });
  });

  it("não produz texto para uma página vazia", () => {
    expect(
      extractHtmlContent("<html><body><script>x()</script></body></html>").text,
    ).toBe("");
  });

  it("usa host e caminho como título de fallback", () => {
    expect(titleForUrl("https://docs.example.com/api/guide")).toBe("api guide");
    expect(titleForUrl("https://docs.example.com")).toBe("docs.example.com");
  });
});
