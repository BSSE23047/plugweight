import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type InstalledPlugin = { id: string; name: string; version: string; dir: string; enabled: boolean; needsConfig?: boolean };

type ListEntry = { id?: string; version?: string; enabled?: boolean; installPath?: string; hasUserConfig?: boolean };

export function parsePluginList(json: string): InstalledPlugin[] {
  const entries = JSON.parse(json) as ListEntry[];
  if (!Array.isArray(entries)) throw new Error("unexpected output from claude plugin list");
  const byId = new Map<string, InstalledPlugin>();
  for (const entry of entries) {
    if (!entry.id || !entry.installPath) continue;
    const plugin: InstalledPlugin = {
      id: entry.id,
      name: entry.id.split("@")[0] ?? entry.id,
      version: entry.version ?? "unknown",
      dir: entry.installPath,
      enabled: entry.enabled === true,
      ...(entry.hasUserConfig ? { needsConfig: true } : {}),
    };
    const existing = byId.get(plugin.id);
    if (!existing || (!existing.enabled && plugin.enabled)) byId.set(plugin.id, plugin);
  }
  return [...byId.values()];
}

export async function listInstalled(claudeBin = "claude"): Promise<InstalledPlugin[]> {
  const { stdout } = await run(claudeBin, ["plugin", "list", "--json"], { maxBuffer: 1 << 26, timeout: 30_000 });
  return parsePluginList(stdout);
}
