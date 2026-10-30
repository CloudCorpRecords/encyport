#!/usr/bin/env node
/**
 * encyport CLI.
 *
 *   encyport search <query...> [--limit n]
 *   encyport article <title...>
 *   encyport summary <title...>
 *   encyport sections <title...>
 *   encyport links <title...>
 *   encyport coordinates <title...>
 *   encyport mcp
 *
 * Results print as JSON. Exit codes: 0 success, 1 lookup error,
 * 2 usage error.
 */
import {
  getArticle,
  getCoordinates,
  getLinks,
  getSections,
  getSummary,
  searchWikipedia,
  VERSION,
} from "./encyclopedia.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  encyport search <query...> [--limit n]
  encyport article <title...>
  encyport summary <title...>
  encyport sections <title...>
  encyport links <title...>
  encyport coordinates <title...>
  encyport mcp
  encyport --version`);
  process.exit(2);
}

function limitFlag(args: string[]): number | undefined {
  const idx = args.indexOf("--limit");
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  const value = Number.parseInt(args[idx + 1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function positionalText(args: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") i++;
    else out.push(args[i]);
  }
  return out.join(" ").trim();
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    let result: unknown;
    if (cmd === "search") {
      const query = positionalText(rest);
      if (!query) usage();
      result = await searchWikipedia(fetchFn, query, limitFlag(rest));
    } else if (cmd === "article") {
      const title = positionalText(rest);
      if (!title) usage();
      result = await getArticle(fetchFn, title);
    } else if (cmd === "summary") {
      const title = positionalText(rest);
      if (!title) usage();
      result = await getSummary(fetchFn, title);
    } else if (cmd === "sections") {
      const title = positionalText(rest);
      if (!title) usage();
      result = await getSections(fetchFn, title);
    } else if (cmd === "links") {
      const title = positionalText(rest);
      if (!title) usage();
      result = await getLinks(fetchFn, title);
    } else if (cmd === "coordinates") {
      const title = positionalText(rest);
      if (!title) usage();
      result = await getCoordinates(fetchFn, title);
    } else {
      usage();
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
