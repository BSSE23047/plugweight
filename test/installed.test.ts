import { describe, expect, it } from "vitest";
import { parsePluginList } from "../src/installed.js";

describe("parsePluginList", () => {
  const entry = { id: "superpowers@claude-plugins-official", version: "7.0.0", scope: "user", enabled: true, installPath: "/x/superpowers/7.0.0" };

  it("maps Claude Code's list to plugins", () => {
    expect(parsePluginList(JSON.stringify([entry]))).toEqual([
      { id: "superpowers@claude-plugins-official", name: "superpowers", version: "7.0.0", dir: "/x/superpowers/7.0.0", enabled: true },
    ]);
  });

  it("lists a plugin installed at two scopes once, preferring the enabled one", () => {
    const off = { ...entry, scope: "project", enabled: false };
    const plugins = parsePluginList(JSON.stringify([off, entry]));
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.enabled).toBe(true);
  });

  it("flags a plugin that has its own settings", () => {
    expect(parsePluginList(JSON.stringify([{ ...entry, hasUserConfig: true }]))[0]?.needsConfig).toBe(true);
  });

  it("skips entries without an install path", () => {
    expect(parsePluginList(JSON.stringify([{ id: "x@y", enabled: true }]))).toEqual([]);
  });

  it("rejects output that is not a list", () => {
    expect(() => parsePluginList("{}")).toThrow(/unexpected/i);
  });
});
