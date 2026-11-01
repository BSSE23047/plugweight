import { parseArgs } from "node:util";
import { capture } from "./capture.js";
import { createCounter, type Counter } from "./count.js";
import { listInstalled, type InstalledPlugin } from "./installed.js";
import { measurePlugin, type PluginResult } from "./measure.js";
import { renderTable, renderWhy, toJson, type Row } from "./report.js";
import type { CaptureResult } from "./types.js";

const HELP = `plugweight: see what each Claude Code plugin really adds to every session.

Usage:
  plugweight                 Measure your installed plugins
  plugweight why <plugin>    Print the exact text a plugin adds (no usage)

Options:
  --offline   Use no login or usage. Shows characters, not tokens.
  --json      Print results as JSON.
  --help      Show this help.

Plugin hooks run during measurement, as they do in your own sessions.
Your Claude Code settings are never changed.`;

export type Deps = {
  listInstalled(): Promise<InstalledPlugin[]>;
  captureBase(): Promise<CaptureResult>;
  createCounter(): Counter;
  measurePlugin: typeof measurePlugin;
};

const realDeps: Deps = {
  listInstalled: () => listInstalled(),
  captureBase: () => capture({}),
  createCounter: () => createCounter(),
  measurePlugin,
};

export type Io = { out(text: string): void; err(text: string): void };

const CLAUDE_MISSING = `Could not run Claude Code. Install it with: npm install -g @anthropic-ai/claude-code`;

const NEEDS_CONFIG_WARNING = "It has its own settings, which a clean session does not have. Parts that depend on them may not have run, so this figure may be low.";

async function loadPlugins(io: Io, deps: Deps): Promise<InstalledPlugin[] | undefined> {
  try {
    return await deps.listInstalled();
  } catch (error) {
    io.err(`${CLAUDE_MISSING}\n(${(error as Error).message})`);
    return undefined;
  }
}

async function runWhy(target: string, io: Io, deps: Deps): Promise<number> {
  const plugins = await loadPlugins(io, deps);
  if (!plugins) return 1;
  const plugin = plugins.find((p) => p.id === target || p.name === target);
  if (!plugin) {
    io.err(`"${target}" is not installed. Installed plugins:\n${plugins.map((p) => `  ${p.id}`).join("\n")}`);
    return 1;
  }
  const base = await deps.captureBase();
  if (!base.ok) {
    io.err(`Could not capture a baseline session: ${base.reason}`);
    return 1;
  }
  const result = await deps.measurePlugin({ pluginDir: plugin.dir, base: base.request });
  io.out(renderWhy(plugin.name, result));
  return result.status === "failed" ? 1 : 0;
}

async function runAll(flags: { offline: boolean; json: boolean }, io: Io, deps: Deps): Promise<number> {
  const plugins = await loadPlugins(io, deps);
  if (!plugins) return 1;
  if (!flags.offline && plugins.length > 0) {
    io.err("Counting tokens uses your Claude login and a little of your usage: a few short sessions per plugin. Use --offline to skip this.");
  }
  const base = await deps.captureBase();
  if (!base.ok) {
    io.err(`Could not capture a baseline session: ${base.reason}`);
    return 1;
  }
  const counter = flags.offline ? undefined : deps.createCounter();

  const rows: Row[] = [];
  for (const [i, plugin] of plugins.entries()) {
    io.err(`Measuring ${plugin.name} (${i + 1}/${plugins.length})`);
    let result: PluginResult;
    try {
      result = await deps.measurePlugin({ pluginDir: plugin.dir, base: base.request, counter });
    } catch (error) {
      io.err(`Could not count tokens: ${(error as Error).message}\nTo measure without a login, use --offline.`);
      return 1;
    }
    if (plugin.needsConfig && result.status !== "failed") {
      result = { ...result, warnings: [...result.warnings, NEEDS_CONFIG_WARNING] };
    }
    rows.push({ id: plugin.id, name: plugin.name, enabled: plugin.enabled, result });
  }

  if (flags.json) {
    io.out(JSON.stringify(toJson(rows, { claudeVersion: base.claudeVersion, model: counter?.model }), null, 2));
  } else {
    const model = counter ? ` · counted on ${counter.model}` : "";
    io.out(`plugweight · Claude Code ${base.claudeVersion}${model}\n\n${renderTable(rows, { offline: flags.offline })}`);
  }
  return 0;
}

/** Returns the process exit code: 0 success, 1 failure, 2 wrong usage. */
export async function runCli(argv: string[], io: Io, deps: Deps = realDeps): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { offline: { type: "boolean", default: false }, json: { type: "boolean", default: false }, help: { type: "boolean", default: false } },
    });
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.out(HELP);
    return 0;
  }
  const [command, target, ...rest] = positionals;
  if (command === "why") {
    if (!target || rest.length > 0) {
      io.err("Usage: plugweight why <plugin>");
      return 2;
    }
    return runWhy(target, io, deps);
  }
  if (command !== undefined) {
    io.err(`Unknown command: ${command}\n\n${HELP}`);
    return 2;
  }
  return runAll({ offline: values.offline ?? false, json: values.json ?? false }, io, deps);
}
