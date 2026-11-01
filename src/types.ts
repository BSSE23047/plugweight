/** The parts of a Messages API request that plugweight compares. */
export type CapturedRequest = {
  model: string;
  system: unknown;
  tools: unknown[];
  messages: unknown[];
};

export type McpServer = { name: string; status: string };

export type CaptureResult =
  | { ok: true; request: CapturedRequest; claudeVersion: string; mcp: McpServer[] }
  | { ok: false; reason: string };
