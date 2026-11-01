# plugweight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure and publish what each Claude Code plugin really adds to a session, through a CLI, a leaderboard site and a badge.

**Architecture:** A local stub of the Messages API captures Claude Code's first request with and without a plugin. A pure diff classifies what was added. A separate plugin-free step counts its tokens. The CLI and the leaderboard pipeline share those three modules; the site is a static render of committed JSON.

**Tech Stack:** TypeScript, Node 20+, vitest, GitHub Actions with Docker, Next.js static export on Vercel.

**Spec:** `docs/superpowers/specs/2026-11-01-plugweight-design.md` (moves into the repo in Task 1)

## Global Constraints

- Package and repo name `plugweight`; repo `BSSE23047/plugweight`; MIT licence.
- Commits as `Nauraiz Haider <bsse23047@itu.edu.pk>`, set per repo before the first commit.
- No number typed by hand: every published figure comes from a committed result file.
- Other people's plugin code never runs on Nauraiz's Mac or anywhere holding a real credential.
- Copy never implies lighter is better, never claims to be a safety review, says it is independent, and uses no Anthropic branding.
- `--offline` output never presents characters as tokens.
- A plugin that fails to load is reported as failed, never as zero.
- The user's real Claude config is never changed.
- No public repo, npm publish, deployment or post happens without the approval points named below.

## Review Focus

- A real `ANTHROPIC_*` credential or base URL in the user's environment: capture must strip it and only ever talk to the stub.
- A hook that hangs or a plugin that crashes on load: reported as failed after a timeout, and the run continues with the next plugin.
- `claude` missing or not logged in: a clear message; `--offline` still works without a login.
- Added text too large for a command line: counting passes it on stdin.
- Random temp paths in captured text: normalised before diffing, so they cannot produce a false "varies" result.

---

### Task 1: Repo, stub and capture

