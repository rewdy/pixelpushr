import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { HealthResponse } from "@pixelpushr/contracts/health";
import { handleError } from "./http/errors";
import { registerAuthRoutes, type AppDependencies } from "./auth/routes";
import { registerMediaRoutes } from "./media/routes";
import type { LocalMediaStorage } from "./media/localStorage";
import { ApiError } from "./http/errors";
import { registerPlaylistRoutes } from "./playlists/routes";
import { registerDisplayRoutes } from "./displays/routes";

/** Creates the HTTP application for local and Lambda runtimes. */
export const createApp = (dependencies?: AppDependencies) => {
  const app = new Hono();
  app.onError(handleError);
  app.use("*", async (context, next) => {
    const startedAt = performance.now();
    await next();
    console.info(
      JSON.stringify({
        level: "info",
        event: "http_request",
        method: context.req.method,
        status: context.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
  app.get("/health", async (context) => {
    if (dependencies) {
      try {
        await dependencies.db.execute(sql`select 1`);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "database_health_failure",
            message:
              error instanceof Error ? error.message : "Unknown database error",
          }),
        );
        return context.json(
          { status: "unavailable", service: "api", dependency: "database" },
          503,
        );
      }
    }
    return context.json<HealthResponse>({ status: "ok", service: "api" });
  });
  if (dependencies) {
    registerAuthRoutes(app, dependencies);
    if (dependencies.storage) {
      registerMediaRoutes(app, {
        db: dependencies.db,
        auth: dependencies.auth,
        storage: dependencies.storage,
        maxImageBytes: dependencies.maxImageBytes ?? 20 * 1024 * 1024,
        maxVideoBytes: dependencies.maxVideoBytes ?? 500 * 1024 * 1024,
      });
      registerPlaylistRoutes(app, {
        db: dependencies.db,
        auth: dependencies.auth,
        storage: dependencies.storage,
      });
      registerDisplayRoutes(app, {
        db: dependencies.db,
        auth: dependencies.auth,
        storage: dependencies.storage,
        publicWebUrl: dependencies.publicWebUrl,
      });
    }
    if (dependencies.storage?.kind === "local") {
      const storage = dependencies.storage as LocalMediaStorage;
      app.put("/local-media/:organization/:asset", async (context) => {
        const key = `${context.req.param("organization")}/${context.req.param("asset")}`;
        const expires = context.req.query("expires") ?? "";
        const signature = context.req.query("signature") ?? "";
        const mimeType = context.req.header("content-type") ?? "";
        if (!storage.validUpload(key, mimeType, expires, signature))
          throw new ApiError(
            403,
            "forbidden",
            "Upload URL is invalid or expired",
          );
        await storage.writeUpload(key, mimeType, context.req.raw);
        return context.json({ uploaded: true });
      });
      app.get("/local-media/:organization/:asset", async (context) => {
        const key = `${context.req.param("organization")}/${context.req.param("asset")}`;
        const response = await storage.serve(key);
        if (!response) throw new ApiError(404, "not_found", "Media not found");
        return response;
      });
    }
  }
  return app;
};
