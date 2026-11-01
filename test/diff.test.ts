import { describe, expect, it } from "vitest";
import { diffRequests, sameAdded } from "../src/diff.js";
import type { CapturedRequest } from "../src/types.js";

const ENV = "# Environment\nWorking directory: /tmp/x\n\nToday is a day.\n\nGit: no";
const req = (text: string, tools: unknown[] = [{ name: "Read", description: "reads" }], system: unknown = [{ type: "text", text: "sys" }]): CapturedRequest => ({
  model: "m",
  system,
  tools,
  messages: [{ role: "user", content: [{ type: "text", text: "Reply with exactly: ok" }, { type: "text", text }] }],
});
const base = req(ENV);
const kinds = (a: { sections: { kind: string }[] }) => a.sections.map((s) => s.kind);

describe("diffRequests", () => {
  it("reports nothing for identical requests", () => {
    const added = diffRequests(base, req(ENV));
    expect(added.chars).toBe(0);
    expect(added.sections).toEqual([]);
    expect(added.text).toBe("");
  });

  it("classifies hook text, keeping blank lines inside the hook", () => {
    const added = diffRequests(base, req(`SessionStart hook additional context: Hello\nmore\n\n- a bullet\nend\n${ENV}`));
    expect(kinds(added)).toEqual(["hook"]);
    expect(added.text).toBe("SessionStart hook additional context: Hello\nmore\n\n- a bullet\nend");
    expect(added.chars).toBe(added.text.length);
  });

  it("classifies namespaced lines in the skills list as listing", () => {
    const added = diffRequests(base, req(`${ENV}\n- ralph-loop:help: Explain things\n- ui-ux-pro-max:slides`));
    expect(kinds(added)).toEqual(["listing"]);
    expect(added.text).toBe("- ralph-loop:help: Explain things\n- ui-ux-pro-max:slides");
  });

  it("separates hook and listing text in one plugin", () => {
    const added = diffRequests(base, req(`Stop hook additional context: x\n${ENV}\n- sp:brainstorm: Think`));
    expect(added.sections.map((s) => [s.kind, s.text])).toEqual([
      ["hook", "Stop hook additional context: x"],
      ["listing", "- sp:brainstorm: Think"],
    ]);
  });

  it("does not treat an ordinary bullet as a listing", () => {
    const added = diffRequests(base, req(`${ENV}\n- Claude Code: see the docs`));
    expect(kinds(added)).toEqual(["other"]);
  });

  it("reports a new tool in full and a changed tool's new description lines", () => {
    const added = diffRequests(base, req(ENV, [{ name: "Read", description: "reads\nand more" }, { name: "Extra", description: "new tool" }]));
    expect(kinds(added)).toEqual(["tools", "tools"]);
    expect(added.text).toContain("and more");
    expect(added.text).not.toContain("reads");
    expect(added.text).toContain('"name":"Extra"');
  });

  it("classifies deferred MCP tool names as tools", () => {
    const added = diffRequests(base, req(`${ENV}\nmcp__demo__search`));
    expect(kinds(added)).toEqual(["tools"]);
  });

  it("reports added system prompt text as system", () => {
    const added = diffRequests(base, req(ENV, undefined, [{ type: "text", text: "sys\nextra rule" }]));
    expect(added.sections.map((s) => [s.kind, s.text])).toEqual([["system", "extra rule"]]);
  });

  it("handles a plain string system prompt and string message content", () => {
    const a: CapturedRequest = { model: "m", system: "one", tools: [], messages: [{ role: "user", content: "hi" }] };
    const b: CapturedRequest = { model: "m", system: "one\ntwo", tools: [], messages: [{ role: "user", content: "hi\nthere" }] };
    expect(diffRequests(a, b).text).toBe("two\nthere");
  });

  it("does not count text the plugin removed", () => {
    const added = diffRequests(base, req("# Environment"));
    expect(added.chars).toBe(0);
  });
});

describe("sameAdded", () => {
  it("ignores random temp paths and the plugin directory", () => {
    const a = diffRequests(base, req(`${ENV}\n- p:a: see /tmp/plugweight-config-AbC123/x and /work/one/plugin/y`), { pluginDir: "/work/one/plugin" });
    const b = diffRequests(base, req(`${ENV}\n- p:a: see /tmp/plugweight-config-ZzZ999/x and /work/two/plugin/y`), { pluginDir: "/work/two/plugin" });
    expect(sameAdded(a, b)).toBe(true);
    expect(a.text).toBe("- p:a: see /tmp/<temp>/x and <plugin>/y");
  });

  it("sees real differences", () => {
    const a = diffRequests(base, req(`${ENV}\n- p:a: one`));
    const b = diffRequests(base, req(`${ENV}\n- p:a: two`));
    expect(sameAdded(a, b)).toBe(false);
  });
});