**Files:**
- Create: `plugweight/package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `.github/workflows/ci.yml`
- Create: `src/stub.ts`, `src/capture.ts`, `src/types.ts`
- Move: spec and this plan into `plugweight/docs/superpowers/`
- Test: `test/stub.test.ts`, `test/capture.integration.test.ts`

**Interfaces:**
- Produces: `startStub(): Promise<Stub>` where `Stub = { url: string; requests(): CapturedRequest[]; reset(): void; close(): Promise<void> }`
- Produces: `capture(opts: { pluginDir?: string; timeoutMs?: number }): Promise<CaptureResult>`, where `CaptureResult = { ok: true; request: CapturedRequest; claudeVersion: string } | { ok: false; reason: string }`
- Produces: `CapturedRequest = { system: unknown; tools: unknown[]; messages: unknown[]; model: string }`

- [ ] **Step 1:** `git init` in `Work/github repos/plugweight`, set the repo's commit identity, add the scaffold. The GitHub repo is not created yet.
- [ ] **Step 2:** Write failing tests. Stub: a streaming POST to `/v1/messages` returns a valid SSE message and is recorded; a non-streaming POST returns JSON; other paths return 404 and are not recorded. Capture: `buildCaptureEnv(env, stubUrl, configDir)` removes `ANTHROPIC_AUTH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`, and overrides `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL`.
- [ ] **Step 3:** Run `npx vitest run`. Expected: FAIL, modules missing.
- [ ] **Step 4:** Implement, carrying over the working approach from the spike: a temporary `CLAUDE_CONFIG_DIR` removed afterwards, an empty temporary working directory, `claude -p "Reply with exactly: ok" --model claude-haiku-5-5 --output-format json --no-session-persistence`, and the telemetry-disable variables. Pick the request that carries tools. Default timeout 90 s, then kill and return `{ ok: false }`.
- [ ] **Step 5:** Integration test (skipped unless `RUN_INTEGRATION=1`): capturing superpowers three times gives identical added length. Run it. Expected: PASS.
- [ ] **Step 6:** Commit.

### Task 2: Diff and classify

**Files:** Create `src/diff.ts`; Test `test/diff.test.ts`

**Interfaces:**
- Consumes: `CapturedRequest`
- Produces: `diffRequests(base: CapturedRequest, withPlugin: CapturedRequest, ctx: { pluginDir?: string }): Added`
- Produces: `Added = { sections: { kind: "listing" | "hook" | "tools" | "system" | "other"; text: string }[]; text: string; chars: number }`
- Produces: `sameAdded(a: Added, b: Added): boolean`

- [ ] **Step 1:** Write failing tests with small handmade requests: text present only with the plugin is returned; a `SessionStart hook additional context:` block has kind `hook`; lines in the skills listing have kind `listing`; a new tool definition has kind `tools`; identical requests give `chars: 0`; temp config paths and the plugin directory are normalised, so two captures differing only by those paths satisfy `sameAdded`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Compare at text-block level, then line level within a changed block, so unchanged lines never count as added.
- [ ] **Step 4:** Run. Expected: PASS. Also run on the spike's captured files and confirm superpowers yields both `listing` and `hook` sections.
- [ ] **Step 5:** Commit.

### Task 3: Token counting check (STOP POINT)

**Files:** Create `src/count.ts`, `scripts/verify-count.ts`; Test `test/count.test.ts`

**Interfaces:**
- Consumes: `Added.text`
- Produces: `countTokens(text: string, opts?: { timeoutMs?: number }): Promise<{ tokens: number; model: string; claudeVersion: string }>`
- Produces: `withinTolerance(measured: number, expected: number): boolean`, true when the difference is at most `max(0.02 * expected, 10)`

- [ ] **Step 1:** Write failing unit tests. `withinTolerance(2176, 2200)` is true, `withinTolerance(2100, 2176)` is false, `withinTolerance(84, 93)` is true, `withinTolerance(84, 95)` is false. `buildCountArgs` disables all tools, sends text on stdin and uses no plugins.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Run `claude -p --model haiku --tools "" --strict-mcp-config --no-session-persistence --output-format json` with every installed plugin disabled through `--settings`, in an empty folder. Stdin is `Reply with exactly: ok\n\n<text>` for the arm and `Reply with exactly: ok` for the baseline. Tokens are the difference in input + cache write + cache read, using a median of 3 for each arm.
- [ ] **Step 4:** Run unit tests. Expected: PASS.
- [ ] **Step 5:** `scripts/verify-count.ts` captures, diffs and counts superpowers, ui-ux-pro-max and ralph-loop, then compares against freshly measured real-run figures (the spike's 2,176, 1,176 and 84 are the reference, and any baseline change from a new Claude Code version is re-measured). Run it. Expected: all three within tolerance.
- [ ] **Step 6:** **If any plugin fails tolerance after checking the code for bugs, stop and take the design's "Open decision" to Nauraiz.** Do not continue to Task 4 and do not widen the tolerance.
- [ ] **Step 7:** Commit, with the script's output recorded in `docs/verification/`.

### Task 4: Awkward plugins

**Files:** Create `test/fixtures/plugin-mcp/`, `test/fixtures/plugin-varying-hook/`, `test/fixtures/plugin-broken/`, `src/measure.ts`; Test `test/measure.integration.test.ts`

**Interfaces:**
- Consumes: `capture`, `diffRequests`, `sameAdded`, `countTokens`
- Produces: `measurePlugin(opts: { pluginDir: string; base: CapturedRequest; count: boolean; rounds?: number }): Promise<PluginResult>`
- Produces: `PluginResult = { status: "ok" | "varies" | "failed"; reason?: string; added?: Added; tokens?: number; range?: [number, number]; rounds: number }`

- [ ] **Step 1:** Write failing integration tests. The MCP fixture's tool definitions appear as kind `tools` or, if Claude Code defers them, the deferred listing is what gets measured, and the test records which. The varying hook gives `status: "varies"` with a range. The broken and hanging fixtures give `status: "failed"` with a reason and no tokens. A plugin that adds nothing gives `status: "ok"`, `tokens: 0`.
- [ ] **Step 2:** Run with `RUN_INTEGRATION=1`. Expected: FAIL.
- [ ] **Step 3:** Implement with `rounds` defaulting to 3.
- [ ] **Step 4:** Run. Expected: PASS. If MCP behaviour contradicts the design's metric definition, note it in the spec and tell Nauraiz.
- [ ] **Step 5:** Commit.

### Task 5: Command-line tool

**Files:** Create `src/cli.ts`, `src/installed.ts`, `src/report.ts`; Test `test/report.test.ts`, `test/installed.test.ts`, `test/cli.test.ts`

**Interfaces:**
- Consumes: `measurePlugin`, `startStub`, `capture`
- Produces: `listInstalled(): Promise<{ id: string; name: string; version: string; dir: string; enabled: boolean }[]>`
- Produces: `renderTable(rows: { name: string; result: PluginResult }[], opts: { offline: boolean }): string`

- [ ] **Step 1:** Write failing tests. The table sorts heaviest first and has a total; failed plugins display `failed` and are left out of the total; offline output contains `chars` and never the word `tokens`; the ranking output includes the line "A heavier plugin may be worth it."; `--json` emits valid JSON; `claude` missing exits non-zero with an install hint; the usage notice prints before any counting; `why <plugin>` prints the added text for that plugin, and an unknown plugin exits non-zero listing the installed names.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `plugweight`, `plugweight why <plugin>`, `--offline`, `--json`, with `bin` in `package.json`.
- [ ] **Step 4:** Run tests, then the built CLI on the seven installed plugins. Expected: tests PASS; superpowers, ui-ux-pro-max and ralph-loop match Task 3; real `~/.claude` is unchanged, by comparing a checksum of `settings.json` before and after.
- [ ] **Step 5:** Commit. **Approval point:** with this working, create the public repo `BSSE23047/plugweight` and push. The approved design covers this step.

### Task 6: Leaderboard pipeline

**Files:** Create `plugins.yaml`, `SELECTION.md`, `pipeline/Dockerfile`, `pipeline/capture-one.ts`, `pipeline/count-results.ts`, `.github/workflows/capture.yml`, `data/results/`; Test `test/pipeline.test.ts`

**Interfaces:**
- Consumes: `startStub`, `diffRequests`, `sameAdded`, `countTokens`
- Produces: `data/results/<plugin>.json` containing `{ id, repo, commit, status, tokens?, range?, sections, claudeVersion, countModel, measuredAt, ownProject? }`

- [ ] **Step 1:** Write failing tests. Result files are validated against the schema; malformed or oversized capture JSON is rejected; `plugins.yaml` entries must have a full commit SHA; `ownProject` is set for `nauraiz-dev`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The workflow uses `permissions: contents: read`, no secrets, and a matrix with one fresh container per plugin. Claude Code runs in the container at a pinned version; the stub runs outside it. Each job uploads only captured JSON. `count-results.ts` runs locally on those artifacts and never executes plugin code.
- [ ] **Step 4:** Write the mechanical selection rule in `SELECTION.md` and fill `plugins.yaml` with about 25 plugins.
- [ ] **Step 5:** Run tests and the workflow on Linux for the three reference plugins. Expected: tests PASS; the added text matches Mac, or the difference is explained in `docs/verification/`.
- [ ] **Step 6:** Run the full list, count locally, and commit the results. Check each result against its captured text before accepting it.
- [ ] **Step 7:** Commit.

### Task 7: Website and badge

**Files:** Create `site/` (Next.js static export), including `site/src/lib/results.ts` and `site/public/badge/<plugin>.json` generated at build; Test `site/test/results.test.ts`

**Interfaces:**
- Consumes: `data/results/*.json`
- Produces: `loadResults(): PluginEntry[]` and `badgeFor(entry): { schemaVersion: 1; label: "session cost"; message: string; color: string }`

- [ ] **Step 1:** Write failing tests. `badgeFor` on 2176 tokens gives `2.2k tokens`; `failed` and `varies` entries get honest messages and no number that reads as exact; the ranking excludes failed entries; each entry links to its method data.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Build the homepage: search, ranking and the "may be worth it" framing, in a distinctive visual direction, using a design skill. **Approval point:** show Nauraiz the homepage before anything goes public, and apply the feedback.
- [ ] **Step 4:** Build the plugin page (breakdown, added text, method, date) and a method page covering caching, limits and independence.
- [ ] **Step 5:** Run tests and `next build`, and check at phone and desktop widths in the browser. Expected: PASS, no errors, no horizontal scrolling.
- [ ] **Step 6:** Commit.

### Task 8: Release

**Files:** Create `README.md`, `CHANGELOG.md`, `docs/launch/x.md`, `docs/launch/linkedin.md`

- [ ] **Step 1:** Write an evidence-first README with real numbers, the method, known limits and what is unverified.
- [ ] **Step 2:** Reproduce one result from a clean checkout using only the README. Expected: matches the published number within tolerance.
- [ ] **Step 3:** Run the whole test suite and CI. Expected: green on macOS and Linux.
- [ ] **Step 4:** **Nauraiz's steps:** log in and publish to npm, and connect Vercel if that needs a login. Claude prepares the commands and never handles those credentials.
- [ ] **Step 5:** Draft the X and LinkedIn posts from committed results. **Approval point:** Nauraiz approves each post, the portfolio and GitHub profile fixes, and any report about the `details` hook label.
- [ ] **Step 6:** Commit.
