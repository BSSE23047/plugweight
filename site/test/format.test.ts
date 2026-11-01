import { describe, expect, it } from "vitest";
import { badgeFor, figureText, rank, shareOf, shortTokens, type Entry } from "../src/lib/format";

const entry = (over: Partial<Entry>): Entry => ({
  id: "a@m", name: "a", installs: 10, repo: "https://github.com/o/a.git", path: "", commit: "c".repeat(40),
  status: "ok", minimum: false, sections: [], mcp: [], warnings: [], claudeVersion: "2.1.316", countModel: "haiku", measuredAt: "2026-11-01",
  ...over,
});

describe("shortTokens", () => {
  it("shortens large numbers to one decimal", () => {
    expect(shortTokens(2176)).toBe("2.2k");
    expect(shortTokens(12000)).toBe("12k");
  });

  it("keeps small numbers exact", () => {
    expect(shortTokens(84)).toBe("84");
  });
});

describe("figureText", () => {
  it("shows exact tokens", () => {
    expect(figureText(entry({ tokens: 2176 }))).toBe("2,176");
  });

  it("says at least when part of the plugin could not run", () => {
    expect(figureText(entry({ tokens: 12, minimum: true }))).toBe("at least 12");
  });

  it("shows a range with a plain hyphen", () => {
    expect(figureText(entry({ status: "varies", range: [300, 1500] }))).toBe("300-1,500");
  });

  it("never shows a failed plugin as zero", () => {
    expect(figureText(entry({ status: "failed", reason: "bad" }))).toBe("Not measured");
  });

  it("does not call a plugin that needs sign-in zero", () => {
    expect(figureText(entry({ tokens: 0, minimum: true }))).toBe("Needs setup");
    expect(badgeFor(entry({ tokens: 0, minimum: true })).message).toBe("needs setup");
    expect(rank([entry({ tokens: 0, minimum: true })]).unmeasured).toHaveLength(1);
  });

  it("shows a true zero as zero", () => {
    expect(figureText(entry({ tokens: 0 }))).toBe("0");
  });
});

describe("badgeFor", () => {
  it("gives shields.io an exact figure", () => {
    expect(badgeFor(entry({ tokens: 2176 }))).toEqual({ schemaVersion: 1, label: "session cost", message: "2.2k tokens", color: "555" });
  });

  it("marks a minimum with a plus", () => {
    expect(badgeFor(entry({ tokens: 12, minimum: true })).message).toBe("12+ tokens");
  });

  it("gives a range for varying output, not an exact number", () => {
    expect(badgeFor(entry({ status: "varies", range: [300, 500] })).message).toBe("300-500 tokens");
  });

  it("says not measured for a failed plugin", () => {
    expect(badgeFor(entry({ status: "failed" })).message).toBe("not measured");
  });

  it("never colours a figure as good or bad", () => {
    const colours = [entry({ tokens: 1 }), entry({ tokens: 90000 }), entry({ status: "failed" })].map((e) => badgeFor(e).color);
    expect(new Set(colours).size).toBe(1);
  });
});

describe("rank", () => {
  const list = [
    entry({ name: "light", tokens: 10 }),
    entry({ name: "broken", status: "failed" }),
    entry({ name: "heavy", tokens: 900 }),
    entry({ name: "changing", status: "varies", range: [100, 500] }),
  ];

  it("orders measured plugins heaviest first, using a range's high end", () => {
    expect(rank(list).ranked.map((e) => e.name)).toEqual(["heavy", "changing", "light"]);
  });

  it("keeps failed plugins out of the ranking but still lists them", () => {
    expect(rank(list).unmeasured.map((e) => e.name)).toEqual(["broken"]);
  });

  it("can order by installs, with unknown counts last", () => {
    const withCounts = [entry({ name: "a", tokens: 1, installs: 5 }), entry({ name: "own", tokens: 1, installs: null }), entry({ name: "b", tokens: 1, installs: 50 })];
    expect(rank(withCounts, "installs").ranked.map((e) => e.name)).toEqual(["b", "a", "own"]);
  });
});

describe("shareOf", () => {
  it("merges sections by kind and gives each a share, largest first", () => {
    const shares = shareOf(entry({ sections: [{ kind: "listing", chars: 15 }, { kind: "hook", chars: 60 }, { kind: "listing", chars: 25 }] }));
    expect(shares).toEqual([{ kind: "hook", share: 0.6 }, { kind: "listing", share: 0.4 }]);
  });

  it("is empty when nothing was added", () => {
    expect(shareOf(entry({}))).toEqual([]);
  });
});
