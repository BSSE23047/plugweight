import { describe, expect, it, vi } from "vitest";
import { runCli, type Deps } from "../src/app.js";
import type { InstalledPlugin } from "../src/installed.js";

const plugins: InstalledPlugin[] = [
  { id: "a@m", name: "a", version: "1", dir: "/p/a", enabled: true },
  { id: "b@m", name: "b", version: "1", dir: "/p/b", enabled: true },
];
const addedText = { sections: [{ kind: "listing" as const, text: "- a:x: y" }], text: "- a:x: y", chars: 8 };

function setup(over: Partial<Deps> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const order: string[] = [];
  const deps: Deps = {
    listInstalled: vi.fn(async () => plugins),
    captureBase: vi.fn(async () => ({ ok: true as const, request: { model: "m", system: "", tools: [], messages: [] }, claudeVersion: "2.1.316", mcp: [] })),
    createCounter: vi.fn(() => ({
      model: "haiku",
      count: async () => {
        order.push("count");
        return 42;
      },
    })),
    measurePlugin: vi.fn(async ({ counter }) => {
      if (counter) await counter.count("text");
      return { status: "ok" as const, added: addedText, tokens: counter ? 42 : undefined, rounds: 3, mcp: [], warnings: [] };
    }),
    ...over,
  };
  const io = {
    out: (s: string) => out.push(s),
    err: (s: string) => {
      order.push("notice");
      err.push(s);
    },
  };
  return { deps, io, out, err, order };
}

describe("runCli", () => {
  it("prints the table and exits 0", async () => {
    const t = setup();
    expect(await runCli([], t.io, t.deps)).toBe(0);
    expect(t.out.join("\n")).toContain("42 tokens");
  });

  it("states it will use the user's usage before counting anything", async () => {
    const t = setup();
    await runCli([], t.io, t.deps);
    expect(t.order[0]).toBe("notice");
    expect(t.err[0]).toMatch(/usage/i);
    expect(t.order.indexOf("count")).toBeGreaterThan(0);
  });

  it("uses no counter and no usage with --offline", async () => {
    const t = setup();
    expect(await runCli(["--offline"], t.io, t.deps)).toBe(0);
    expect(t.deps.createCounter).not.toHaveBeenCalled();
    expect(t.err.join("\n")).not.toMatch(/usage/i);
    expect(t.out.join("\n")).toContain("8 chars");
  });

  it("keeps stdout pure JSON with --json", async () => {
    const t = setup();
    expect(await runCli(["--json"], t.io, t.deps)).toBe(0);
    expect(JSON.parse(t.out.join("\n")).plugins).toHaveLength(2);
  });

  it("gives an install hint when Claude Code is missing", async () => {
    const t = setup({ listInstalled: vi.fn(async () => { throw new Error("spawn claude ENOENT"); }) });
    expect(await runCli([], t.io, t.deps)).toBe(1);
    expect(t.err.join("\n")).toMatch(/Claude Code/);
    expect(t.err.join("\n")).toMatch(/npm install -g @anthropic-ai\/claude-code/);
  });

  it("suggests --offline when counting fails, for example without a login", async () => {
    const t = setup({
      createCounter: vi.fn(() => ({ model: "haiku", count: async () => { throw new Error("token count failed: Not logged in"); } })),
    });
    expect(await runCli([], t.io, t.deps)).toBe(1);
    expect(t.err.join("\n")).toContain("Not logged in");
    expect(t.err.join("\n")).toContain("--offline");
  });

  it("stops if the baseline cannot be captured", async () => {
    const t = setup({ captureBase: vi.fn(async () => ({ ok: false as const, reason: "boom" })) });
    expect(await runCli([], t.io, t.deps)).toBe(1);
    expect(t.err.join("\n")).toContain("boom");
    expect(t.deps.measurePlugin).not.toHaveBeenCalled();
  });

  it("carries on after one plugin fails", async () => {
    const t = setup({
      measurePlugin: vi.fn(async ({ pluginDir }) =>
        pluginDir === "/p/a"
          ? { status: "failed" as const, reason: "bad", rounds: 3, mcp: [], warnings: [] }
          : { status: "ok" as const, added: addedText, tokens: 42, rounds: 3, mcp: [], warnings: [] }),
    });
    expect(await runCli([], t.io, t.deps)).toBe(0);
    const out = t.out.join("\n");
    expect(out).toContain("failed");
    expect(out).toContain("42 tokens");
  });

  it("warns that a plugin with its own settings may measure low", async () => {
    const t = setup({ listInstalled: vi.fn(async () => [{ ...plugins[0]!, needsConfig: true }]) });
    expect(await runCli([], t.io, t.deps)).toBe(0);
    expect(t.out.join("\n")).toMatch(/a: It has its own settings.*may be low/);
  });

  it("rejects unknown options with exit code 2", async () => {
    const t = setup();
    expect(await runCli(["--nope"], t.io, t.deps)).toBe(2);
  });

  it("prints help and the version", async () => {
    const t = setup();
    expect(await runCli(["--help"], t.io, t.deps)).toBe(0);
    expect(t.out.join("\n")).toContain("plugweight why");
    expect(t.deps.listInstalled).not.toHaveBeenCalled();
  });
});

describe("plugweight why", () => {
  it("prints a plugin's added text, offline, found by name or id", async () => {
    for (const name of ["a", "a@m"]) {
      const t = setup();
      expect(await runCli(["why", name], t.io, t.deps)).toBe(0);
      expect(t.out.join("\n")).toContain("- a:x: y");
      expect(t.deps.createCounter).not.toHaveBeenCalled();
    }
  });

  it("lists installed names for an unknown plugin", async () => {
    const t = setup();
    expect(await runCli(["why", "zzz"], t.io, t.deps)).toBe(1);
    expect(t.err.join("\n")).toContain("a@m");
    expect(t.err.join("\n")).toContain("b@m");
  });

  it("asks for a plugin name when none is given", async () => {
    const t = setup();
    expect(await runCli(["why"], t.io, t.deps)).toBe(2);
  });
});
