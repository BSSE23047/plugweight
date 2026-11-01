# Which plugins are listed

1. **The top 25 of Claude Code's official marketplace (`claude-plugins-official`) by install count.** The counts are the ones Claude Code itself reports in `claude plugin list --available --json`, in a clean config. Ties break alphabetically. Nobody picks these by hand.
2. **`nauraiz-dev`**, the author's own plugin, labelled as such. It is outside the rule, is listed so the author's work gets the same treatment, and has no install count.

`node scripts/select-plugins.mjs` regenerates `plugins.json` by applying this rule, and pins each plugin to a full commit. Other plugins can be proposed by pull request, and are labelled as additions outside the rule.

Being listed says nothing about whether a plugin is good, or safe.
