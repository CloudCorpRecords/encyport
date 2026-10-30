import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getArticle,
  getCoordinates,
  getLinks,
  getSections,
  getSummary,
  searchWikipedia,
  stripSnippet,
} from "../src/encyclopedia.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

/** Build a fake fetch that records the requested URL and returns fixed JSON. */
function fakeFetch(payload: unknown, seen?: string[]): FetchFn {
  return async (url: string) => {
    seen?.push(url);
    const body = JSON.stringify(payload);
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => body,
    } satisfies HttpResponse;
  };
}

function failingFetch(status: number): FetchFn {
  return async () => ({
    ok: false,
    status,
    statusText: "Error",
    headers: { get: () => null },
    text: async () => "",
  });
}

const SEARCH_PAYLOAD = {
  batchcomplete: "",
  query: {
    searchinfo: { totalhits: 2 },
    search: [
      {
        ns: 0,
        title: "Ada Lovelace",
        pageid: 984,
        size: 51234,
        wordcount: 6900,
        snippet:
          '<span class="searchmatch">Ada Lovelace</span> was an English mathematician &amp; writer.',
        timestamp: "2026-09-14T10:22:31Z",
      },
      {
        ns: 0,
        title: "Lovelace (crater)",
        pageid: 31122,
        size: 2100,
        wordcount: 240,
        snippet: "Lovelace is a lunar crater.",
        timestamp: "2025-03-02T08:00:00Z",
      },
    ],
  },
};

const EXTRACT_PAYLOAD = {
  batchcomplete: "",
  query: {
    normalized: [{ from: "ada lovelace", to: "Ada lovelace" }],
    redirects: [{ from: "Ada lovelace", to: "Ada Lovelace" }],
    pages: {
      "984": {
        pageid: 984,
        ns: 0,
        title: "Ada Lovelace",
        extract: "Augusta Ada King, Countess of Lovelace, was an English mathematician.",
      },
    },
  },
};

const MISSING_PAYLOAD = {
  batchcomplete: "",
  query: {
    pages: { "-1": { ns: 0, title: "No Such Page Xyz", missing: "" } },
  },
};

const SECTIONS_PAYLOAD = {
  parse: {
    title: "Ada Lovelace",
    pageid: 984,
    sections: [
      { toclevel: 1, level: "2", line: "Early life", number: "1", index: "1", byteoffset: 120 },
      { toclevel: 1, level: "2", line: "Work on the Analytical Engine", number: "2", index: "2", byteoffset: 3400 },
      { toclevel: 2, level: "3", line: "Note G", number: "2.1", index: "3", byteoffset: 4100 },
    ],
  },
};

const LINKS_PAYLOAD = {
  parse: {
    title: "Ada Lovelace",
    pageid: 984,
    links: [
      { ns: 0, exists: "", "*": "Charles Babbage" },
      { ns: 0, "*": "Analytical engine" },
      { ns: 104, exists: "", "*": "Ada (programming language)" },
    ],
  },
};

const COORDS_PAYLOAD = {
  batchcomplete: "",
  query: {
    pages: {
      "2137": {
        pageid: 2137,
        ns: 0,
        title: "Eiffel Tower",
        coordinates: [{ lat: 48.8584, lon: 2.2945, primary: "", globe: "earth" }],
      },
    },
  },
};

const NO_COORDS_PAYLOAD = {
  batchcomplete: "",
  query: { pages: { "984": { pageid: 984, ns: 0, title: "Ada Lovelace" } } },
};

describe("stripSnippet", () => {
  it("removes markup and decodes entities", () => {
    assert.equal(
      stripSnippet('<span class="searchmatch">Tom &amp; Jerry</span> &quot;cartoon&quot;'),
      'Tom & Jerry "cartoon"',
    );
  });
});

