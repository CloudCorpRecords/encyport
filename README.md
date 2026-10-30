# encyport

encyport reads Wikipedia so people and agents do not have to scrape
it. Give it a phrase and it finds matching articles; give it a title
and it hands back the article text, just the lead summary, the section
outline, the pages the article links to, or the coordinates recorded
for the subject — all from the public Wikipedia APIs on
en.wikipedia.org, with nothing to sign up for and no API key.

## Install

```bash
npx @reneturcios/encyport search "analytical engine"
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/encyport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

Every command prints JSON.

```bash
# Search for articles
encyport search Ada Lovelace
encyport search black holes --limit 5

# Read a page four ways, plus its coordinates
encyport article Ada Lovelace
encyport summary Ada Lovelace
encyport sections Ada Lovelace
encyport links Ada Lovelace
encyport coordinates Eiffel Tower

encyport --version
```

Titles and queries may contain spaces; everything after the command
word is joined into one phrase. Exit codes: `0` on success, `1` when
the lookup fails (a missing page or an upstream error, named in the
message), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/encyport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "encyport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/encyport", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `search_wikipedia` | `query` (string, required), `limit` (integer, optional) | Matching articles: title, page id, a cleaned text snippet, word count, and last-revision timestamp for each hit. |
| `get_article` | `title` (string, required) | The full plain-text content of the article. |
| `get_summary` | `title` (string, required) | The lead section of the article as plain text — the part most readers mean by "the summary". |
| `get_sections` | `title` (string, required) | The article's section outline: section number, heading, heading level, and parse index, in document order. |
| `get_links` | `title` (string, required) | Pages this article links to, each with its namespace and whether the target page exists. |
| `get_coordinates` | `title` (string, required) | Latitude/longitude pairs recorded for the page (empty when the subject has none), with the primary coordinate flagged. |

Titles follow redirects, so a common name or an old title still lands
on the current article. A title that does not resolve to a page is
reported as an error rather than returning empty content.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network
npm run dev     # run the CLI from source via tsx
```

The core takes an injectable fetch function, and the test suite drives
it entirely with hand-written payloads shaped like real Wikipedia API
responses — the tests never touch the network.

## License

MIT — see `LICENSE`.
