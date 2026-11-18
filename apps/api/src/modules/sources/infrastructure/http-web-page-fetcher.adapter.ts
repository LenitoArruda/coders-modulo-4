import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { Inject, Injectable } from "@nestjs/common";

import { WebPageFetcherPort } from "../application/ports/web-page-fetcher.port";
import type { FetchedWebPage } from "../application/ports/web-page-fetcher.port";
import {
  assertPublicAddresses,
  assertPublicHostname,
  DEFAULT_SOURCE_URL_FETCH_OPTIONS,
  extractHtmlContent,
  normalizeSourceUrl,
  titleForUrl,
  type SourceUrlFetchOptions,
} from "../domain/source-url-policy";
import {
  BlockedSourceUrlError,
  SourceUrlNoTextError,
  SourceUrlTooLargeError,
  SourceUrlUnavailableError,
} from "../domain/source.errors";
import { SOURCE_URL_FETCH_OPTIONS } from "../sources.tokens";

type FetchOutcome =
  | { kind: "page"; page: FetchedWebPage }
  | { kind: "redirect"; location: string }
  | { kind: "retry" }
  | { kind: "unavailable" }
  | { kind: "tooLarge" }
  | { kind: "noText" };

const TEXT_CONTENT_TYPE = /^(text\/|application\/(xhtml\+xml|xml|json))/i;

/**
 * HTTP fetcher with manual redirects and SSRF checks on every hop. The socket
 * connects to the resolved address with the original Host/SNI to reduce DNS
 * rebinding exposure. URLs and page text are never logged.
 */
@Injectable()
export class HttpWebPageFetcherAdapter extends WebPageFetcherPort {
  constructor(
    @Inject(SOURCE_URL_FETCH_OPTIONS)
    private readonly options: SourceUrlFetchOptions = DEFAULT_SOURCE_URL_FETCH_OPTIONS,
  ) {
    super();
  }

  async fetch(rawUrl: string): Promise<FetchedWebPage> {
    let current = normalizeSourceUrl(rawUrl);

    for (let hop = 0; hop <= this.options.maxRedirects; hop += 1) {
      const outcome = await this.fetchOnce(current);

      if (outcome.kind === "page") return outcome.page;
      if (outcome.kind !== "redirect") throw this.publicError(outcome);

      let target: URL;

      try {
        target = new URL(outcome.location, current);
      } catch {
        throw new SourceUrlUnavailableError();
      }

      if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new BlockedSourceUrlError();
      }

      current = normalizeSourceUrl(target.toString());
    }

    throw new SourceUrlUnavailableError();
  }

  private publicError(
    outcome: Exclude<FetchOutcome, { kind: "page" } | { kind: "redirect" }>,
  ): Error {
    if (outcome.kind === "tooLarge") return new SourceUrlTooLargeError();
    if (outcome.kind === "noText") return new SourceUrlNoTextError();

    return new SourceUrlUnavailableError();
  }

  private async fetchOnce(url: string): Promise<FetchOutcome> {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

    if (!this.options.allowPrivateHosts) assertPublicHostname(hostname);

    let addresses: string[];

    if (isIP(hostname) !== 0) {
      addresses = [hostname];
    } else {
      try {
        addresses = (await lookup(hostname, { all: true })).map(
          (answer) => answer.address,
        );
      } catch {
        return { kind: "unavailable" };
      }
    }

    if (!this.options.allowPrivateHosts) assertPublicAddresses(addresses);

    const address =
      addresses.find((candidate) => isIP(candidate) === 4) ?? addresses[0];

    if (address === undefined) return { kind: "unavailable" };

    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      const outcome = await this.requestAddress(parsed, hostname, address);

      if (outcome.kind !== "retry" || attempt === this.options.retries) {
        return outcome;
      }
    }

    return { kind: "unavailable" };
  }

  private requestAddress(
    parsed: URL,
    hostname: string,
    address: string,
  ): Promise<FetchOutcome> {
    const transport = parsed.protocol === "https:" ? httpsRequest : httpRequest;
    const port =
      parsed.port === ""
        ? parsed.protocol === "https:"
          ? 443
          : 80
        : Number(parsed.port);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (outcome: FetchOutcome): void => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };

      const requestOptions: RequestOptions = {
        host: address,
        port,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        servername: isIP(hostname) === 0 ? hostname : undefined,
        signal: AbortSignal.timeout(this.options.timeoutMs),
        headers: {
          Host: parsed.host,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
          "Cache-Control": "no-cache",
          Connection: "close",
          "User-Agent": "CodersKnowledgeBot/1.0",
        },
      };

      const request = transport(requestOptions, (response) => {
        const status = response.statusCode ?? 0;

        if (status >= 300 && status < 400) {
          const location = response.headers.location;

          response.resume();
          finish(
            typeof location === "string"
              ? { kind: "redirect", location }
              : { kind: "unavailable" },
          );
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          finish({
            kind: status >= 500 || status === 429 ? "retry" : "unavailable",
          });
          return;
        }

        const contentType = String(response.headers["content-type"] ?? "");

        if (!TEXT_CONTENT_TYPE.test(contentType)) {
          response.resume();
          finish({ kind: "noText" });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;

        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;

          if (size > this.options.maxBytes) {
            response.destroy();
            finish({ kind: "tooLarge" });
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () => {
          const { title, text } = extractHtmlContent(
            Buffer.concat(chunks).toString("utf8"),
          );

          finish(
            text === ""
              ? { kind: "noText" }
              : {
                  kind: "page",
                  page: {
                    url: parsed.toString(),
                    title:
                      title === "" ? titleForUrl(parsed.toString()) : title,
                    text,
                  },
                },
          );
        });
        response.on("error", () => finish({ kind: "retry" }));
      });

      request.on("error", () => finish({ kind: "retry" }));
      request.end();
    });
  }
}
