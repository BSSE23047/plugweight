"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { figureText, rank, shareOf, weightOf, type Entry, type SectionKind, type SortKey } from "@/lib/format";

const BAR: Record<SectionKind, string> = {
  hook: "var(--bar-hook)",
  listing: "var(--bar-listing)",
  tools: "var(--bar-other)",
  system: "var(--bar-other)",
  other: "var(--bar-other)",
};

function Bar({ entry, max, index }: { entry: Entry; max: number; index: number }) {
  const width = max === 0 ? 0 : Math.max((weightOf(entry) / max) * 100, 0.6);
  const shares = shareOf(entry);
  return (
    <div className="weigh flex h-3" style={{ width: `${width}%`, ["--i" as string]: index }} aria-hidden>
      {shares.length === 0 ? <span className="w-full" style={{ background: "var(--bar-other)" }} /> : null}
      {shares.map((s) => (
        <span key={s.kind} style={{ width: `${s.share * 100}%`, background: BAR[s.kind] }} />
      ))}
    </div>
  );
}

const installsText = (n: number | null) => (n === null ? "" : `${n.toLocaleString("en-US")} installs`);

export function Leaderboard({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("weight");

  const { ranked, unmeasured } = useMemo(() => rank(entries, sort), [entries, sort]);
  const max = Math.max(0, ...ranked.map(weightOf));
  const matches = (e: Entry) => e.name.toLowerCase().includes(query.trim().toLowerCase());
  const shown = ranked.filter(matches);
  const shownUnmeasured = unmeasured.filter(matches);

  return (
    <section aria-label="Plugins by session cost">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 border-b border-ink pb-1 sm:w-72">
          <MagnifyingGlass size={16} aria-hidden />
          <span className="sr-only">Search plugins</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-2"
          />
        </label>
        <div className="flex gap-4 text-sm" role="group" aria-label="Sort by">
          {(["weight", "installs"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
              className={sort === key ? "font-medium text-ink underline underline-offset-4" : "text-ink-2 hover:text-ink"}
            >
              {key === "weight" ? "Heaviest first" : "Most installed"}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && shownUnmeasured.length === 0 ? (
        <p className="py-12 text-ink-2">{entries.length === 0 ? "No results have been published yet." : `Nothing matches "${query}".`}</p>
      ) : null}

      <ol>
        {shown.map((entry, i) => (
          <li key={entry.id}>
            <Link href={`/plugin/${entry.name}`} className="group block py-3 transition-colors hover:bg-paper-2 md:-mx-3 md:px-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate font-medium group-hover:underline group-hover:underline-offset-4">
                  {entry.name}
                  {entry.ownProject ? <span className="ml-2 text-xs font-normal text-ink-2">the author&apos;s own</span> : null}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">{figureText(entry)}</span>
              </div>
              <Bar entry={entry} max={max} index={i} />
              <div className="mt-1 text-xs text-ink-2">{installsText(entry.installs)}</div>
            </Link>
          </li>
        ))}
      </ol>

      {shownUnmeasured.length > 0 ? (
        <div className="mt-10">
          <h3 className="mb-2 text-sm font-medium">Needs setup or could not be measured</h3>
          <ul className="text-sm text-ink-2">
            {shownUnmeasured.map((entry) => (
              <li key={entry.id} className="py-1">
                <Link className="underline underline-offset-2 hover:text-ink" href={`/plugin/${entry.name}`}>{entry.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
