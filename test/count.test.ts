import { describe, expect, it } from "vitest";
import { buildCountArgs, buildCountInput, createCounter, median, promptTokens, tokensFromRuns, withinTolerance } from "../src/count.js";

describe("withinTolerance", () => {
  it("allows 2% or 10 tokens, whichever is larger", () => {
    expect(withinTolerance(2176, 2200)).toBe(true);
    expect(withinTolerance(2100, 2176)).toBe(false);
    expect(withinTolerance(84, 93)).toBe(true);
    expect(withinTolerance(84, 95)).toBe(false);
  });
});

describe("buildCountArgs", () => {
  const args = buildCountArgs(["a@m", "b@m"]);

  it("gives the model no tools and no MCP servers", () => {
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args).toContain("--strict-mcp-config");
  });

  it("switches off every installed plugin and all hooks", () => {
    const settings = JSON.parse(args[args.indexOf("--settings") + 1]!);
    expect(settings.enabledPlugins).toEqual({ "a@m": false, "b@m": false });
    expect(settings.disableAllHooks).toBe(true);
    expect(args).not.toContain("--plugin-dir");
  });

  it("never puts the text on the command line", () => {
    expect(args[args.indexOf("-p") + 1]).toMatch(/^--/);
  });
});

describe("buildCountInput", () => {
  it("is the capture prompt alone for the baseline", () => {
    expect(buildCountInput("")).toBe("Reply with exactly: ok");
  });

  it("appends the added text", () => {
    expect(buildCountInput("extra")).toBe("Reply with exactly: ok\n\nextra");
  });
});

describe("token arithmetic", () => {
  it("sums input, cache write and cache read", () => {
    expect(promptTokens({ input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100 })).toBe(112);
    expect(promptTokens({ input_tokens: 2 })).toBe(2);
  });

  it("takes the middle value", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([5])).toBe(5);
  });

  it("subtracts the baseline median from the arm median, never below zero", () => {
    expect(tokensFromRuns([110, 112, 111], [100, 101, 100])).toBe(11);
    expect(tokensFromRuns([90], [100])).toBe(0);
  });
});

describe("createCounter", () => {
  it("spends nothing on empty text", async () => {
    const counter = createCounter({ claudeBin: "plugweight-no-such-binary", pluginIds: [] });
    expect(await counter.count("")).toBe(0);
  });

  it("rejects when Claude Code cannot run", async () => {
    const counter = createCounter({ claudeBin: "plugweight-no-such-binary", pluginIds: [] });
    await expect(counter.count("text")).rejects.toThrow(/could not start/i);
  });
});
