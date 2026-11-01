import { describe, expect, it } from "vitest";
import { buildCaptureEnv, capture, pickMainRequest } from "../src/capture.js";

describe("buildCaptureEnv", () => {
  const env = buildCaptureEnv(
    {
      PATH: "/bin",
      HOME: "/home/x",
      ANTHROPIC_API_KEY: "secret-key",
      ANTHROPIC_AUTH_TOKEN: "secret-token",
      ANTHROPIC_BASE_URL: "https://real.example",
      ANTHROPIC_CUSTOM_HEADERS: "x: y",
      CLAUDE_CODE_OAUTH_TOKEN: "secret-oauth",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_USE_VERTEX: "1",
      CLAUDE_CONFIG_DIR: "/real/config",
      CLAUDECODE: "1",
      HTTPS_PROXY: "http://proxy",
      http_proxy: "http://proxy",
    },
    "http://127.0.0.1:9",
    "/tmp/cfg",
  );

  it("points Claude Code only at the stub with a dummy key", () => {
    expect(env.ANTHROPIC_BASE_URL).toBe("http://127.0.0.1:9");
    expect(env.ANTHROPIC_API_KEY).toBe("plugweight-stub-not-a-real-key");
    expect(env.CLAUDE_CONFIG_DIR).toBe("/tmp/cfg");
  });

  it("removes every real credential and anything that could route around the stub", () => {
    for (const key of [
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_CUSTOM_HEADERS",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
      "CLAUDECODE",
      "HTTPS_PROXY",
      "http_proxy",
    ]) {
      expect(env[key], key).toBeUndefined();
    }
    expect(JSON.stringify(env)).not.toContain("secret-");
  });

  it("keeps what a child process needs", () => {
    expect(env.PATH).toBe("/bin");
    expect(env.HOME).toBe("/home/x");
  });
});

describe("pickMainRequest", () => {
  const req = (tools: unknown[], content: string) => ({ model: "m", system: "", tools, messages: [{ role: "user", content }] });

  it("prefers the last request that carries tools", () => {
    expect(pickMainRequest([req([], "title"), req([{}], "first"), req([{}], "second"), req([], "after")])?.messages)
      .toEqual([{ role: "user", content: "second" }]);
  });

  it("returns undefined when nothing was captured", () => {
    expect(pickMainRequest([])).toBeUndefined();
  });
});

describe("capture", () => {
  it("reports a missing claude binary as a failure, not an exception", async () => {
    const result = await capture({ claudeBin: "plugweight-no-such-binary" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not found|ENOENT/i);
  });

  it("reports a missing plugin directory as a failure", async () => {
    const result = await capture({ pluginDir: "/plugweight/no/such/dir" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/plugin directory/i);
  });
});

describe.runIf(process.env.RUN_INTEGRATION === "1")("capture against real Claude Code", () => {
  it("captures the first request without a login, repeatably", async () => {
    const a = await capture({});
    const b = await capture({});
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.request.tools.length).toBeGreaterThan(0);
      expect(JSON.stringify(a.request).length).toBe(JSON.stringify(b.request).length);
      expect(a.claudeVersion).toMatch(/\d+\.\d+\.\d+/);
    }
  });
});
