# Token counting check

Date: 2026-11-01. Claude Code 2.1.316, macOS, counting on haiku. Command: `npm run build && node scripts/verify-count.mjs`.

"Real session adds" is the median of 3 real sessions with only that plugin on, minus the median of 3 with no plugins. "Counted from capture" is the median of 3 plugin-free sessions with the captured text in the prompt, minus the median of 3 without it. The tolerance is 2% or 10 tokens, whichever is larger.

| plugin | real session adds | counted from capture | difference | result |
| --- | --- | --- | --- | --- |
| superpowers | 2178 | 2175 | -3 | PASS |
| ui-ux-pro-max | 1183 | 1177 | -6 | PASS |
| ralph-loop | 88 | 89 | 1 | PASS |

Three plugins on one machine. Not yet checked: MCP plugins and Linux.

## Linux

The Capture workflow ran on Ubuntu with Claude Code 2.1.316 in containers. Added text sizes matched the Mac exactly on the four plugins that exist in both:

| plugin | added characters on Mac | added characters on Linux |
| --- | --- | --- |
| superpowers | 6,329 | 6,329 |
| claude-md-management | 472 | 472 |
| skill-creator | 350 | 350 |
| ralph-loop | 180 | 180 |

The first full capture exposed four errors, all fixed before any result was published: Claude Code's own MCP state notices were counted against plugins, startup hook output and multi-line agent descriptions were misclassified, marketplace-defined plugins failed to load under `--plugin-dir`, and first-run downloads could decide an MCP plugin's result.

## Clean checkout

A fresh clone of commit 4a5f83b, built with the README's steps, reproduced the published figures for the four plugins installed on the test Mac. Added characters were identical on all four.

| plugin | published | reproduced | result |
| --- | --- | --- | --- |
| superpowers | 2180 | 2177 | PASS |
| claude-md-management | 174 | 174 | PASS |
| skill-creator | 115 | 109 | PASS |
| ralph-loop | 88 | 85 | PASS |
