import { capture, type CaptureOptions } from "./capture.js";
import { diffRequests, sameAdded, type Added } from "./diff.js";
import type { Counter } from "./count.js";
import type { CapturedRequest, McpServer } from "./types.js";

const DEFAULT_ROUNDS = 3;

export type PluginResult = {
  status: "ok" | "varies" | "failed";
  reason?: string;
  added?: Added;
  tokens?: number;
  /** Lowest and highest token counts seen, when the plugin's output changes between runs. */
  range?: [number, number];
  charRange?: [number, number];
  /** Each distinct text seen, when the plugin's output changes between runs. */
  variants?: string[];
  rounds: number;
  mcp: McpServer[];
  warnings: string[];
  claudeVersion?: string;
};

export function summariseMcp(servers: McpServer[]): string[] {
  return servers
    .filter((s) => s.status !== "connected")
    .map((s) => `MCP server ${s.name} did not connect (${s.status}), so its tools are not counted.`);
}

/** Measures one plugin. Pass a counter for token counts; without one no login or usage is needed. */
export async function measurePlugin(opts: {
  pluginDir: string;
  base: CapturedRequest;
  counter?: Counter;
  rounds?: number;
  timeoutMs?: number;
  captureOptions?: CaptureOptions;
  /** The plugin's path as Claude Code sees it, when that differs from pluginDir. */
  visiblePluginDir?: string;
}): Promise<PluginResult> {
  const rounds = opts.rounds ?? DEFAULT_ROUNDS;
  const measured: Added[] = [];
  let mcp: McpServer[] = [];
  let claudeVersion: string | undefined;

  for (let i = 0; i < rounds; i++) {
    const result = await capture({ ...opts.captureOptions, pluginDir: opts.pluginDir, timeoutMs: opts.timeoutMs });
    if (!result.ok) return { status: "failed", reason: result.reason, rounds, mcp: [], warnings: [] };
    measured.push(diffRequests(opts.base, result.request, { pluginDir: opts.visiblePluginDir ?? opts.pluginDir }));
    mcp = result.mcp;
    claudeVersion = result.claudeVersion;
  }

  const added = measured[0]!;
  const common = { added, rounds, mcp, warnings: summariseMcp(mcp), claudeVersion };

  if (measured.every((m) => sameAdded(m, added))) {
    return { status: "ok", ...common, tokens: opts.counter ? await opts.counter.count(added.text) : undefined };
  }

  const chars = measured.map((m) => m.chars);
  const charRange: [number, number] = [Math.min(...chars), Math.max(...chars)];
  const distinct = [...new Set(measured.map((m) => m.text))];
  if (!opts.counter) return { status: "varies", ...common, charRange, variants: distinct };
  const tokens: number[] = [];
  for (const text of distinct) tokens.push(await opts.counter.count(text));
  return { status: "varies", ...common, charRange, variants: distinct, range: [Math.min(...tokens), Math.max(...tokens)] };
}
