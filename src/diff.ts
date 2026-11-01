import type { CapturedRequest } from "./types.js";

export type SectionKind = "listing" | "hook" | "tools" | "system" | "other";
export type Section = { kind: SectionKind; text: string };
export type Added = { sections: Section[]; text: string; chars: number };

const HOOK_MARKER = /\bhook additional context:/;
const LISTING_LINE = /^- [\w.-]+:[\w.-]+(:\s|$)/;
const DEFERRED_TOOL_LINE = /^mcp__[\w-]+__[\w-]+$/;
const TEMP_PATH = /plugweight-(?:config|cwd)-[A-Za-z0-9]+/g;

/** Lines of `next` that are not part of a longest common subsequence with `prev`, with their positions. */
function addedLines(prev: string[], next: string[]): { line: string; index: number }[] {
  const rows = prev.length + 1;
  const cols = next.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = prev.length - 1; i >= 0; i--) {
    for (let j = next.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        prev[i] === next[j]
          ? table[(i + 1) * cols + j + 1]! + 1
          : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
    }
  }
  const added: { line: string; index: number }[] = [];
  let i = 0;
  let j = 0;
  while (j < next.length) {
    if (i < prev.length && prev[i] === next[j]) {
      i++;
      j++;
    } else if (i < prev.length && table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) {
      i++;
    } else {
      added.push({ line: next[j]!, index: j });
      j++;
    }
  }
  return added;
}

function textOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textOf);
  if (value && typeof value === "object") {
    const block = value as { text?: unknown; content?: unknown };
    if (typeof block.text === "string") return [block.text];
    if (block.content !== undefined) return textOf(block.content);
  }
  return [];
}

function toLines(blocks: string[], normalise: (s: string) => string): string[] {
  return blocks.flatMap((b) => normalise(b).split("\n"));
}

function appendSection(sections: Section[], kind: SectionKind, text: string): void {
  const last = sections.at(-1);
  if (last && last.kind === kind) last.text += `\n${text}`;
  else sections.push({ kind, text });
}

function classifyInto(sections: Section[], added: { line: string; index: number }[], fallback: SectionKind): void {
  let inHook = false;
  let previousIndex = -2;
  for (const { line, index } of added) {
    if (index !== previousIndex + 1) inHook = false;
    previousIndex = index;
    if (HOOK_MARKER.test(line)) inHook = true;
    let kind: SectionKind = fallback;
    if (inHook) kind = "hook";
    else if (LISTING_LINE.test(line)) kind = "listing";
    else if (DEFERRED_TOOL_LINE.test(line)) kind = "tools";
    appendSection(sections, kind, line);
  }
}

type NamedTool = { name?: string; description?: string };

function diffTools(base: unknown[], next: unknown[], normalise: (s: string) => string): string[] {
  const known = new Map((base as NamedTool[]).map((t) => [t.name, t]));
  const out: string[] = [];
  for (const tool of next as NamedTool[]) {
    const before = known.get(tool.name);
    if (!before) {
      out.push(normalise(JSON.stringify(tool)));
    } else if (before.description !== tool.description) {
      const lines = addedLines(
        normalise(before.description ?? "").split("\n"),
        normalise(tool.description ?? "").split("\n"),
      );
      if (lines.length > 0) out.push(lines.map((l) => l.line).join("\n"));
    }
  }
  return out;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Everything `withPlugin` sends that `base` does not. Text the plugin removed is not counted. */
export function diffRequests(base: CapturedRequest, withPlugin: CapturedRequest, ctx: { pluginDir?: string } = {}): Added {
  const pluginPath = ctx.pluginDir ? new RegExp(escapeForRegExp(ctx.pluginDir), "g") : undefined;
  const normalise = (text: string) => {
    const withoutTemp = text.replace(TEMP_PATH, "<temp>");
    return pluginPath ? withoutTemp.replace(pluginPath, "<plugin>") : withoutTemp;
  };

  const sections: Section[] = [];
  classifyInto(sections, addedLines(toLines(textOf(base.system), normalise), toLines(textOf(withPlugin.system), normalise)), "system");
  classifyInto(sections, addedLines(toLines(textOf(base.messages), normalise), toLines(textOf(withPlugin.messages), normalise)), "other");
  for (const text of diffTools(base.tools, withPlugin.tools, normalise)) sections.push({ kind: "tools", text });

  const text = sections.map((s) => s.text).join("\n");
  return { sections, text, chars: text.length };
}

/** True when two measurements of one plugin added the same text. */
export function sameAdded(a: Added, b: Added): boolean {
  return a.text === b.text;
}
