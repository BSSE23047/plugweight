import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { CapturedRequest } from "./types.js";

export type Stub = {
  url: string;
  requests(): CapturedRequest[];
  reset(): void;
  close(): Promise<void>;
};

const USAGE = { input_tokens: 1, output_tokens: 1 };

function writeStream(res: ServerResponse, model: string): void {
  const event = (name: string, data: object) => res.write(`event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`);
  res.writeHead(200, { "content-type": "text/event-stream" });
  event("message_start", {
    message: { id: "msg_stub", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: USAGE },
  });
  event("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  event("content_block_delta", { index: 0, delta: { type: "text_delta", text: "ok" } });
  event("content_block_stop", { index: 0 });
  event("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
  event("message_stop", {});
  res.end();
}

function writeJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** A local stand-in for the Messages API. It records requests and answers "ok". It never forwards anything. */
export async function startStub(opts: { host?: string } = {}): Promise<Stub> {
  let recorded: CapturedRequest[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const path = (req.url ?? "").split("?")[0];
      if (req.method !== "POST" || path !== "/v1/messages") {
        writeJson(res, 404, { type: "error", error: { type: "not_found_error", message: "stub" } });
        return;
      }
      let body: Partial<CapturedRequest> & { stream?: boolean };
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        writeJson(res, 400, { type: "error", error: { type: "invalid_request_error", message: "bad json" } });
        return;
      }
      const model = body.model ?? "stub";
      recorded.push({ model, system: body.system ?? null, tools: body.tools ?? [], messages: body.messages ?? [] });
      if (body.stream) {
        writeStream(res, model);
      } else {
        writeJson(res, 200, {
          id: "msg_stub",
          type: "message",
          role: "assistant",
          model,
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: USAGE,
        });
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, opts.host ?? "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests: () => [...recorded],
    reset: () => {
      recorded = [];
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
