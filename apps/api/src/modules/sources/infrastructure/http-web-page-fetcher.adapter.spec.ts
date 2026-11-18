import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BlockedSourceUrlError,
  SourceUrlNoTextError,
  SourceUrlTooLargeError,
  SourceUrlUnavailableError,
} from "../domain/source.errors";
import { DEFAULT_SOURCE_URL_FETCH_OPTIONS } from "../domain/source-url-policy";
import { HttpWebPageFetcherAdapter } from "./http-web-page-fetcher.adapter";

type Route = (
  requestUrl: string | undefined,
  respond: (
    status: number,
    body: string,
    type?: string,
    location?: string,
  ) => void,
) => void;

describe("HttpWebPageFetcherAdapter", () => {
  let server: Server;
  let origin: string;
  let route: Route;

  const localOptions = {
    ...DEFAULT_SOURCE_URL_FETCH_OPTIONS,
    allowPrivateHosts: true,
    retries: 0,
  };

  beforeEach(async () => {
    route = (requestUrl, respond) => {
      if (requestUrl === "/redirect") {
        respond(302, "", "text/plain", "/final");
        return;
      }

      if (requestUrl === "/missing") {
        respond(404, "not found", "text/plain");
        return;
      }

      if (requestUrl === "/empty") {
        respond(
          200,
          "<html><body><script>x()</script></body></html>",
          "text/html",
        );
        return;
      }

      if (requestUrl === "/binary") {
        respond(200, "opaque", "application/octet-stream");
        return;
      }

      respond(
        200,
        "<html><head><title>Team &amp; Docs</title></head><body><p>Explicit context.</p><script>secret()</script></body></html>",
        "text/html; charset=utf-8",
      );
    };

    server = createServer((request, response) => {
      route(request.url, (status, body, type = "text/html", location) => {
        if (location !== undefined) response.setHeader("Location", location);
        response.writeHead(status, { "Content-Type": type });
        response.end(body);
      });
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;

    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  });

  it("extrai título e texto de uma página pública simulada", async () => {
    const page = await new HttpWebPageFetcherAdapter(localOptions).fetch(
      `${origin}/docs/guide`,
    );

    expect(page.title).toBe("Team & Docs");
    expect(page.text).toBe("Explicit context.");
    expect(page.url).toContain("/docs/guide");
  });

  it("segue redirecionamento dentro do limite seguro", async () => {
    const page = await new HttpWebPageFetcherAdapter(localOptions).fetch(
      `${origin}/redirect`,
    );

    expect(page.text).toBe("Explicit context.");
    expect(page.url).toContain("/final");
  });

  it("recusa página inacessível, sem texto e binária", async () => {
    const fetcher = new HttpWebPageFetcherAdapter(localOptions);

    await expect(fetcher.fetch(`${origin}/missing`)).rejects.toBeInstanceOf(
      SourceUrlUnavailableError,
    );
    await expect(fetcher.fetch(`${origin}/empty`)).rejects.toBeInstanceOf(
      SourceUrlNoTextError,
    );
    await expect(fetcher.fetch(`${origin}/binary`)).rejects.toBeInstanceOf(
      SourceUrlNoTextError,
    );
  });

  it("Interrompe respostas acima do limite configurado", async () => {
    const fetcher = new HttpWebPageFetcherAdapter({
      ...localOptions,
      maxBytes: 16,
    });

    await expect(fetcher.fetch(`${origin}/large`)).rejects.toBeInstanceOf(
      SourceUrlTooLargeError,
    );
  });

  it("bloqueia endereços internos antes de conectar", async () => {
    const fetcher = new HttpWebPageFetcherAdapter(
      DEFAULT_SOURCE_URL_FETCH_OPTIONS,
    );

    await expect(fetcher.fetch(`${origin}/docs`)).rejects.toBeInstanceOf(
      BlockedSourceUrlError,
    );
  });
});
