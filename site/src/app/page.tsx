import { CopyCommand } from "@/components/CopyCommand";
import { Leaderboard } from "@/components/Leaderboard";
import { KIND_LABELS } from "@/lib/format";
import { loadResults } from "@/lib/results";

export default function Home() {
  const entries = loadResults();
  const measuredAt = entries.map((e) => e.measuredAt).sort().at(-1);
  const version = entries[0]?.claudeVersion;

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-8">
      <section className="pb-12 pt-10 md:pb-16 md:pt-16">
        <h1 className="max-w-[16ch] font-display text-5xl font-bold leading-[0.98] tracking-tight md:text-7xl">
          What your Claude Code plugins really weigh.
        </h1>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-2">
          Every plugin adds text to every session before you ask for anything. These are measured figures, not estimates.
        </p>
        <div className="mt-8">
          <CopyCommand command="npx plugweight" label="Copy the command npx plugweight" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_260px] md:gap-16">
        <Leaderboard entries={entries} />
        <aside className="order-first text-sm leading-relaxed text-ink-2 md:order-last md:sticky md:top-8 md:self-start">
          <p className="font-medium text-ink">Tokens added per session</p>
          <p className="mt-2">
            The bar shows where they land. A heavier plugin may be worth it: this shows what it adds, not whether it is good.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 md:block md:space-y-2">
            <li className="flex items-center gap-2"><span className="h-3 w-3" style={{ background: "var(--bar-hook)" }} aria-hidden />{KIND_LABELS.hook}</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3" style={{ background: "var(--bar-listing)" }} aria-hidden />{KIND_LABELS.listing}</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3" style={{ background: "var(--bar-other)" }} aria-hidden />{KIND_LABELS.tools}</li>
          </ul>
          {measuredAt ? <p className="mt-3">Measured {measuredAt} on Claude Code {version}.</p> : null}
        </aside>
      </section>
    </main>
  );
}
