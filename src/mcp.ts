/**
 * encyport MCP server. Tools: search_wikipedia, get_article, get_summary,
 * get_sections, get_links, get_coordinates.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas, while zod still
 * validates every tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const SearchArgs = z.object({
  query: z.string(),
  limit: z.number().int().optional(),
});

const TitleArgs = z.object({
  title: z.string(),
});

const TOOLS = [
  {
    name: "search_wikipedia",
    description: "Search Wikipedia articles by query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search text to match against Wikipedia article titles and content.",
        },
        limit: {
          type: "integer",
          description:
            "Maximum number of search results to return (optional; defaults to 10, clamped to 1-50).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_article",
    description: "Get the full plain-text content of a Wikipedia article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The title of the Wikipedia article to retrieve in full.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_summary",
    description: "Get a summary of a Wikipedia article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The title of the Wikipedia article to get the lead summary of.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_sections",
    description: "Get the sections of a Wikipedia article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The title of the Wikipedia article to get the section outline of.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_links",
    description: "Get the outgoing links of a Wikipedia article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The title of the Wikipedia article to get the outgoing links of.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_coordinates",
    description: "Get the geographic coordinates of a Wikipedia article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description:
            "The title of the Wikipedia article to get the geographic coordinates of.",
        },
      },
      required: ["title"],
    },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const fetchFn = globalThis.fetch as unknown as FetchFn;

const server = new Server(
  { name: "encyport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "search_wikipedia") {
      const parsed = SearchArgs.parse(args ?? {});
      return textResult(await searchWikipedia(fetchFn, parsed.query, parsed.limit));
    }
    if (name === "get_article") {
      const parsed = TitleArgs.parse(args ?? {});
      return textResult(await getArticle(fetchFn, parsed.title));
    }
    if (name === "get_summary") {
      const parsed = TitleArgs.parse(args ?? {});
      return textResult(await getSummary(fetchFn, parsed.title));
    }
    if (name === "get_sections") {
      const parsed = TitleArgs.parse(args ?? {});
      return textResult(await getSections(fetchFn, parsed.title));
    }
    if (name === "get_links") {
      const parsed = TitleArgs.parse(args ?? {});
      return textResult(await getLinks(fetchFn, parsed.title));
    }
    if (name === "get_coordinates") {
      const parsed = TitleArgs.parse(args ?? {});
      return textResult(await getCoordinates(fetchFn, parsed.title));
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
