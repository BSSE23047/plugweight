# plugweight

See what each Claude Code plugin really adds to every session. Measured, not estimated.

Every plugin you install adds text to your sessions: skill lists, hook messages, tool names. That text uses your tokens before you have asked for anything. plugweight shows how much, and exactly what it is.

```text
plugweight · Claude Code 2.1.316 · counted on claude-haiku-5-5

Plugin                Added per session  Where it lands
-------------------------------------------------------
superpowers                2,177 tokens  hook 54% · listing 46%
ui-ux-pro-max              1,176 tokens  listing 100%
brag                         260 tokens  listing 100%
claude-md-management         173 tokens  listing 100%
skill-creator                110 tokens  listing 100%
ralph-loop                    83 tokens  listing 100%
agents-hub                    45 tokens  listing 100%
-------------------------------------------------------
Total                      4,024 tokens
```

That is the author's real setup, on 2026-11-01. **A heavier plugin may be worth it.** plugweight shows what a plugin adds, not whether it is good.

This is an independent project, not made by or affiliated with Anthropic.

## Results

The 25 most-installed plugins in Claude Code's official marketplace, plus the author's own. Measured 2026-11-01 on Claude Code 2.1.316. Every result, and the exact text behind it, is in [data/](data/). The rule for what is listed is in [SELECTION.md](SELECTION.md).

| Plugin | Installs | Tokens added per session |
| --- | --- | --- |
| vercel | 292,985 | at least 8,079 |
| figma | 184,171 | at least 2,445 |
| superpowers | 1,123,984 | 2,180 |
| pr-review-toolkit | 123,475 | 2,160 |
| chrome-devtools-mcp | 123,586 | 1,903 |
| slack | 111,919 | at least 1,480 |
| nauraiz-dev | the author's own | 1,202 |
| atlassian | 105,141 | at least 1,077 |
| frontend-design (the most installed) | 1,266,133 | 76 |

"At least" means part of the plugin needs a sign-in or its own settings, so its real cost may be higher. Two plugins need setup before they can be measured at all, and are listed that way rather than as zero.

The website is coming shortly.

## Try it

Needs Node 20 or newer and [Claude Code](https://code.claude.com).

```bash
npx plugweight
```

Or from source:

```bash
git clone https://github.com/BSSE23047/plugweight
cd plugweight
npm ci
npm run build
node dist/cli.js
```

| Command | What it does | Uses your usage? |
| --- | --- | --- |
| `plugweight` | Measures your installed plugins, heaviest first | A little: a few short sessions per plugin |
| `plugweight --offline` | Same, but shows characters instead of tokens | No, and needs no login |
| `plugweight why <plugin>` | Prints the exact text a plugin adds | No |
| `plugweight --json` | Prints results as JSON, without the added text | Same as the mode it runs in |

## How it measures

**Session overhead** is what enabling one plugin alone adds to the first request, compared with no plugins, in an empty folder with a clean config.

1. **Capture.** The command-line tool starts a local stand-in for the Messages API and runs `claude -p` against it with a temporary config and a dummy key, once with no plugins and three times with each plugin. No real credential is involved and those requests stay on your machine.
2. **Diff.** It compares the requests and sorts what was added: the skill and agent listing, text injected by hooks, and tool names.
3. **Count.** Characters do not convert to tokens reliably (2.15 to 2.9 per token across three plugins), so it counts for real: plugin-free, tool-free `claude -p` sessions with and without the added text, medians of three, using your login. Claude Code's reported input tokens give the difference.

## How accurate it is

The counting method was checked against real sessions with only that plugin on ([results and method](docs/verification/2026-11-01-count-check.md)):

| Plugin | A real session adds | Counted from capture | Difference |
| --- | --- | --- | --- |
| superpowers | 2,178 | 2,175 | -3 |
| ui-ux-pro-max | 1,183 | 1,177 | -6 |
| ralph-loop | 88 | 89 | +1 |

That check covers three plugins, on a Mac, with Claude Code 2.1.316. Added text was the same size on Mac and on Linux for the four plugins measured on both. Numbers from a fresh clone stayed within tolerance of the published ones for the same four.

Most other published figures come from the same method and have not been compared with a real session of that plugin. If one looks wrong, please [open an issue](https://github.com/BSSE23047/plugweight/issues).

## How the leaderboard runs

Published plugins are other people's code, so they never run on the author's machine. The [Capture workflow](.github/workflows/capture.yml) runs each one in throwaway containers on GitHub Actions with no secrets and read-only permissions, and the stand-in stays outside the container. [`scripts/count-results.mjs`](scripts/count-results.mjs) then counts the captured text with no plugin code running.

Before measuring, each throwaway copy may be adjusted so the plugin can load alone: marketplace-defined plugins get a manifest from their marketplace entry, and dependencies are removed from the manifest. A plugin with dependencies is labelled, and its figure covers only its own additions.

## How this differs from `claude plugin details`

Claude Code's built-in command is free and instant, and gives a useful per-skill breakdown. Its figure is a projection, though. For superpowers 7.0.0 it projects about 848 always-on tokens and labels the SessionStart hook as having no model context cost, while the hook's text does appear in the request and the measured total is about 2,177. For the plugins above without injected hook text, the two closely agree.

## Known limits

- **It measures session start only.** MCP tool schemas that load on demand and skill bodies that load when invoked are not included.
- **It is not simply multiplied per turn.** This text is re-sent on each turn but mostly as cached input, so a session's real cost depends on its length and caching.
- **A plugin's own settings are missing in a clean session.** Parts that depend on them may not run, and plugweight warns when that applies, so the figure may be low.
- **Plugin hooks run during measurement**, as they do in your own sessions. Only run it on plugins you trust. A result is not a safety review.
- **Counting runs on haiku.** Other models may count slightly differently.
- **Numbers belong to a Claude Code version.** The baseline changes as Claude Code changes.

A plugin that fails to load is reported as failed, never as zero. Hook output that changes between runs is shown as a range.

## Development

```bash
npm test
RUN_INTEGRATION=1 npm test
```

The integration tests need Claude Code installed but no login. They run real sessions against the local stand-in.

## Licence

MIT. See [LICENSE](LICENSE).
