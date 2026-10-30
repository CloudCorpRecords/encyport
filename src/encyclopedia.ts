/**
 * encyport core: Wikipedia search and page reading over the public
 * Wikipedia APIs (en.wikipedia.org).
 *
 * Two public endpoints cover everything here:
 *  - the Action API query endpoint (/w/api.php?action=query) for search,
 *    plain-text extracts (full article and lead-only), and coordinates;
 *  - the Action API parse endpoint (/w/api.php?action=parse) for the
 *    section outline and the outgoing links of a page.
 *
 * All network access goes through an injected FetchFn, so the parsing
 * logic is fully testable with recorded-style fixtures and no network.
 * Responses are parsed defensively: unknown shapes raise a descriptive
 * error instead of returning partial data.
 */
import type {
  ArticleResult,
  CoordinatesResult,
  FetchFn,
  LinksResult,
  SearchResult,
  SectionsResult,
  SummaryResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const WIKIPEDIA_BASE = "https://en.wikipedia.org";

export const USER_AGENT = "encyport/0.1.0 (MCP server; +https://github.com/CloudCorpRecords/encyport)";

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit)));
}

function requireTitle(title: string): string {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) throw new Error("title is required");
  return t;
}

/** Remove the markup Wikipedia embeds in search snippets. */
export function stripSnippet(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface WikiPage {
  pageid?: number;
  title?: string;
  missing?: unknown;
  extract?: string;
  coordinates?: Array<{ lat: number; lon: number; primary?: unknown; globe?: string }>;
}

async function fetchJson(fetchFn: FetchFn, url: string): Promise<Record<string, unknown>> {
  let response;
  try {
    response = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      redirect: "follow",
    });
  } catch (err) {
    throw new Error(
      `Wikipedia request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Wikipedia request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new Error("Wikipedia request failed: response was not JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("Wikipedia request failed: response was not a JSON object");
  }
  const record = data as Record<string, unknown>;
  const apiError = record.error as { info?: string } | undefined;
  if (apiError) {
    throw new Error(`Wikipedia API error: ${apiError.info ?? "unknown error"}`);
  }
  return record;
}

function apiUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams({ format: "json", origin: "*", ...params });
  return `${WIKIPEDIA_BASE}/w/api.php?${qs.toString()}`;
}

/** First page object of a query response, raising when the page is missing. */
function firstPage(data: Record<string, unknown>, title: string): WikiPage {
  const query = data.query as { pages?: Record<string, WikiPage> } | undefined;
  const pages = query?.pages ? Object.values(query.pages) : [];
  const page = pages[0];
  if (!page || page.missing !== undefined) {
    throw new Error(`Wikipedia page not found: ${title}`);
  }
  return page;
}

export async function searchWikipedia(
  fetchFn: FetchFn,
  query: string,
  limit?: number,
): Promise<SearchResult> {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) throw new Error("query is required");
  const url = apiUrl({
    action: "query",
    list: "search",
    srsearch: q,
    srlimit: String(clampLimit(limit)),
  });
  const data = await fetchJson(fetchFn, url);
  const queryObj = data.query as
    | { search?: Array<Record<string, unknown>> }
    | undefined;
  const hits = Array.isArray(queryObj?.search) ? queryObj.search : [];
  const results = hits.map((h) => ({
    title: String(h.title ?? ""),
    pageid: Number(h.pageid ?? 0),
    snippet: stripSnippet(String(h.snippet ?? "")),
    wordcount: Number(h.wordcount ?? 0),
    timestamp: String(h.timestamp ?? ""),
  }));
  return { query: q, count: results.length, results };
}

async function getExtract(
  fetchFn: FetchFn,
  title: string,
  leadOnly: boolean,
): Promise<{ page: WikiPage; extract: string }> {
  const t = requireTitle(title);
  const params: Record<string, string> = {
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    titles: t,
  };
  if (leadOnly) params.exintro = "1";
  const data = await fetchJson(fetchFn, apiUrl(params));
  const page = firstPage(data, t);
  return { page, extract: page.extract ?? "" };
}

export async function getArticle(fetchFn: FetchFn, title: string): Promise<ArticleResult> {
  const { page, extract } = await getExtract(fetchFn, title, false);
  return { title: page.title ?? title, pageid: page.pageid ?? 0, extract };
}

export async function getSummary(fetchFn: FetchFn, title: string): Promise<SummaryResult> {
  const { page, extract } = await getExtract(fetchFn, title, true);
  return { title: page.title ?? title, pageid: page.pageid ?? 0, summary: extract };
}

export async function getSections(fetchFn: FetchFn, title: string): Promise<SectionsResult> {
  const t = requireTitle(title);
  const url = apiUrl({ action: "parse", page: t, prop: "sections" });
  const data = await fetchJson(fetchFn, url);
  const parse = data.parse as
    | { title?: string; sections?: Array<Record<string, unknown>> }
    | undefined;
  if (!parse) throw new Error(`Wikipedia page not found: ${t}`);
  const raw = Array.isArray(parse.sections) ? parse.sections : [];
  return {
    title: parse.title ?? t,
    sections: raw.map((s) => ({
      number: String(s.number ?? ""),
      line: String(s.line ?? ""),
      level: String(s.level ?? ""),
      index: String(s.index ?? ""),
    })),
  };
}

export async function getLinks(fetchFn: FetchFn, title: string): Promise<LinksResult> {
  const t = requireTitle(title);
  const url = apiUrl({ action: "parse", page: t, prop: "links" });
  const data = await fetchJson(fetchFn, url);
  const parse = data.parse as
    | { title?: string; links?: Array<Record<string, unknown>> }
    | undefined;
  if (!parse) throw new Error(`Wikipedia page not found: ${t}`);
  const raw = Array.isArray(parse.links) ? parse.links : [];
  return {
    title: parse.title ?? t,
    links: raw.map((l) => ({
      title: String(l["*"] ?? ""),
      ns: Number(l.ns ?? 0),
      exists: l.exists !== undefined,
    })),
  };
}

export async function getCoordinates(
  fetchFn: FetchFn,
  title: string,
): Promise<CoordinatesResult> {
  const t = requireTitle(title);
  const url = apiUrl({ action: "query", prop: "coordinates", redirects: "1", titles: t });
  const data = await fetchJson(fetchFn, url);
  const page = firstPage(data, t);
  const raw = Array.isArray(page.coordinates) ? page.coordinates : [];
  return {
    title: page.title ?? t,
    pageid: page.pageid ?? 0,
    coordinates: raw.map((c) => ({
      lat: Number(c.lat),
      lon: Number(c.lon),
      primary: c.primary !== undefined,
      globe: String(c.globe ?? "earth"),
    })),
  };
}
