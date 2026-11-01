import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COUNT_PROMPT = "Reply with exactly: ok";
const COUNT_MODEL = "haiku";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RUNS = 3;

export type Usage = {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export function withinTolerance(measured: number, expected: number): boolean {
  return Math.abs(measured - expected) <= Math.max(0.02 * expected, 10);
}

export function promptTokens(usage: Usage): number {
  return (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function tokensFromRuns(arm: number[], baseline: number[]): number {
  return Math.max(0, median(arm) - median(baseline));
}

/** No tools and no plugins: the counted text is untrusted, so the model must not be able to act on it. */
export function buildCountArgs(installedPluginIds: string[]): string[] {
  const settings = {
    enabledPlugins: Object.fromEntries(installedPluginIds.map((id) => [id, false])),
    disableAllHooks: true,
  };
  return [
    "-p",
    "--model", COUNT_MODEL,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--output-format", "json",
    "--settings", JSON.stringify(settings),
  ];
}

export function buildCountInput(text: string): string {
  return text === "" ? COUNT_PROMPT : `${COUNT_PROMPT}\n\n${text}`;
}

/** Ids of installed plugins, so counting can switch them all off. */
export function installedPluginIds(claudeBin = "claude"): string[] {
  const result = spawnSync(claudeBin, ["plugin", "list", "--json"], { encoding: "utf8", timeout: 30_000, maxBuffer: 1 << 26 });
  if (result.error || result.status !== 0) {
    throw new Error(`could not list installed plugins: ${result.error?.message ?? result.stderr}`);
  }
  return (JSON.parse(result.stdout) as { id: string }[]).map((p) => p.id);
}

type CountRun = { tokens: number; model: string };

function runOnce(claudeBin: string, args: string[], input: string, timeoutMs: number): Promise<CountRun> {
  const cwd = mkdtempSync(join(tmpdir(), "plugweight-count-"));
  return new Promise<CountRun>((resolve, reject) => {
    const child = spawn(claudeBin, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`token count timed out after ${timeoutMs / 1000} s`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`could not start Claude Code: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let result: { is_error?: boolean; result?: string; usage?: Usage; modelUsage?: Record<string, unknown> };
      try {
        result = JSON.parse(stdout);
      } catch {
        reject(new Error(`Claude Code exited with ${code}: ${stderr.slice(-300).trim()}`));
        return;
      }
      if (result.is_error || !result.usage) {
        reject(new Error(`token count failed: ${String(result.result ?? stderr).slice(0, 300)}`));
        return;
      }
      resolve({ tokens: promptTokens(result.usage), model: Object.keys(result.modelUsage ?? {})[0] ?? COUNT_MODEL });
    });
    child.stdin.end(input);
  }).finally(() => rmSync(cwd, { recursive: true, force: true }));
}

export type CountOptions = { timeoutMs?: number; runs?: number; claudeBin?: string; pluginIds?: string[] };

/**
 * Real tokens for text a plugin added, without loading the plugin. Uses the user's login and a
 * little of their usage: the same plugin-free session is run with and without the text.
 */
export async function countTokens(text: string, opts: CountOptions = {}): Promise<{ tokens: number; model: string; claudeVersion: string }> {
  const claudeBin = opts.claudeBin ?? "claude";
  const args = buildCountArgs(opts.pluginIds ?? installedPluginIds(claudeBin));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runs = opts.runs ?? DEFAULT_RUNS;

  const collect = async (input: string): Promise<CountRun[]> => {
    const out: CountRun[] = [];
    for (let i = 0; i < runs; i++) out.push(await runOnce(claudeBin, args, input, timeoutMs));
    return out;
  };
  const baseline = await collect(buildCountInput(""));
  const arm = text === "" ? baseline : await collect(buildCountInput(text));

  const version = spawnSync(claudeBin, ["--version"], { encoding: "utf8", timeout: 15_000 }).stdout?.trim().split(/\s+/)[0] ?? "unknown";
  return {
    tokens: tokensFromRuns(arm.map((r) => r.tokens), baseline.map((r) => r.tokens)),
    model: arm[0]?.model ?? COUNT_MODEL,
    claudeVersion: version,
  };
}
