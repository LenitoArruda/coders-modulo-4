import { WebPageFetcherPort } from "../../modules/sources/application/ports/web-page-fetcher.port";
import type { FetchedWebPage } from "../../modules/sources/application/ports/web-page-fetcher.port";
import { assertPublicHostname } from "../../modules/sources/domain/source-url-policy";
import type { SourceError } from "../../modules/sources/domain/source.errors";
import { SourceUrlNoTextError } from "../../modules/sources/domain/source.errors";

/** Deterministic page source used by use-case and HTTP integration tests. */
export class FakeWebPageFetcher extends WebPageFetcherPort {
  readonly pages = new Map<string, FetchedWebPage>();
  readonly failures = new Map<string, SourceError>();
  readonly fetched: string[] = [];

  override async fetch(url: string): Promise<FetchedWebPage> {
    this.fetched.push(url);
    assertPublicHostname(new URL(url).hostname);

    const failure = this.failures.get(url);

    if (failure !== undefined) throw failure;

    const page = this.pages.get(url);

    if (page === undefined) throw new SourceUrlNoTextError();

    return page;
  }
}
