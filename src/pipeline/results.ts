import type { SectionKind } from "../diff.js";
import type { McpServer } from "../types.js";

const SHA = /^[0-9a-f]{40}$/;
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const MAX_TEXT_CHARS = 500_000;
const KINDS: SectionKind[] = ["listing", "hook", "tools", "system", "other"];
const OFFICIAL_MARKETPLACE = "claude-plugins-official";

export type CatalogSource = string | { source: string; url?: string; path?: string; sha?: string };
export type CatalogEntry = { pluginId: string; name: string; installCount?: number; marketplaceName: string; source: CatalogSource };
export type PluginEntry = { id: string; name: string; installs: number | null; repo: string; path: string; commit: string; ownProject?: boolean };

/** The published rule: the official marketplace's most-installed plugins, by Claude Code's own count. */
export function selectTop(catalog: CatalogEntry[], count: number): CatalogEntry[] {
  return catalog
    .filter((p) => p.marketplaceName === OFFICIAL_MARKETPLACE && typeof p.installCount === "number")
    .sort((a, b) => b.installCount! - a.installCount! || a.name.localeCompare(b.name))
    .slice(0, count);
}

export function pluginFromCatalog(entry: CatalogEntry, marketplace: { repo: string; commit: string }): PluginEntry {
  const base = { id: entry.pluginId, name: entry.name, installs: entry.installCount ?? null };
  if (typeof entry.source === "string") {
    return { ...base, repo: marketplace.repo, path: entry.source.replace(/^\.\//, ""), commit: marketplace.commit };
  }
  return { ...base, repo: entry.source.url ?? "", path: entry.source.path ?? "", commit: entry.source.sha ?? "" };
}

type ManifestSource = Record<string, unknown>;

/** A strict:false marketplace entry defines the plugin itself, so its folder has no manifest of its own. */
export function manifestFromMarketplace(marketplace: { plugins?: (ManifestSource & { name?: unknown })[] }, name: string): ManifestSource | undefined {
  const entry = marketplace.plugins?.find((p) => p.name === name);
  if (!entry) return undefined;
  const { source: _source, category: _category, strict: _strict, tags: _tags, ...manifest } = entry;
  return manifest;
}

/** Removes a manifest's dependencies, so a plugin can be measured alone. Returns what was removed. */
export function withoutDependencies(manifest: ManifestSource): { manifest: ManifestSource; removed: string[] } {
  const { dependencies, ...rest } = manifest;
  if (!Array.isArray(dependencies) || dependencies.length === 0) return { manifest, removed: [] };
  const removed = dependencies.map((d: unknown) => (typeof d === "string" ? d : String((d as { name?: unknown })?.name ?? "unknown")));
  return { manifest: rest, removed };
}

export function validatePluginEntry(entry: PluginEntry): void {
  if (!SAFE_NAME.test(entry.name)) throw new Error(`unsafe plugin name: ${entry.name}`);
  if (!SHA.test(entry.commit)) throw new Error(`${entry.name}: commit must be a full SHA, got "${entry.commit}"`);
  if (!entry.repo.startsWith("https://")) throw new Error(`${entry.name}: repo must be https, got "${entry.repo}"`);
  if (entry.path.split("/").includes("..") || entry.path.startsWith("/")) throw new Error(`${entry.name}: unsafe path "${entry.path}"`);
}

export type CaptureSection = { kind: SectionKind; text: string };
export type Capture = {
  name: string;
  status: "ok" | "varies" | "failed";
  reason?: string;
  sections: CaptureSection[];
  chars: number;
  charRange?: [number, number];
  variants: string[];
  mcp: McpServer[];
  warnings: string[];
  needsConfig?: boolean;
  claudeVersion: string;
  rounds: number;
};

/** Captures come from jobs that ran untrusted plugin code, so nothing about them is assumed. */
export function validateCapture(value: unknown, expectedName: string): Capture {
  if (!value || typeof value !== "object") throw new Error("capture is not an object");
  const c = value as Capture;
  if (c.name !== expectedName) throw new Error(`capture is for "${String(c.name)}", expected "${expectedName}"`);
  if (!["ok", "varies", "failed"].includes(c.status)) throw new Error(`unknown status: ${String(c.status)}`);
  if (!Array.isArray(c.sections) || !Array.isArray(c.variants) || !Array.isArray(c.mcp) || !Array.isArray(c.warnings)) {
    throw new Error("capture has a missing list");
  }
  let size = 0;
  for (const s of c.sections) {
    if (!KINDS.includes(s?.kind) || typeof s.text !== "string") throw new Error("capture has a malformed section");
    size += s.text.length;
  }
  for (const v of c.variants) {
    if (typeof v !== "string") throw new Error("capture has a malformed variant");
    size += v.length;
  }
  if (size > MAX_TEXT_CHARS) throw new Error(`capture text is too large: ${size} characters`);
  if (typeof c.claudeVersion !== "string" || typeof c.chars !== "number") throw new Error("capture is missing its version or size");
  return c;
}

export type ResultSummary = {
  id: string;
  name: string;
  installs: number | null;
  repo: string;
  path: string;
  commit: string;
  status: Capture["status"];
  reason?: string;
  tokens?: number;
  range?: [number, number];
  chars?: number;
  charRange?: [number, number];
  /** True when part of the plugin could not run in a clean session, so the real cost may be higher. */
  minimum: boolean;
  sections: { kind: SectionKind; chars: number }[];
  mcp: McpServer[];
  warnings: string[];
  claudeVersion: string;
  countModel: string;
  measuredAt: string;
  ownProject?: boolean;
};

export function buildResult(
  entry: PluginEntry,
  capture: Capture,
  counted: { tokens?: number; range?: [number, number] },
  meta: { countModel: string; measuredAt: string },
): ResultSummary {
  const failed = capture.status === "failed";
  return {
    id: entry.id,
    name: entry.name,
    installs: entry.installs,
    repo: entry.repo,
    path: entry.path,
    commit: entry.commit,
    status: capture.status,
    ...(capture.reason ? { reason: capture.reason } : {}),
    ...(counted.tokens !== undefined ? { tokens: counted.tokens } : {}),
    ...(counted.range ? { range: counted.range } : {}),
    ...(failed ? {} : { chars: capture.chars }),
    ...(capture.charRange ? { charRange: capture.charRange } : {}),
    minimum: capture.needsConfig === true || capture.mcp.some((s) => s.status !== "connected"),
    sections: capture.sections.map((s) => ({ kind: s.kind, chars: s.text.length })),
    mcp: capture.mcp,
    warnings: capture.warnings,
    claudeVersion: capture.claudeVersion,
    ...meta,
    ...(entry.ownProject ? { ownProject: true } : {}),
  };
}
