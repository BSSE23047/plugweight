# Token counting check

Date: 2026-11-01. Claude Code 2.1.316, macOS, counting on haiku. Command: `npm run build && node scripts/verify-count.mjs`.

"Real session adds" is the median of 3 real sessions with only that plugin on, minus the median of 3 with no plugins. "Counted from capture" is the median of 3 plugin-free sessions with the captured text in the prompt, minus the median of 3 without it. The tolerance is 2% or 10 tokens, whichever is larger.

| plugin | real session adds | counted from capture | difference | result |
| --- | --- | --- | --- | --- |
| superpowers | 2178 | 2175 | -3 | PASS |
| ui-ux-pro-max | 1183 | 1177 | -6 | PASS |
| ralph-loop | 88 | 89 | 1 | PASS |

Three plugins on one machine. Not yet checked: MCP plugins and Linux.
