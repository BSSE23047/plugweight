import type { Metadata } from "next";
import { REPO_URL } from "@/lib/results";

export const metadata: Metadata = { title: "Method", description: "How plugweight measures what a Claude Code plugin adds to a session." };

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mt-12 font-display text-2xl font-bold tracking-tight">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 max-w-[65ch] leading-relaxed text-ink-2">{children}</p>;

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-8">
      <h1 className="pt-10 font-display text-5xl font-bold tracking-tight md:text-6xl">Method</h1>
      <P>
        The figure is what enabling one plugin alone adds to the first request of a session, compared with no plugins, in an empty folder with a clean config.
      </P>

      <H2>Capture</H2>
      <P>
        Claude Code runs against a local stand-in for the Messages API, using a dummy key. Nothing is sent to a model. Each plugin runs three times in throwaway containers on GitHub Actions, with no secrets, so other people&apos;s code cannot reach a real credential. The stand-in stays outside the container.
      </P>

      <H2>Compare</H2>
      <P>
        The requests with and without the plugin are compared line by line. What was added is sorted by where it lands: the skill and agent list, text injected by hooks, and tool names. Each plugin page shows that exact text.
      </P>

      <H2>Count</H2>
      <P>
        Characters do not convert to tokens reliably, so the captured text is counted in real sessions with no plugins and no tools, with and without the text, using the median of three. No plugin code runs at this step. This method matched real sessions to within 6 tokens on the three plugins it was checked against.{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${REPO_URL}/blob/main/docs/verification/2026-11-01-count-check.md`}>See the check</a>.
      </P>

      <H2>What the figure leaves out</H2>
      <P>
        It covers session start only. MCP tool schemas that load on demand, and skill bodies that load when invoked, are not included. The text is re-sent on each turn but mostly as cached input, so a session&apos;s real cost depends on its length and caching, and is not this figure times the number of turns.
      </P>
      <P>
        A plugin that needs a sign-in or its own settings cannot fully run in a clean session. Those figures say &quot;at least&quot;. Figures belong to the Claude Code version shown, and other models may count slightly differently.
      </P>

      <H2>Which plugins are listed</H2>
      <P>
        The 25 most-installed plugins in Claude Code&apos;s official marketplace, using the install counts Claude Code itself reports, plus the author&apos;s own plugin, labelled as such. The{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${REPO_URL}/blob/main/SELECTION.md`}>rule</a>{" "}and the{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${REPO_URL}/blob/main/plugins.json`}>pinned list</a>{" "}are public.
      </P>

      <H2>Rerun it yourself</H2>
      <P>
        Everything here is open source, and every result names the commit it measured. Results and captured text are in the{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${REPO_URL}/tree/main/data`}>data folder</a>. If a figure looks wrong, please{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${REPO_URL}/issues`}>open an issue</a>. That includes plugin authors who would like their captured text removed.
      </P>
    </main>
  );
}
