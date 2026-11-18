export type FetchedWebPage = {
  /** Final, normalized address after any redirects. */
  url: string;
  title: string;
  text: string;
};

/** Fetches one public page and returns untrusted plain text for indexing. */
export abstract class WebPageFetcherPort {
  abstract fetch(url: string): Promise<FetchedWebPage>;
}
