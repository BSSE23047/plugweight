import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Entry, SectionKind } from "./format";

const DATA = resolve(process.cwd(), "..", "data");

/** Every published figure comes from these committed files. Nothing on the site is typed by hand. */
export function loadResults(): Entry[] {
  const dir = join(DATA, "results");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Entry);
}

export function loadEntry(name: string): Entry | undefined {
  return loadResults().find((e) => e.name === name);
}

export function loadAdded(name: string): { kind: SectionKind; text: string }[] {
  const file = join(DATA, "added", `${name}.json`);
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, "utf8")) as { sections: { kind: SectionKind; text: string }[] }).sections;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://plugweight.vercel.app";
export const REPO_URL = "https://github.com/BSSE23047/plugweight";
