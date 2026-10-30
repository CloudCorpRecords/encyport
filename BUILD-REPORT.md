# encyport — Build Report

MCP Rebuild 100, Tier A. Clean-room rebuild of the "wikipedia" MCP
server, built from the public tool spec only: tool names, parameters,
and required sets as published in the wikipedia-mcp project's public
documentation, recorded in `harness/fixtures/wikipedia-tools-original.json`
(`_source` states docs-derived, not hand-probed). Local build only —
nothing pushed or published.

Identity: repo `encyport`, npm `@reneturcios/encyport`,
MCP name `io.github.CloudCorpRecords/encyport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `encyport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Search Wikipedia and read articles,
  summaries, sections, links, and coordinates." = **80 chars** (≤100 ✓);
  npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/encyport:0.1.0` carries **no** `version`
  field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT `node /app/dist/cli.js`,
  CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/encyport"`
- `tsconfig.json` (copied unchanged from clockport), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md` (fresh
  text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`search`, `article`, `summary`,
  `sections`, `links`, `coordinates`, `mcp`, `--version`; exit 2
  usage / 1 lookup error), `src/mcp.ts`, `src/types.ts`,
  `src/encyclopedia.ts` (core logic, `VERSION = "0.1.0"`)
- `test/encyclopedia.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (copied from clockport; image name and smoke-test server name changed)

## Implementation notes

- Tools: `search_wikipedia`, `get_article`, `get_summary`,
  `get_sections`, `get_links`, `get_coordinates` — 6/6 from the spec.
- Core talks to the real public Wikipedia APIs on en.wikipedia.org:
  the Action API query endpoint for search, plain-text extracts (full
  article via `prop=extracts`, lead-only via `exintro`), and
  coordinates (`prop=coordinates`); the parse endpoint for sections
  and outgoing links (`prop=sections` / `prop=links`). Titles follow
  redirects; search snippets are returned with markup stripped.
- All network access goes through an injected `FetchFn`
  (pageport/shipcheck pattern). **Behaviour was tested via fake fetch
  only — no live call was made** (VM egress is blocked); tests use
  hand-written JSON payloads shaped like real API responses.
- `src/mcp.ts` uses the SDK's low-level `Server` (zod still validates
  every `tools/call`), serving `tools/list` with the spec's exact
  input schemas — same deviation from the TEMPLATE §2.12 pattern as
  clockport, for the same reason (McpServer injects `$schema` /
  `additionalProperties` keys absent from the spec).

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 12
ℹ pass 12
ℹ fail 0
```
Covers: search parsing + snippet cleaning + limit handling, full
extract vs lead-only summary (exintro flag asserted on the requested
URL), missing-page errors, section outline parsing, link existence
flags, coordinates parsing, empty-coordinates pages, HTTP errors.

### 3. CLI smoke
`--version` -> `0.1.0`; unknown command exits 2 with Usage. (Live CLI
lookups not run — no network; see Implementation notes.)

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/wikipedia-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/encyport/dist/cli.js mcp" \
    --out /home/hatch/workspace/mcp-rebuild-100/builds/encyport/parity-out
verdict=PASS parity_pct=100.0 original_tools=6 rebuild_tools=6 missing=[] extra=[] schema_diffs=[]
(exit 0)
```

## Lockfile status

`package-lock.json` was copied from clockport's and edited with the
file edit tool: top-level `name`, root package `name`, and root
package `bin` key changed clockport -> encyport (dependency ranges are
identical, so the tree is unchanged). **Clean lockfile regen required
before publish** — per TEMPLATE.md §2 item 6, the lockfile must be
regenerated clean (no `node_modules` present) before first publish;
do not publish from this lockfile as-is. `node_modules` in this build
dir is a `cp -a` copy of clockport's (local build only, gitignored).

## Blockers

None for the local build. Notes for the publish wave:
- Regenerate `package-lock.json` clean before first publish (above).
- No live Wikipedia call has been made yet; first live smoke belongs
  to an environment with working egress.
- Container build not exercised locally (no Docker run in this wave);
  the publish-container workflow smoke-tests the image at publish time.

## Publish-gate remediation (2026-10-27)

Recorded under Rene's 2026-10-27 decision ("Remediate the 6: add param
descriptions + capability-class vet policy, then re-gate") and the
standing Wave 2 remediation pattern in `publish/GATE-POLICY.md` /
`PUBLISH-WAVES.md`. This is an authorized deviation from the
parity-faithful state: descriptions were added to every tool
parameter that lacked one (tools: `search_wikipedia`, `get_article`,
`get_summary`, `get_sections`, `get_links`, `get_coordinates`), in the
`src/mcp.ts` schema literals only — parameter names, types and
required lists are unchanged, and no other code was touched.

- Descriptions added: 7 (all served parameters: `search_wikipedia`
  `query` + `limit`, and `title` on each of `get_article`,
  `get_summary`, `get_sections`, `get_links`, `get_coordinates`).
- Rebuild: `npm run build` exit 0; `tsc --noEmit` exit 0; full
  test suite 12/12 pass.
- Parity harness re-run, verbatim: **PARTIAL, parity_pct 50.0** — all
  7 schema diffs are description additions
  (`*.description: present in rebuild but not in original`; 0
  structural diffs). Structural parity proven independently under the
  corrected strip-proof procedure: stripping `description` keys
  from BOTH the post-remediation and pre-remediation tools/list
  deep-equals (strip-both-equal: True); every description present in
  the pre-remediation list is byte-identical in the post-remediation
  list (changed_descriptions: 0, removed_descriptions: 0), and the
  only additions are the 7 at `inputSchema` property paths.
  Adjudication: the description-only diffs are the authorized
  remediation itself; structural parity is unchanged. Full record:
  `publish/parity-remediation/encyport/parity.json`, strip-proof:
  `publish/parity-remediation/encyport/strip-proof.txt` (script:
  `publish/parity-remediation/encyport/strip-proof.py`).
