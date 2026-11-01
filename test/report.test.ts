import { describe, expect, it } from "vitest";
import { renderTable, renderWhy, toJson, type Row } from "../src/report.js";
import type { PluginResult } from "../src/measure.js";

const added = (kindChars: [string, number][]) => {
  const sections = kindChars.map(([kind, n]) => ({ kind: kind as "hook", text: "x".repeat(n) }));
  const text = sections.map((s) => s.text).join("\n");
  return { sections, text, chars: text.length, notices: [] };
};
const result = (over: Partial<PluginResult>): PluginResult => ({ status: "ok", rounds: 3, mcp: [], warnings: [], ...over });
const row = (name: string, over: Partial<PluginResult>, enabled = true): Row => ({ id: `${name}@m`, name, enabled, result: result(over) });

const counted: Row[] = [
  row("light", { tokens: 84, added: added([["listing", 180]]) }),
  row("heavy", { tokens: 2176, added: added([["hook", 3444], ["listing", 2884]]) }),
  row("broken", { status: "failed", reason: "corrupt manifest" }),
  row("changing", { status: "varies", range: [300, 500], charRange: [900, 1500], added: added([["hook", 900]]) }),
  row("off", { tokens: 1000, added: added([["listing", 2000]]) }, false),
];

describe("renderTable", () => {
  const out = renderTable(counted, { offline: false });
  const lines = out.split("\n");
  const position = (name: string) => lines.findIndex((l) => l.includes(name));

  it("sorts heaviest first and failed plugins last", () => {
    expect(position("heavy")).toBeLessThan(position("off"));
    expect(position("off")).toBeLessThan(position("changing"));
    expect(position("changing")).toBeLessThan(position("light"));
    expect(position("light")).toBeLessThan(position("broken"));
  });

  it("formats exact figures with separators and ranges as ranges", () => {
    expect(out).toContain("2,176 tokens");
    expect(out).toContain("300–500 tokens");
  });

  it("shows failure as failed with its reason, never as zero", () => {
    const line = lines[position("broken")]!;
    expect(line).toContain("failed");
    expect(line).not.toMatch(/\b0\b/);
    expect(out).toContain("corrupt manifest");
  });

  it("totals only enabled plugins with an exact figure", () => {
    expect(out).toMatch(/Total.*2,260 tokens/);
  });

  it("marks disabled plugins and states what the total leaves out", () => {
    expect(lines[position("off")]).toContain("off");
    expect(out).toMatch(/not in the total/i);
  });

  it("shows each plugin's share by where the text lands", () => {
    expect(lines[position("heavy")]).toMatch(/hook 54%.*listing 46%/);
  });

  it("always says a heavier plugin may be worth it", () => {
    expect(out).toContain("A heavier plugin may be worth it.");
  });
});

describe("renderTable offline", () => {
  const out = renderTable(
    [
      row("heavy", { added: added([["hook", 3444]]) }),
      row("changing", { status: "varies", charRange: [900, 1500], added: added([["hook", 900]]) }),
      row("mcp", { added: added([["tools", 35]]), mcp: [{ name: "plugin:mcp:demo", status: "connected" }] }),
    ],
    { offline: true },
  );

  it("reports characters and never the word tokens", () => {
    expect(out).toContain("3,444 chars");
    expect(out).toContain("900–1,500 chars");
    expect(out).not.toMatch(/token/i);
  });

  it("explains how to get real counts", () => {
    expect(out).toContain("Run without --offline");
  });
});

describe("notes", () => {
  it("explains that MCP tool schemas are not included", () => {
    const out = renderTable([row("mcp", { tokens: 12, added: added([["tools", 35]]), mcp: [{ name: "plugin:mcp:demo", status: "connected" }] })], { offline: false });
    expect(out).toMatch(/MCP tool schemas load on demand/);
  });

  it("repeats a plugin's warnings", () => {
    const out = renderTable([row("dead", { tokens: 1, added: added([["tools", 3]]), warnings: ["MCP server x did not connect"] })], { offline: false });
    expect(out).toContain("MCP server x did not connect");
  });

  it("says when nothing is installed", () => {
    expect(renderTable([], { offline: false })).toMatch(/No plugins installed/);
  });
});

describe("renderWhy", () => {
  it("prints the exact added text under section headings", () => {
    const out = renderWhy("heavy", result({ added: { sections: [{ kind: "hook", text: "HOOK TEXT" }, { kind: "listing", text: "- a:b: c" }], text: "", chars: 16, notices: [] } }));
    expect(out).toContain("hook");
    expect(out).toContain("HOOK TEXT");
    expect(out).toContain("- a:b: c");
  });

  it("says clearly when nothing was added", () => {
    expect(renderWhy("empty", result({ added: { sections: [], text: "", chars: 0, notices: [] } }))).toMatch(/adds no text/);
  });

  it("reports a failure", () => {
    expect(renderWhy("broken", result({ status: "failed", reason: "corrupt" }))).toContain("corrupt");
  });

  it("warns that varying text is one example", () => {
    expect(renderWhy("v", result({ status: "varies", added: { sections: [{ kind: "hook", text: "x" }], text: "x", chars: 1, notices: [] } }))).toMatch(/changes between runs/);
  });
});

describe("toJson", () => {
  const json = toJson(counted, { claudeVersion: "2.1.316", model: "haiku" });

  it("carries figures and section sizes but not the added text", () => {
    const heavy = json.plugins.find((p) => p.name === "heavy")!;
    expect(heavy.tokens).toBe(2176);
    expect(heavy.sections).toEqual([{ kind: "hook", chars: 3444 }, { kind: "listing", chars: 2884 }]);
    expect(JSON.stringify(json)).not.toContain("xxx");
  });

  it("keeps failed plugins, with a reason and no figure", () => {
    const broken = json.plugins.find((p) => p.name === "broken")!;
    expect(broken.status).toBe("failed");
    expect(broken.reason).toBe("corrupt manifest");
    expect(broken.tokens).toBeUndefined();
  });

  it("is valid JSON", () => {
    expect(JSON.parse(JSON.stringify(json)).claudeVersion).toBe("2.1.316");
  });
});
