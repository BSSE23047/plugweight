import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { capture } from "../src/capture.js";
import { measurePlugin, summariseMcp } from "../src/measure.js";
import type { CapturedRequest } from "../src/types.js";

const fixture = (name: string) => join(resolve("test/fixtures"), name);
const lengthCounter = () => ({ count: vi.fn(async (text: string) => text.length), model: "fake" });

describe("summariseMcp", () => {
  it("warns about a server that did not connect, because its tools are not counted", () => {
    const warnings = summariseMcp([
      { name: "plugin:a:good", status: "connected" },
      { name: "plugin:a:bad", status: "failed" },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("plugin:a:bad");
    expect(warnings[0]).toContain("failed");
  });

  it("has nothing to say when all servers connect", () => {
    expect(summariseMcp([{ name: "x", status: "connected" }])).toEqual([]);
  });
});

describe.runIf(process.env.RUN_INTEGRATION === "1")("measurePlugin against real Claude Code", () => {
  let base: CapturedRequest;

  beforeAll(async () => {
    const result = await capture({});
    if (!result.ok) throw new Error(result.reason);
    base = result.request;
  });

  it("measures a plain skill plugin", async () => {
    const counter = lengthCounter();
    const result = await measurePlugin({ pluginDir: fixture("plugin-skill"), base, counter });
    expect(result.status).toBe("ok");
    expect(result.added?.sections.map((s) => s.kind)).toEqual(["listing"]);
    expect(result.tokens).toBe(result.added?.chars);
    expect(result.rounds).toBe(3);
    expect(counter.count).toHaveBeenCalledTimes(1);
  });

  it("works offline without a counter and gives no token figure", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-skill"), base });
    expect(result.status).toBe("ok");
    expect(result.tokens).toBeUndefined();
    expect(result.added?.chars).toBeGreaterThan(0);
  });

  it("reports a loaded plugin that adds nothing as a true zero", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-empty"), base, counter: lengthCounter() });
    expect(result.status).toBe("ok");
    expect(result.tokens).toBe(0);
    expect(result.added?.chars).toBe(0);
  });

  it("reports a corrupt plugin as failed, never as zero", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-broken"), base, counter: lengthCounter() });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/manifest/i);
    expect(result.tokens).toBeUndefined();
    expect(result.added).toBeUndefined();
  });

  it("reports a hanging hook as failed after the timeout", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-hanging-hook"), base, timeoutMs: 3000, rounds: 1 });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/timed out/i);
  });

  it("marks changing hook output as varies, with a range and no exact figure", async () => {
    const counter = lengthCounter();
    const result = await measurePlugin({ pluginDir: fixture("plugin-varying-hook"), base, counter });
    expect(result.status).toBe("varies");
    expect(result.tokens).toBeUndefined();
    const [low, high] = result.range!;
    expect(low).toBeLessThan(high);
    expect(result.charRange![0]).toBeLessThan(result.charRange![1]);
  });

  it("counts a connected MCP server's deferred tool names", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-mcp"), base });
    expect(result.status).toBe("ok");
    expect(result.added?.sections.map((s) => s.kind)).toEqual(["tools"]);
    expect(result.mcp).toEqual([{ name: "plugin:plugin-mcp:demo", status: "connected" }]);
    expect(result.warnings).toEqual([]);
  });

  it("warns when an MCP server cannot start, so a low number is not misread", async () => {
    const result = await measurePlugin({ pluginDir: fixture("plugin-mcp-dead"), base });
    expect(result.status).toBe("ok");
    expect(result.warnings.join(" ")).toContain("plugin:plugin-mcp-dead:dead");
  });
});