describe("searchWikipedia", () => {
  it("parses search hits and cleans snippets", async () => {
    const seen: string[] = [];
    const r = await searchWikipedia(fakeFetch(SEARCH_PAYLOAD, seen), "Ada Lovelace", 5);
    assert.equal(r.query, "Ada Lovelace");
    assert.equal(r.count, 2);
    assert.equal(r.results[0].title, "Ada Lovelace");
    assert.equal(r.results[0].pageid, 984);
    assert.equal(r.results[0].snippet, "Ada Lovelace was an English mathematician & writer.");
    assert.equal(r.results[0].wordcount, 6900);
    assert.ok(seen[0].includes("action=query"));
    assert.ok(seen[0].includes("list=search"));
    assert.ok(seen[0].includes("srlimit=5"));
  });

  it("uses the default limit when none is given", async () => {
    const seen: string[] = [];
    await searchWikipedia(fakeFetch(SEARCH_PAYLOAD, seen), "test");
    assert.ok(seen[0].includes("srlimit=10"));
  });

  it("rejects an empty query and surfaces HTTP errors", async () => {
    await assert.rejects(searchWikipedia(fakeFetch(SEARCH_PAYLOAD), "  "), /query is required/);
    await assert.rejects(searchWikipedia(failingFetch(503), "x"), /HTTP 503/);
  });
});

describe("getArticle and getSummary", () => {
  it("parses a full-article extract", async () => {
    const seen: string[] = [];
    const r = await getArticle(fakeFetch(EXTRACT_PAYLOAD, seen), "Ada Lovelace");
    assert.equal(r.title, "Ada Lovelace");
    assert.equal(r.pageid, 984);
    assert.match(r.extract, /Countess of Lovelace/);
    assert.ok(!seen[0].includes("exintro"));
  });

  it("requests the lead section only for summaries", async () => {
    const seen: string[] = [];
    const r = await getSummary(fakeFetch(EXTRACT_PAYLOAD, seen), "Ada Lovelace");
    assert.match(r.summary, /mathematician/);
    assert.ok(seen[0].includes("exintro=1"));
  });

  it("throws for a missing page", async () => {
    await assert.rejects(getArticle(fakeFetch(MISSING_PAYLOAD), "No Such Page Xyz"), /page not found/);
    await assert.rejects(getSummary(fakeFetch(MISSING_PAYLOAD), "No Such Page Xyz"), /page not found/);
  });
});

describe("getSections", () => {
  it("parses the section outline", async () => {
    const seen: string[] = [];
    const r = await getSections(fakeFetch(SECTIONS_PAYLOAD, seen), "Ada Lovelace");
    assert.equal(r.title, "Ada Lovelace");
    assert.equal(r.sections.length, 3);
    assert.deepEqual(r.sections[1], {
      number: "2",
      line: "Work on the Analytical Engine",
      level: "2",
      index: "2",
    });
    assert.equal(r.sections[2].number, "2.1");
    assert.ok(seen[0].includes("action=parse"));
    assert.ok(seen[0].includes("prop=sections"));
  });
});

describe("getLinks", () => {
  it("parses outgoing links with existence flags", async () => {
    const r = await getLinks(fakeFetch(LINKS_PAYLOAD), "Ada Lovelace");
    assert.equal(r.links.length, 3);
    assert.deepEqual(r.links[0], { title: "Charles Babbage", ns: 0, exists: true });
    assert.deepEqual(r.links[1], { title: "Analytical engine", ns: 0, exists: false });
    assert.equal(r.links[2].ns, 104);
  });
});

describe("getCoordinates", () => {
  it("parses coordinates for a page", async () => {
    const r = await getCoordinates(fakeFetch(COORDS_PAYLOAD), "Eiffel Tower");
    assert.equal(r.pageid, 2137);
    assert.deepEqual(r.coordinates, [
      { lat: 48.8584, lon: 2.2945, primary: true, globe: "earth" },
    ]);
  });

  it("returns an empty list for a page without coordinates", async () => {
    const r = await getCoordinates(fakeFetch(NO_COORDS_PAYLOAD), "Ada Lovelace");
    assert.deepEqual(r.coordinates, []);
  });

  it("throws for a missing page", async () => {
    await assert.rejects(
      getCoordinates(fakeFetch(MISSING_PAYLOAD), "No Such Page Xyz"),
      /page not found/,
    );
  });
});
