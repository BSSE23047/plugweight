# plugweight: design

Date: 2026-11-01. Status: awaiting Nauraiz's approval. Nothing is built or published yet. This file moves into the repo when the repo is created.

## In one line

Bundlephobia for Claude Code plugins: it shows what a plugin really adds to every session, measured rather than estimated.

## Why

Nauraiz wants a public project in the Claude ecosystem that people use and that gets noticed. Plugins are ranked today by installs and stars. Nobody publishes a comparable, reproducible number for what each one costs. Usage limits are a common complaint, so developers have a reason to care.

Claude Code has `claude plugin details`, which projects a plugin's token cost, so an estimate alone adds nothing. Our value is measuring what is actually sent, and publishing a comparison anyone can rerun.

## What the spike found

Run on 2026-11-01 with Claude Code 2.1.316 on one Mac, using three plugins that were already installed. The spike scripts were throwaway and are not part of this design's code.

| Plugin | Measured added tokens (real runs, median of 4) | `claude plugin details` estimate | Added characters (offline capture) |
| --- | --- | --- | --- |
| superpowers | 2,176 | ~848 | 6,438 |
| ui-ux-pro-max | 1,176 | ~1,169 | 2,998 |
| ralph-loop | 84 | ~86 | 184 |

1. **Real runs are stable.** Across 4 rounds per plugin, the prompt size varied by 8 tokens or fewer. The prompt size was input + cache write + cache read from the result's usage. One run with haiku was reported as about $0.0023.
2. **Measuring catches what the estimate misses.** `details` labels superpowers' SessionStart hook "harness-only — no model context cost", yet the hook's text is in the first request. That likely accounts for most of the roughly 1,300 token gap. The two plugins without injected hook text matched the estimate closely.
3. **Capture works offline.** With `ANTHROPIC_BASE_URL` pointed at a local stub, a dummy key and an empty `CLAUDE_CONFIG_DIR`, `claude -p --plugin-dir <dir>` sent its full first request to the stub and nothing else reached the stub. Sizes were byte-identical across 3 rounds. So capture needs no account, costs nothing and exposes no credential.
4. **Characters do not convert to tokens reliably.** Added characters per token ranged from 2.15 to 2.9 across the three plugins, so a character-based estimate is not good enough to publish.

Not yet tested: a plugin with MCP servers, a plugin whose hook output changes between runs, Linux, and the counting method in "How it measures" step 3.

## Goals

- `npx plugweight` shows a developer what each of their installed plugins adds per session, with a breakdown and the exact added text.
- A public leaderboard compares popular plugins using one published method.
- A README badge lets plugin authors show their number and links back to the plugin's page.
- Every published number can be rerun by anyone with one documented command.

## Non-goals (first version)

- Judging whether a plugin is good. Whether it improves results comes later, probably on top of `claude plugin eval`, which already supports a no-plugin baseline. Results vary between runs, so that needs repeats and real usage.
- Any harness other than Claude Code.
- An LLM deciding anything. Everything is scripted.
- Security vetting. The site says plainly that a listing is not a safety review.

## Anti-goals

These would make it a failure even if it works:

- Shaming authors, or implying a lighter plugin is better. A heavy plugin may be worth it, and the copy says so on every ranking.
- Any number typed by hand or that cannot be reproduced.
- Running other people's plugin code anywhere that holds a real credential.
- Looking official or using Anthropic branding. The site says it is an independent project.
- A default-looking UI. Nauraiz rejects those.

## The metric

**Session overhead** is the tokens added to the first request by enabling one plugin alone, compared with no plugins, in an empty folder with a clean config.

The page always publishes alongside it: the Claude Code version, the plugin's pinned commit, the model used for counting and the measurement date.

The overhead is re-sent on each turn, but mostly as cached input, so it is not simply multiplied by the turn count. The site explains this rather than quoting a scary multiplied figure.

Each plugin is also broken down by where its tokens land: skill and agent listing, hook-injected text, and tool definitions. Where it can be obtained, the `details` estimate and the per-skill on-invoke cost are shown as well.

## How it measures

1. **Capture (offline, runs plugin code).** Start a local stub of the Messages API and run `claude -p` with an empty config and `--plugin-dir`. Save the first full request. Do this for the baseline and for each plugin, three times each.
2. **Diff.** Compare each plugin's request with the baseline and classify what was added. If the three captures differ, the plugin is marked "varies" and shows a range.
3. **Count (no plugin code runs).** Turn the added text into a token count without loading the plugin: send it as the prompt of a plugin-free, tool-free `claude -p` on the user's normal login, and subtract the same run's baseline. Disabling tools matters because the captured text is untrusted. **This method is untested. It is the first thing to build.** It must match the real-run figures above within 2% or 10 tokens, whichever is larger. If it does not, stop and bring the options to Nauraiz (see "Open decision").

