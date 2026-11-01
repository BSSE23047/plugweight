// Checks the counting method against real sessions: for each plugin, the tokens counted from
// captured text must match the tokens a real session adds. Uses a little of your usage.
// Usage: npm run build && node scripts/verify-count.mjs [plugin@marketplace ...]
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture } from "../dist/capture.js";
import { countTokens, installedPluginIds, median, promptTokens, withinTolerance } from "../dist/count.js";
import { diffRequests } from "../dist/diff.js";

const DEFAULTS = [
  "superpowers@claude-plugins-official",
  "ui-ux-pro-max@ui-ux-pro-max-skill",
  "ralph-loop@claude-plugins-official",
];
const REAL_RUNS = 3;

const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULTS;
const listed = JSON.parse(spawnSync("claude", ["plugin", "list", "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout);
const pluginIds = installedPluginIds();

function realRun(enabledId) {
  const enabledPlugins = Object.fromEntries(pluginIds.map((id) => [id, id === enabledId]));
  const cwd = mkdtempSync(join(tmpdir(), "plugweight-real-"));
  const r = spawnSync(
    "claude",
    ["-p", "Reply with exactly: ok", "--model", "haiku", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config", "--settings", JSON.stringify({ enabledPlugins })],
    { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 1 << 26 },
  );
  rmSync(cwd, { recursive: true, force: true });
  const result = JSON.parse(r.stdout);
  if (result.is_error) throw new Error(`real run failed: ${result.result}`);
  return promptTokens(result.usage);
}
const realMedian = (id) => median(Array.from({ length: REAL_RUNS }, () => realRun(id)));

const base = await capture({});
if (!base.ok) throw new Error(`baseline capture failed: ${base.reason}`);
const realBaseline = realMedian(null);

console.log(`Claude Code ${base.claudeVersion}. Real baseline: ${realBaseline} tokens. Tolerance: 2% or 10 tokens, whichever is larger.\n`);
console.log("plugin | real session adds | counted from capture | difference | added chars | sections | result");
let failures = 0;
for (const id of targets) {
  const plugin = listed.find((p) => p.id === id);
  if (!plugin) throw new Error(`not installed: ${id}`);
  const withPlugin = await capture({ pluginDir: plugin.installPath });
  if (!withPlugin.ok) throw new Error(`capture failed for ${id}: ${withPlugin.reason}`);
  const added = diffRequests(base.request, withPlugin.request, { pluginDir: plugin.installPath });
  const { tokens } = await countTokens(added.text, { pluginIds });
  const real = realMedian(id) - realBaseline;
  const pass = withinTolerance(tokens, real);
  if (!pass) failures++;
  const sections = added.sections.map((s) => `${s.kind}:${s.text.length}`).join(" ");
  console.log(`${id.split("@")[0]} | ${real} | ${tokens} | ${tokens - real} | ${added.chars} | ${sections} | ${pass ? "PASS" : "FAIL"}`);
}
console.log(failures === 0 ? "\nAll within tolerance." : `\n${failures} outside tolerance.`);
process.exit(failures === 0 ? 0 : 1);
