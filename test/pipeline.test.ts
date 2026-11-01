import { describe, expect, it } from "vitest";
import { buildResult, pluginFromCatalog, selectTop, validateCapture, validatePluginEntry, type Capture, type PluginEntry } from "../src/pipeline/results.js";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const catalog = [
  { pluginId: "small@claude-plugins-official", name: "small", installCount: 5, marketplaceName: "claude-plugins-official", source: "./plugins/small" },
  { pluginId: "big@claude-plugins-official", name: "big", installCount: 500, marketplaceName: "claude-plugins-official", source: { source: "url", url: "https://github.com/o/big.git", sha: OTHER } },
  { pluginId: "mid@claude-plugins-official", name: "mid", installCount: 50, marketplaceName: "claude-plugins-official", source: { source: "git-subdir", url: "https://github.com/o/mono.git", path: "providers/mid", ref: "main", sha: OTHER } },
  { pluginId: "nocount@claude-plugins-official", name: "nocount", marketplaceName: "claude-plugins-official", source: "./plugins/nocount" },
  { pluginId: "elsewhere@anthropic-plugin-directory", name: "elsewhere", installCount: 9999, marketplaceName: "anthropic-plugin-directory", source: "./x" },
];

describe("selectTop", () => {
  it("ranks the official marketplace by install count, mechanically", () => {
    expect(selectTop(catalog, 2).map((p) => p.name)).toEqual(["big", "mid"]);
  });

  it("ignores other marketplaces and plugins with no count", () => {
    expect(selectTop(catalog, 10).map((p) => p.name)).toEqual(["big", "mid", "small"]);
  });
});

describe("pluginFromCatalog", () => {
  const marketplace = { repo: "https://github.com/anthropics/claude-plugins-official.git", commit: SHA };

  it("pins a relative plugin to the marketplace commit", () => {
    expect(pluginFromCatalog(catalog[0]!, marketplace)).toEqual({ id: "small@claude-plugins-official", name: "small", installs: 5, repo: marketplace.repo, path: "plugins/small", commit: SHA });
  });

  it("uses the pinned commit of a url plugin", () => {
    expect(pluginFromCatalog(catalog[1]!, marketplace)).toMatchObject({ repo: "https://github.com/o/big.git", path: "", commit: OTHER });
  });

  it("uses the pinned commit and path of a subdirectory plugin", () => {
    expect(pluginFromCatalog(catalog[2]!, marketplace)).toMatchObject({ repo: "https://github.com/o/mono.git", path: "providers/mid", commit: OTHER });
  });
});

describe("validatePluginEntry", () => {
  const good: PluginEntry = { id: "a@m", name: "a", installs: 1, repo: "https://github.com/o/a.git", path: "", commit: SHA };

  it("accepts a pinned entry", () => {
    expect(() => validatePluginEntry(good)).not.toThrow();
  });

  it.each([
    ["a short commit", { commit: "abc123" }],
    ["a name that could escape the data folder", { name: "../../evil" }],
    ["a path that climbs out of the clone", { path: "../outside" }],
    ["a non-https repo", { repo: "file:///etc" }],
    ["an option-like repo", { repo: "--upload-pack=evil" }],
  ])("rejects %s", (_label, change) => {
    expect(() => validatePluginEntry({ ...good, ...change })).toThrow();
  });
});

const capture: Capture = {
  name: "a",
  status: "ok",
  sections: [{ kind: "hook", text: "hello" }, { kind: "listing", text: "- a:b: c" }],
  chars: 14,
  variants: [],
  mcp: [],
  warnings: [],
  claudeVersion: "2.1.316",
  rounds: 3,
};
const entry: PluginEntry = { id: "a@m", name: "a", installs: 7, repo: "https://github.com/o/a.git", path: "", commit: SHA };

describe("validateCapture", () => {
  it("accepts a well-formed capture", () => {
    expect(validateCapture(capture, "a").chars).toBe(14);
  });

  it.each([
    ["a name that does not match the plugin", { name: "b" }],
    ["an unknown status", { status: "great" }],
    ["an unknown section kind", { sections: [{ kind: "evil", text: "x" }] }],
    ["sections that are not a list", { sections: "nope" }],
    ["oversized text", { sections: [{ kind: "hook", text: "x".repeat(600_000) }] }],
    ["an ok capture with no version", { claudeVersion: 5 }],
  ])("rejects %s", (_label, change) => {
    expect(() => validateCapture({ ...capture, ...change }, "a")).toThrow();
  });

  it("rejects something that is not an object", () => {
    expect(() => validateCapture(null, "a")).toThrow();
  });
});

describe("buildResult", () => {
  const meta = { countModel: "claude-haiku-5-5", measuredAt: "2026-11-01" };

  it("combines catalog, capture and count, keeping text out of the summary", () => {
    const result = buildResult(entry, capture, { tokens: 42 }, meta);
    expect(result).toMatchObject({ id: "a@m", installs: 7, commit: SHA, status: "ok", tokens: 42, chars: 14, claudeVersion: "2.1.316", countModel: "claude-haiku-5-5", measuredAt: "2026-11-01" });
    expect(result.sections).toEqual([{ kind: "hook", chars: 5 }, { kind: "listing", chars: 8 }]);
    expect(JSON.stringify(result)).not.toContain("hello");
    expect(result.minimum).toBe(false);
  });

  it("marks a figure as a minimum when an MCP server did not connect", () => {
    const result = buildResult(entry, { ...capture, mcp: [{ name: "x", status: "failed" }] }, { tokens: 42 }, meta);
    expect(result.minimum).toBe(true);
  });

  it("marks a figure as a minimum when the plugin has its own settings", () => {
    expect(buildResult(entry, { ...capture, needsConfig: true }, { tokens: 42 }, meta).minimum).toBe(true);
  });

  it("gives a failed plugin a reason and no figure", () => {
    const result = buildResult(entry, { ...capture, status: "failed", reason: "bad", sections: [], chars: 0 }, {}, meta);
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("bad");
    expect(result.tokens).toBeUndefined();
    expect(result.chars).toBeUndefined();
  });

  it("carries a range and no exact figure when output varies", () => {
    const result = buildResult(entry, { ...capture, status: "varies", charRange: [1, 2] }, { range: [10, 20] }, meta);
    expect(result.range).toEqual([10, 20]);
    expect(result.tokens).toBeUndefined();
  });

  it("labels the author's own project", () => {
    expect(buildResult({ ...entry, ownProject: true }, capture, { tokens: 1 }, meta).ownProject).toBe(true);
  });
});