## The three parts

### Command-line tool: `npx plugweight`

- Lists installed plugins and prints each one's added tokens and breakdown, sorted heaviest first, with a total.
- `plugweight why <plugin>` prints the exact text the plugin adds.
- `plugweight --offline` skips counting and uses no login or usage. It shows added characters and text, and never presents them as tokens.
- `--json` for scripts and CI.
- Tells the user before using any of their usage. A count costs a fraction of a cent of usage by the spike's figures.
- Never changes the user's real Claude config. It uses a temporary config directory and removes it afterwards. Plugin hooks do run, as they already do in the user's sessions, and the README says so.
- A plugin that fails to load is reported as failed. It never appears as zero.

### Leaderboard website

- Static site reading committed JSON, with no backend: search, ranking, and a page per plugin with its breakdown, added text, method and date.
- Nauraiz sees the homepage design and approves it before it goes public.

### Badge

A shields.io endpoint served from the site's JSON, for example `session cost: 2.2k tokens`, linking to the plugin's page.

## Running other people's plugins safely

Plugin hooks and MCP servers are arbitrary code. Leaderboard captures therefore run on GitHub Actions in a throwaway container per plugin, with no secrets and read-only permissions. The stub runs outside the container, so a plugin cannot tamper with the record of what was sent. Only the captured JSON leaves the job, and later steps treat it as untrusted data. Counting then runs separately, from that JSON, without plugin code.

They do not run on Nauraiz's Mac. Plugins already installed there are the exception, for the command-line tool only.

Counting needs a login, so in the first version Nauraiz runs that step locally and commits the result. Automating it is a later step.

## Which plugins are listed

- `plugins.yaml` in the repo, one entry per plugin with a pinned commit. Anyone can propose one by pull request.
- The first list is about 25 plugins: the official marketplace's plugins, plus the most-starred community ones. The exact rule is published beside the list, so the selection is not hand-picked.
- Each plugin is measured alone at its pinned commit. A plugin that depends on another is labelled, and its number covers only its own additions. A plugin that needs configuration to load is listed as "needs setup", without a number.
- `nauraiz-dev` is included and labelled as the author's own.
- Results are refreshed on a schedule and when a new Claude Code version changes the baseline.

## How it gets made (Claude's calls, open to veto)

- Name: `plugweight`. It was free on npm and turned up nothing in a GitHub search on 2026-11-01. The site's domain is decided at launch, starting with a free Vercel subdomain.
- TypeScript on Node 20+, published to npm, tested with vitest. Minimal runtime dependencies, so `npx` stays fast.
- Next.js static export on Vercel, matching Nauraiz's usual stack.
- Public repo `BSSE23047/plugweight`, MIT licence, commits as `Nauraiz Haider <bsse23047@itu.edu.pk>`, CI on macOS and Linux.
- Evidence-first README in the style of `nauraiz-dev`: real numbers, known limits, what is unverified.

## Done means

- The counting check in "How it measures" step 3 passes.
- Stability is rechecked on Linux, and the baseline subtraction gives the same plugin numbers there as on Mac, or the difference is explained on the site.
- A fixture plugin with an MCP server and one with varying hook output both produce correct, honestly labelled results.
- `npx plugweight` works on Nauraiz's seven installed plugins.
- About 25 plugins are published with reproducible numbers, and one has been reproduced from a clean checkout using only the README.

## Launch

Claude drafts the X and LinkedIn posts from the real results. Nothing goes out until Nauraiz approves each one. Likewise, anything raised with the Claude Code team about the `details` hook label, and the portfolio and GitHub profile fixes, are shown to Nauraiz first. Before posting, each plugin's result is checked against its own captured text so a measurement bug does not end up attached to someone's project in public.

## Open decision

If the counting method in step 3 fails its check, the choices are an Anthropic API key used only for token counting, or real runs of each plugin (which would bring back the credential risk unless they use a separate limited key). This goes to Nauraiz at that point, because Nauraiz prefers not to depend on API keys.

## Left to the builder

File layout, stub implementation details, classifying added text, the exact JSON schema, the refresh schedule, the exact wording of the plugin selection rule (it must be mechanical and published), and the site's visual design up to the homepage approval.
