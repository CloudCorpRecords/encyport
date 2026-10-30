/**
 * encyport types.
 *
 * Every operation talks to the public Wikipedia APIs and returns plain,
 * already-parsed data: search hits with cleaned snippets, article text,
 * a lead-section summary, a section outline, outgoing links, and the
 * geographic coordinates recorded for a page.
 */

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string>; redirect?: string },
) => Promise<HttpResponse>;

export interface SearchHit {
  title: string;
  pageid: number;
  /** Search snippet with markup removed. */
  snippet: string;
  wordcount: number;
  /** ISO 8601 timestamp of the last revision, as reported by the API. */
  timestamp: string;
}

export interface SearchResult {
  query: string;
  count: number;
  results: SearchHit[];
}

export interface ArticleResult {
  title: string;
  pageid: number;
  /** Full plain-text extract of the article. */
  extract: string;
}

export interface SummaryResult {
  title: string;
  pageid: number;
  /** Plain-text extract of the lead section only. */
  summary: string;
}

export interface SectionEntry {
  number: string;
  line: string;
  level: string;
  index: string;
}

export interface SectionsResult {
  title: string;
  sections: SectionEntry[];
}

export interface LinkEntry {
  title: string;
  ns: number;
  exists: boolean;
}

export interface LinksResult {
  title: string;
  links: LinkEntry[];
}

export interface CoordinateEntry {
  lat: number;
  lon: number;
  primary: boolean;
  globe: string;
}

export interface CoordinatesResult {
  title: string;
  pageid: number;
  coordinates: CoordinateEntry[];
}
