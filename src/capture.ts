import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startStub } from "./stub.js";
import type { CaptureResult, CapturedRequest } from "./types.js";

const CAPTURE_PROMPT = "Reply with exactly: ok";
const CAPTURE_MODEL = "claude-haiku-5-5";
const DEFAULT_TIMEOUT_MS = 90_000;
const DUMMY_KEY = "plugweight-stub-not-a-real-key";

const ROUTING_VARS = /^(ANTHROPIC_|CLAUDE|AWS_BEARER_TOKEN_BEDROCK$|https?_proxy$|all_proxy$)/i;

/** Builds a child environment that can only reach the stub and holds no real credential. */
export function buildCaptureEnv(env: NodeJS.ProcessEnv, stubUrl: string, configDir: string): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (!ROUTING_VARS.test(key)) clean[key] = value;
  }
  return {
    ...clean,
    ANTHROPIC_BASE_URL: stubUrl,
    ANTHROPIC_API_KEY: DUMMY_KEY,
    CLAUDE_CONFIG_DIR: configDir,
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
}

/** The session's real request carries tools; side requests such as title generation do not. */
export function pickMainRequest(requests: CapturedRequest[]): CapturedRequest | undefined {
  return requests.filter((r) => r.tools.length > 0).at(-1);
}

function readVersion(claudeBin: string): string | undefined {
  const result = spawnSync(claudeBin, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (result.error || result.status !== 0) return undefined;
  return result.stdout.trim().split(/\s+/)[0];
}

type RunOutcome = { code: number | null; stderr: string; timedOut: boolean; spawnError?: string };

function runClaude(claudeBin: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<RunOutcome> {
  return new Promise((resolve) => {
    // A separate process group lets a timeout also stop hooks the plugin started.
    const child = spawn(claudeBin, args, { cwd, env, detached: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const finish = (outcome: Omit<RunOutcome, "stderr">) => {
      clearTimeout(timer);
      resolve({ ...outcome, stderr: stderr.slice(-500) });
    };
    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      // Resolve here: an orphaned hook can hold stderr open and delay "close" forever.
      finish({ code: null, timedOut: true });
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => finish({ code: null, timedOut: false, spawnError: error.message }));
    child.on("close", (code) => finish({ code, timedOut: false }));
  });
}

/** Runs one headless session against the stub and returns the request Claude Code would have sent. */
export async function capture(opts: { pluginDir?: string; timeoutMs?: number; claudeBin?: string }): Promise<CaptureResult> {
  const claudeBin = opts.claudeBin ?? "claude";
  if (opts.pluginDir !== undefined && !existsSync(opts.pluginDir)) {
    return { ok: false, reason: `plugin directory does not exist: ${opts.pluginDir}` };
  }
  const claudeVersion = readVersion(claudeBin);
  if (!claudeVersion) {
    return { ok: false, reason: `Claude Code not found: could not run "${claudeBin} --version"` };
  }

  const stub = await startStub();
  const configDir = mkdtempSync(join(tmpdir(), "plugweight-config-"));
  const cwd = mkdtempSync(join(tmpdir(), "plugweight-cwd-"));
  try {
    const args = ["-p", CAPTURE_PROMPT, "--model", CAPTURE_MODEL, "--output-format", "json", "--no-session-persistence"];
    if (opts.pluginDir !== undefined) args.push("--plugin-dir", opts.pluginDir);
    const outcome = await runClaude(claudeBin, args, cwd, buildCaptureEnv(process.env, stub.url, configDir), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    if (outcome.spawnError) return { ok: false, reason: `could not start Claude Code: ${outcome.spawnError}` };
    if (outcome.timedOut) return { ok: false, reason: `timed out after ${(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000} s` };
    if (outcome.code !== 0) return { ok: false, reason: `Claude Code exited with ${outcome.code}: ${outcome.stderr.trim()}` };

    const request = pickMainRequest(stub.requests());
    if (!request) return { ok: false, reason: "Claude Code sent no request" };
    return { ok: true, request, claudeVersion };
  } finally {
    await stub.close();
    rmSync(configDir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
}
