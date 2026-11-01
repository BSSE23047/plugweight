// Captures one plugin from plugins.json in throwaway containers. Meant for the Capture workflow:
// this runs the plugin's code, so never run it where a real credential is available.
// Usage: node scripts/capture-one.mjs <plugin-name> <output-dir>
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { capture } from "../dist/capture.js";
import { measurePlugin } from "../dist/measure.js";
import { manifestFromMarketplace, validatePluginEntry, withoutDependencies } from "../dist/pipeline/results.js";

const [name, outDir] = process.argv.slice(2);
const { plugins } = JSON.parse(readFileSync("plugins.json", "utf8"));
const entry = plugins.find((p) => p.name === name);
if (!entry) throw new Error(`not in plugins.json: ${name}`);
validatePluginEntry(entry);

const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
const clone = mkdtempSync(join(tmpdir(), "plugweight-clone-"));
git(["init", "-q"], clone);
git(["remote", "add", "origin", entry.repo], clone);
git(["fetch", "-q", "--depth", "1", "origin", entry.commit], clone);
git(["checkout", "-q", "FETCH_HEAD"], clone);
const pluginDir = resolve(clone, entry.path);

// Fix up this throwaway copy so the plugin can load alone. The upstream repo is not changed.
const manifestPath = join(pluginDir, ".claude-plugin/plugin.json");
const marketplacePath = join(clone, ".claude-plugin/marketplace.json");
const notes = [];
if (!existsSync(manifestPath) && existsSync(marketplacePath)) {
  const manifest = manifestFromMarketplace(JSON.parse(readFileSync(marketplacePath, "utf8")), name);
  if (manifest) {
    mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}
let needsConfig = false;
if (existsSync(manifestPath)) {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    needsConfig = Object.keys(parsed.userConfig ?? {}).length > 0;
    const { manifest, removed } = withoutDependencies(parsed);
    if (removed.length > 0) {
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      notes.push(`Depends on ${removed.join(", ")}. This figure covers only its own additions, so using it costs at least that much more.`);
    }
  } catch {
    // A corrupt manifest shows up as a failed capture.
  }
}

const cache = mkdtempSync(join(tmpdir(), "plugweight-cache-"));
process.env.PLUGWEIGHT_CACHE = cache;
execFileSync("chmod", ["-R", "a+rwX", clone, cache]);

const captureOptions = { claudeBin: resolve("pipeline/claude-in-docker.sh"), stubHost: "0.0.0.0", timeoutMs: 180_000 };
const base = await capture(captureOptions);
if (!base.ok) throw new Error(`baseline failed: ${base.reason}`);

// Two sessions fill the download cache, so a first-run download cannot decide the measurement.
for (let i = 0; i < 2; i++) await capture({ ...captureOptions, pluginDir });

const result = await measurePlugin({ pluginDir, base: base.request, captureOptions, timeoutMs: 180_000, visiblePluginDir: "/plugweight-under-test" });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({
  name,
  status: result.status,
  ...(result.reason ? { reason: result.reason } : {}),
  sections: result.added?.sections ?? [],
  chars: result.added?.chars ?? 0,
  ...(result.charRange ? { charRange: result.charRange } : {}),
  variants: result.variants ?? [],
  mcp: result.mcp,
  warnings: [...result.warnings, ...notes],
  ...(needsConfig ? { needsConfig: true } : {}),
  claudeVersion: base.claudeVersion,
  rounds: result.rounds,
}, null, 2));
console.log(`${name}: ${result.status}, ${result.added?.chars ?? 0} chars, ${result.reason ?? ""}`);
