import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyCommand } from "@/components/CopyCommand";
import { figureText, KIND_LABELS, shareOf } from "@/lib/format";
import { loadAdded, loadEntry, loadResults, SITE_URL } from "@/lib/results";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadResults().map((e) => ({ name: e.name }));
}

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const entry = loadEntry(name);
  if (!entry) return {};
  const figure = entry.status === "failed" ? "could not be measured" : `adds ${figureText(entry)} tokens to every session`;
  return { title: name, description: `${name} ${figure}. Measured with plugweight.` };
}

function sourceUrl(repo: string, commit: string, path: string): string {
  const base = repo.replace(/\.git$/, "");
  return path ? `${base}/tree/${commit}/${path}` : `${base}/tree/${commit}`;
}

export default async function PluginPage({ params }: Props) {
  const { name } = await params;
  const entry = loadEntry(name);
  if (!entry) notFound();
  const added = loadAdded(name);
  const shares = shareOf(entry);
  const badge = `[![session cost](https://img.shields.io/endpoint?url=${encodeURIComponent(`${SITE_URL}/badge/${name}.json`)})](${SITE_URL}/plugin/${name})`;

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-8">
      <p className="pt-6 text-sm"><Link href="/" className="text-ink-2 underline underline-offset-2 hover:text-ink">All plugins</Link></p>

      <section className="pb-12 pt-8">
        <h1 className="break-words font-display text-4xl font-bold tracking-tight md:text-6xl">{name}</h1>
        {entry.ownProject ? <p className="mt-2 text-sm text-ink-2">This is the author&apos;s own plugin, measured the same way as the rest.</p> : null}
        <p className="mt-8 font-mono text-5xl tabular-nums tracking-tight md:text-7xl">{figureText(entry)}</p>
        <p className="mt-2 text-ink-2">
          {entry.status === "failed" ? entry.reason : entry.status === "varies" ? "tokens added per session. The text changes between runs, so this is a range." : "tokens added per session"}
        </p>
        {shares.length > 0 ? (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {shares.map((s) => (
              <div key={s.kind}>
                <dt className="text-ink-2">{KIND_LABELS[s.kind]}</dt>
                <dd className="font-mono tabular-nums">{Math.round(s.share * 100)}% of the text</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {entry.minimum || entry.warnings.length > 0 ? (
        <section className="mb-12 max-w-[70ch] border-l-2 border-accent pl-4 text-sm leading-relaxed">
          <p className="font-medium">This figure may be low.</p>
          {entry.minimum ? <p className="mt-1 text-ink-2">Part of this plugin could not run in a clean session with no sign-in or settings, so its real cost may be higher.</p> : null}
          {entry.warnings.map((w) => <p key={w} className="mt-1 text-ink-2">{w}</p>)}
        </section>
      ) : null}

      <section className="grid gap-12 md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold tracking-tight">What it adds</h2>
          {added.length === 0 ? (
            <p className="mt-4 text-ink-2">{entry.status === "failed" ? "Nothing was captured." : "This plugin adds no text to the start of a session."}</p>
          ) : (
            added.map((section, i) => (
              <div key={`${section.kind}-${i}`} className="mt-6">
                <h3 className="mb-2 text-sm font-medium">{KIND_LABELS[section.kind]}</h3>
                <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words bg-paper-2 p-4 font-mono text-xs leading-relaxed">{section.text}</pre>
              </div>
            ))
          )}
          {entry.mcp.length > 0 ? <p className="mt-4 max-w-[65ch] text-sm text-ink-2">MCP tool schemas load on demand and are not included. Only what is sent at session start is.</p> : null}
        </div>

        <aside className="space-y-6 text-sm">
          <dl className="space-y-3">
            <div><dt className="text-ink-2">Installs</dt><dd className="font-mono tabular-nums">{entry.installs?.toLocaleString("en-US") ?? "Not in the install count"}</dd></div>
            <div><dt className="text-ink-2">Measured</dt><dd className="font-mono">{entry.measuredAt}</dd></div>
            <div><dt className="text-ink-2">Claude Code</dt><dd className="font-mono">{entry.claudeVersion}</dd></div>
            <div><dt className="text-ink-2">Counted on</dt><dd className="font-mono">{entry.countModel}</dd></div>
            <div><dt className="text-ink-2">Source commit</dt><dd className="font-mono"><a className="underline underline-offset-2 hover:text-ink" href={sourceUrl(entry.repo, entry.commit, entry.path)}>{entry.commit.slice(0, 12)}</a></dd></div>
          </dl>
          {entry.status !== "failed" ? (
            <div>
              <p className="mb-2 text-ink-2">Add this badge to your README</p>
              <CopyCommand command={badge} label={`Copy the badge markdown for ${name}`} />
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
