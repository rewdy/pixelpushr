import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { handleError } from "../../apps/api/src/http/errors";
import { parseJsonBody } from "../../apps/api/src/http/validation";

describe("request validation", () => {
  const app = new Hono();
  app.onError(handleError);
  app.post("/example", async (context) => {
    const body = await parseJsonBody(context, z.object({ title: z.string().min(1) }));
    return context.json(body);
  });

  test("returns a stable field-level error for invalid payloads", async () => {
    const response = await app.request("/example", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "" }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request", message: "Request validation failed", details: [{ path: "title", message: "Too small: expected string to have >=1 characters" }] } });
  });

  test("rejects malformed JSON", async () => {
    const response = await app.request("/example", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request", message: "Expected a valid JSON body" } });
  });
});
