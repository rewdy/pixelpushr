import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import type { AuthProvider } from "../auth/provider";
import { getAdmin } from "../auth/guard";
import type { Database } from "../db/client";
import { mediaAssets } from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import type { MediaStorage } from "./storage";
import { matchesSignature, supportedMedia } from "./validation";

export type MediaDependencies = {
  db: Database["db"];
  auth: AuthProvider;
  storage: MediaStorage;
  maxImageBytes: number;
  maxVideoBytes: number;
};
const uploadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});
const completeSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});
const renameSchema = z.object({ name: z.string().trim().min(1).max(200) });

const serializeAsset = (
  asset: typeof mediaAssets.$inferSelect,
  storage: MediaStorage,
) => ({
  ...asset,
  url: asset.status === "ready" ? storage.publicUrl(asset.objectKey) : null,
  previewUrl:
    asset.status === "ready" && asset.kind === "image"
      ? storage.publicUrl(asset.objectKey)
      : null,
});

/** Registers tenant-scoped media upload, readiness, listing, and removal APIs. */
export const registerMediaRoutes = (
  app: Hono,
  { db, auth, storage, maxImageBytes, maxVideoBytes }: MediaDependencies,
) => {
  app.get("/admin/media", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const assets = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.organizationId, membership.organizationId));
    return context.json({
      assets: assets.map((asset) => serializeAsset(asset, storage)),
    });
  });

  app.post("/admin/media/uploads", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, uploadSchema);
    const kind = supportedMedia[body.mimeType as keyof typeof supportedMedia];
    const id = crypto.randomUUID();
    const objectKey = `${membership.organizationId}/${id}`;
    const limit = kind === "image" ? maxImageBytes : maxVideoBytes;
    const failureReason = !kind
      ? "Unsupported image or video format"
      : body.sizeBytes > limit
        ? `File exceeds the ${Math.round(limit / 1024 / 1024)} MB limit`
        : null;
    const asset = (
      await db
        .insert(mediaAssets)
        .values({
          id,
          organizationId: membership.organizationId,
          name: body.name,
          kind: kind ?? "image",
          status: failureReason ? "failed" : "pending",
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
          objectKey,
          failureReason,
        })
        .returning()
    )[0]!;
    if (failureReason)
      return context.json(
        { asset: serializeAsset(asset, storage), uploadUrl: null },
        201,
      );
    try {
      return context.json(
        {
          asset: serializeAsset(asset, storage),
          uploadUrl: await storage.createUploadUrl(objectKey, body.mimeType),
        },
        201,
      );
    } catch (error) {
      await db
        .update(mediaAssets)
        .set({
          status: "failed",
          failureReason: "Storage upload could not be initialized",
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, id));
      throw error;
    }
  });

  app.post("/admin/media/:id/complete", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, membership.organizationId),
        eq(mediaAssets.id, context.req.param("id")),
      ),
    });
    if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
    if (asset.status !== "pending")
      throw new ApiError(
        409,
        "conflict",
        "Only pending uploads can be completed",
      );
    const preview = await parseJsonBody(context, completeSchema);
    const object = await storage.head(asset.objectKey);
    let failureReason: string | null = null;
    if (!object) failureReason = "Uploaded object was not found";
    else if (object.sizeBytes !== asset.sizeBytes)
      failureReason = "Uploaded size differs from declared size";
    else if (object.mimeType !== asset.mimeType)
      failureReason = "Uploaded content type differs from declared type";
    else if (asset.kind === "video" && !preview.durationMs)
      failureReason = "Video duration metadata is required";
    else {
      const bytes = await storage.readPrefix(asset.objectKey, 16);
      if (!matchesSignature(asset.mimeType, bytes))
        failureReason = "File signature does not match its content type";
    }
    const updated = (
      await db
        .update(mediaAssets)
        .set({
          status: failureReason ? "failed" : "ready",
          failureReason,
          width: preview.width ?? null,
          height: preview.height ?? null,
          durationMs: preview.durationMs ?? null,
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, asset.id))
        .returning()
    )[0]!;
    return context.json({ asset: serializeAsset(updated, storage) });
  });

  app.patch("/admin/media/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, renameSchema);
    const updated = (
      await db
        .update(mediaAssets)
        .set({ name: body.name, updatedAt: new Date() })
        .where(
          and(
            eq(mediaAssets.organizationId, membership.organizationId),
            eq(mediaAssets.id, context.req.param("id")),
          ),
        )
        .returning()
    )[0];
    if (!updated) throw new ApiError(404, "not_found", "Media asset not found");
    return context.json({ asset: serializeAsset(updated, storage) });
  });

  app.delete("/admin/media/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, membership.organizationId),
        eq(mediaAssets.id, context.req.param("id")),
      ),
    });
    if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
    try {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
    } catch {
      throw new ApiError(
        409,
        "conflict",
        "Remove this asset from playlists before deleting it",
      );
    }
    await storage.remove(asset.objectKey);
    return context.json({ deleted: true });
  });
};
