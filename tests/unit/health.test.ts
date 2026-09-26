import { describe, expect, test } from "bun:test";
import { createApp } from "../../apps/api/src/app";
import { readConfig } from "../../apps/api/src/config/env";

describe("health", () => {
  test("returns an API identity", async () => {
    const response = await createApp().request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "api" });
  });
  test("reports an unavailable database without serving a false healthy response", async () => {
    const app = createApp({
      db: {
        execute: async () => {
          throw new Error("connection refused");
        },
      } as never,
      auth: {} as never,
      mailer: {} as never,
      publicWebUrl: "http://127.0.0.1:5173",
    });
    const response = await app.request("/health");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      service: "api",
      dependency: "database",
    });
  });
  test("fails startup with actionable missing configuration", () => {
    expect(() =>
      readConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgres://localhost/db",
        MEDIA_STORAGE: "s3",
      }),
    ).toThrow(/AUTH_MODE.*MAIL_FROM.*MEDIA_PUBLIC_URL/);
  });
});
