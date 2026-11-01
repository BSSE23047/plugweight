// Writes plugins.json from Claude Code's own catalog, using the rule in SELECTION.md.
// Usage: npm run build && node scripts/select-plugins.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginFromCatalog, selectTop, validatePluginEntry } from "../dist/pipeline/results.js";

const TOP = 25;
const OFFICIAL = "https://github.com/anthropics/claude-plugins-official.git";
const OWN = "https://github.com/BSSE23047/nauraiz-dev.git";

const headOf = (repo) => execFileSync("git", ["ls-remote", repo, "HEAD"], { encoding: "utf8" }).split(/\s/)[0];

const config = mkdtempSync(join(tmpdir(), "plugweight-select-"));
const env = { ...process.env, CLAUDE_CONFIG_DIR: config };
delete env.CLAUDECODE;
execFileSync("claude", ["plugin", "marketplace", "add", "anthropics/claude-plugins-official"], { env, stdio: "ignore" });
const listed = spawnSync("claude", ["plugin", "list", "--available", "--json"], { env, encoding: "utf8", maxBuffer: 1 << 28 });
rmSync(config, { recursive: true, force: true });
const catalog = JSON.parse(listed.stdout).available;

const marketplace = { repo: OFFICIAL, commit: headOf(OFFICIAL) };
const plugins = selectTop(catalog, TOP).map((entry) => pluginFromCatalog(entry, marketplace));
plugins.push({ id: "nauraiz-dev@nauraiz-dev", name: "nauraiz-dev", installs: null, repo: OWN, path: "", commit: headOf(OWN), ownProject: true });
plugins.forEach(validatePluginEntry);

const version = execFileSync("claude", ["--version"], { encoding: "utf8" }).trim().split(/\s+/)[0];
const output = { snapshot: new Date().toISOString().slice(0, 10), claudeVersion: version, rule: "SELECTION.md", plugins };
writeFileSync("plugins.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`${plugins.length} plugins written to plugins.json`);
