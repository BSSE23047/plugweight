export type SectionKind = "listing" | "hook" | "tools" | "system" | "other";

export type Entry = {
  id: string;
  name: string;
  installs: number | null;
  repo: string;
  path: string;
  commit: string;
  status: "ok" | "varies" | "failed";
  reason?: string;
  tokens?: number;
  range?: [number, number];
  chars?: number;
  charRange?: [number, number];
  minimum: boolean;
  sections: { kind: SectionKind; chars: number }[];
  mcp: { name: string; status: string }[];
  warnings: string[];
  claudeVersion: string;
  countModel: string;
  measuredAt: string;
  ownProject?: boolean;
};

export type SortKey = "weight" | "installs";

const number = (n: number) => n.toLocaleString("en-US");

export function shortTokens(n: number): string {
  if (n < 1000) return String(n);
  const thousands = n / 1000;
  return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
}

/** Zero with part of the plugin unable to run says nothing about its real cost. */
export function needsSetup(entry: Entry): boolean {
  return entry.status === "ok" && entry.minimum && (entry.tokens ?? 0) === 0;
}

export function figureText(entry: Entry): string {
  if (entry.status === "failed") return "Not measured";
  if (needsSetup(entry)) return "Needs setup";
  if (entry.range) return `${number(entry.range[0])}-${number(entry.range[1])}`;
  return `${entry.minimum ? "at least " : ""}${number(entry.tokens ?? 0)}`;
}

/** A single neutral colour on purpose: a heavier plugin is not a worse one. */
export function badgeFor(entry: Entry): { schemaVersion: 1; label: string; message: string; color: string } {
  let message: string;
  if (entry.status === "failed") message = "not measured";
  else if (needsSetup(entry)) message = "needs setup";
  else if (entry.range) message = `${entry.range[0]}-${entry.range[1]} tokens`;
  else message = `${shortTokens(entry.tokens ?? 0)}${entry.minimum ? "+" : ""} tokens`;
  return { schemaVersion: 1, label: "session cost", message, color: "555" };
}

export function weightOf(entry: Entry): number {
  return entry.range?.[1] ?? entry.tokens ?? 0;
}

export function rank(entries: Entry[], by: SortKey = "weight"): { ranked: Entry[]; unmeasured: Entry[] } {
  const isUnmeasured = (e: Entry) => e.status === "failed" || needsSetup(e);
  const measured = entries.filter((e) => !isUnmeasured(e));
  const compare = by === "weight"
    ? (a: Entry, b: Entry) => weightOf(b) - weightOf(a)
    : (a: Entry, b: Entry) => (b.installs ?? -1) - (a.installs ?? -1);
  return { ranked: [...measured].sort(compare), unmeasured: entries.filter(isUnmeasured) };
}

export function shareOf(entry: Entry): { kind: SectionKind; share: number }[] {
  const totals = new Map<SectionKind, number>();
  for (const s of entry.sections) totals.set(s.kind, (totals.get(s.kind) ?? 0) + s.chars);
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  if (all === 0) return [];
  return [...totals.entries()]
    .map(([kind, chars]) => ({ kind, share: chars / all }))
    .sort((a, b) => b.share - a.share);
}

export const KIND_LABELS: Record<SectionKind, string> = {
  hook: "Hook text",
  listing: "Skill and agent list",
  tools: "Tool names",
  system: "System prompt",
  other: "Other",
};
