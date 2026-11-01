// Turns the Capture workflow's artifacts into committed results. No plugin code runs here: it only
// reads captured text, and counts it in plugin-free, tool-free sessions. Uses a little of your usage.
// Usage: npm run build && node scripts/count-results.mjs <artifacts-dir> [plugin-name ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCounter } from "../dist/count.js";
import { buildResult, validateCapture, validatePluginEntry } from "../dist/pipeline/results.js";

const [artifacts, ...only] = process.argv.slice(2);
const { plugins } = JSON.parse(readFileSync("plugins.json", "utf8"));
const counter = createCounter();
const measuredAt = new Date().toISOString().slice(0, 10);
mkdirSync("data/results", { recursive: true });
mkdirSync("data/added", { recursive: true });

for (const entry of plugins) {
  if (only.length > 0 && !only.includes(entry.name)) continue;
  validatePluginEntry(entry);
  const file = join(artifacts, `capture-${entry.name}`, `${entry.name}.json`);
  if (!existsSync(file)) {
    console.log(`${entry.name}: no capture, skipped`);
    continue;
  }
  const capture = validateCapture(JSON.parse(readFileSync(file, "utf8")), entry.name);

  const counted = {};
  if (capture.status === "ok") {
    counted.tokens = await counter.count(capture.sections.map((s) => s.text).join("\n"));
  } else if (capture.status === "varies") {
    const tokens = [];
    for (const text of capture.variants) tokens.push(await counter.count(text));
    counted.range = [Math.min(...tokens), Math.max(...tokens)];
  }

  const summary = buildResult(entry, capture, counted, { countModel: counter.model, measuredAt });
  writeFileSync(join("data/results", `${entry.name}.json`), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join("data/added", `${entry.name}.json`), `${JSON.stringify({ sections: capture.sections }, null, 2)}\n`);
  console.log(`${entry.name}: ${capture.status} ${counted.tokens ?? counted.range ?? capture.reason ?? ""}`);
}
