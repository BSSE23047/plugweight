import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startStub, type Stub } from "../src/stub.js";

const body = { model: "m", system: "s", tools: [{ name: "Read" }], messages: [{ role: "user", content: "hi" }] };

describe("stub", () => {
  let stub: Stub;
  beforeEach(async () => {
    stub = await startStub();
  });
  afterEach(async () => {
    await stub.close();
  });

  const post = (path: string, payload: object) =>
    fetch(`${stub.url}${path}`, { method: "POST", body: JSON.stringify(payload) });

  it("answers a streaming request with a complete SSE message and records it", async () => {
    const res = await post("/v1/messages", { ...body, stream: true });
    const text = await res.text();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(text).toContain("event: message_start");
    expect(text).toContain("event: message_stop");
    expect(stub.requests()).toHaveLength(1);
    expect(stub.requests()[0]?.tools).toEqual([{ name: "Read" }]);
  });

  it("answers a non-streaming request with JSON", async () => {
    const res = await post("/v1/messages?beta=true", body);
    const json = (await res.json()) as { content: { text: string }[] };
    expect(json.content[0]?.text).toBe("ok");
    expect(stub.requests()).toHaveLength(1);
  });

  it("returns 404 for other paths and does not record them", async () => {
    const res = await post("/v1/messages/count_tokens", body);
    expect(res.status).toBe(404);
    expect((await fetch(`${stub.url}/v1/models`)).status).toBe(404);
    expect(stub.requests()).toHaveLength(0);
  });

  it("does not crash on a malformed body", async () => {
    const res = await fetch(`${stub.url}/v1/messages`, { method: "POST", body: "{nope" });
    expect(res.status).toBe(400);
    expect(stub.requests()).toHaveLength(0);
  });

  it("forgets recorded requests on reset", async () => {
    await post("/v1/messages", body);
    stub.reset();
    expect(stub.requests()).toHaveLength(0);
  });
});
