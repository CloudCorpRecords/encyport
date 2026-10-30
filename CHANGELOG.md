# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `encyport search <query...> [--limit n]` searches Wikipedia;
  `encyport article|summary|sections|links|coordinates <title...>`
  reads a page five ways. All commands print JSON.
- MCP server (`encyport mcp`, stdio) with six tools:
  `search_wikipedia`, `get_article`, `get_summary`, `get_sections`,
  `get_links`, and `get_coordinates`.
- Built on the public Wikipedia Action API (query and parse
  endpoints); titles follow redirects, and search snippets are
  returned with their markup stripped.
- Core logic takes an injectable fetch function, so the whole tool is
  testable offline against fixture payloads.
