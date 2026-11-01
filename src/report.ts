import type { PluginResult } from "./measure.js";

export type Row = { id: string; name: string; enabled: boolean; result: PluginResult };

const number = (n: number) => n.toLocaleString("en-US");

/** The figure used for sorting. Failed plugins have none and sort last. */
function weight(row: Row, offline: boolean): number {
  const { result } = row;
  if (result.status === "failed") return -1;
  if (offline) return result.charRange?.[1] ?? result.added?.chars ?? 0;
  return result.range?.[1] ?? result.tokens ?? 0;
}

function figure(row: Row, offline: boolean): string {
  const { result } = row;
  if (result.status === "failed") return "failed";
  if (offline) {
    return result.charRange
      ? `${number(result.charRange[0])}–${number(result.charRange[1])} chars`
      : `${number(result.added?.chars ?? 0)} chars`;
  }
  return result.range
    ? `${number(result.range[0])}–${number(result.range[1])} tokens`
    : `${number(result.tokens ?? 0)} tokens`;
}

/** Each section's share of the added text. Characters give a share only, never a token figure. */
function shares(result: PluginResult): string {
  const sections = result.added?.sections ?? [];
  const totals = new Map<string, number>();
  for (const s of sections) totals.set(s.kind, (totals.get(s.kind) ?? 0) + s.text.length);
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  if (all === 0) return "";
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, chars]) => `${kind} ${Math.round((chars / all) * 100)}%`)
    .join(" · ");
}

export function renderTable(rows: Row[], opts: { offline: boolean }): string {
  if (rows.length === 0) return "No plugins installed.";
  const { offline } = opts;
  const sorted = [...rows].sort((a, b) => weight(b, offline) - weight(a, offline));

  const nameOf = (r: Row) => (r.enabled ? r.name : `${r.name} (off)`);
  const nameWidth = Math.max("Plugin".length, "Total".length, ...sorted.map((r) => nameOf(r).length));
  const figures = sorted.map((r) => figure(r, offline));
  const counted = rows.filter((r) => r.enabled && r.result.status === "ok");
  const total = counted.reduce((sum, r) => sum + (offline ? r.result.added?.chars ?? 0 : r.result.tokens ?? 0), 0);
  const totalText = `${number(total)} ${offline ? "chars" : "tokens"}`;
  const figureWidth = Math.max("Added per session".length, totalText.length, ...figures.map((f) => f.length));

  const line = (name: string, value: string, rest = "") => `${name.padEnd(nameWidth)}  ${value.padStart(figureWidth)}  ${rest}`.trimEnd();
  const out = [line("Plugin", "Added per session", "Where it lands"), "-".repeat(nameWidth + figureWidth + 18)];
  sorted.forEach((r, i) => out.push(line(nameOf(r), figures[i]!, shares(r.result))));
  out.push("-".repeat(nameWidth + figureWidth + 18), line("Total", totalText));

  const notes: string[] = [];
  if (counted.length < rows.length) notes.push("Plugins that are off, failed, or change between runs are not in the total.");
  for (const r of sorted) {
    if (r.result.status === "failed") notes.push(`${r.name} failed: ${r.result.reason}`);
    for (const warning of r.result.warnings) notes.push(`${r.name}: ${warning}`);
  }
  if (rows.some((r) => r.result.mcp.length > 0)) notes.push("MCP tool schemas load on demand and are not included. Only what is sent at session start is.");
  if (offline) notes.push("Run without --offline to get real counts. That uses your login and a little of your usage.");
  notes.push("A heavier plugin may be worth it. This shows what a plugin adds, not whether it is good.");
  return [...out, "", ...notes].join("\n");
}

export function renderWhy(name: string, result: PluginResult): string {
  if (result.status === "failed") return `${name} failed: ${result.reason}`;
  const sections = result.added?.sections ?? [];
  if (sections.length === 0) return `${name} adds no text to the start of a session.`;
  const parts = sections.map((s) => `--- ${s.kind} ---\n${s.text}`);
  if (result.status === "varies") parts.unshift(`${name}'s text changes between runs. This is one example.`);
  return parts.join("\n\n");
}

export type JsonReport = {
  claudeVersion: string;
  model?: string;
  plugins: {
    id: string;
    name: string;
    enabled: boolean;
    status: PluginResult["status"];
    reason?: string;
    tokens?: number;
    range?: [number, number];
    chars?: number;
    charRange?: [number, number];
    sections?: { kind: string; chars: number }[];
    mcp: PluginResult["mcp"];
    warnings: string[];
  }[];
};

export function toJson(rows: Row[], meta: { claudeVersion: string; model?: string }): JsonReport {
  return {
    ...meta,
    plugins: rows.map(({ id, name, enabled, result }) => ({
      id,
      name,
      enabled,
      status: result.status,
      reason: result.reason,
      tokens: result.tokens,
      range: result.range,
      chars: result.added?.chars,
      charRange: result.charRange,
      sections: result.added?.sections.map((s) => ({ kind: s.kind, chars: s.text.length })),
      mcp: result.mcp,
      warnings: result.warnings,
    })),
  };
}
