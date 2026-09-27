import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getAdmin } from "../auth/guard";
import type { AuthProvider } from "../auth/provider";
import type { Database } from "../db/client";
import { firstRow } from "../db/rows";
import { mediaAssets } from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import { type MediaStorage, maxSmallObjectBytes } from "./storage";
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
const readBoundedThumbnail = async (request: Request): Promise<Uint8Array> => {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxSmallObjectBytes)
    throw new ApiError(
      413,
      "invalid_request",
      "Thumbnail exceeds the 1 MB limit",
    );
  if (!request.body)
    throw new ApiError(400, "invalid_request", "JPEG thumbnail is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxSmallObjectBytes) {
        void reader.cancel();
        throw new ApiError(
          413,
          "invalid_request",
          "Thumbnail exceeds the 1 MB limit",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length)
    throw new ApiError(400, "invalid_request", "JPEG thumbnail is required");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!matchesSignature("image/jpeg", bytes))
    throw new ApiError(
      400,
      "invalid_request",
      "Thumbnail must be a JPEG image",
    );
  return bytes;
};

const serializeAsset = (
  asset: typeof mediaAssets.$inferSelect,
  storage: MediaStorage,
) => ({
  ...asset,
  url: asset.status === "ready" ? storage.publicUrl(asset.objectKey) : null,
  previewUrl:
    asset.status === "ready"
      ? asset.kind === "image"
        ? storage.publicUrl(asset.objectKey)
        : asset.thumbnailKey
          ? storage.publicUrl(asset.thumbnailKey)
          : null
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
    const asset = firstRow(
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
        .returning(),
    );
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
    const updated = firstRow(
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
        .returning(),
    );
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

  app.put("/admin/media/:id/thumbnail", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, membership.organizationId),
        eq(mediaAssets.id, context.req.param("id")),
      ),
    });
    if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
    if (asset.kind !== "video" || asset.status !== "ready")
      throw new ApiError(
        409,
        "conflict",
        "Only ready videos accept thumbnails",
      );
    if (
      context.req.header("content-type")?.split(";")[0]?.trim() !== "image/jpeg"
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Thumbnail must use image/jpeg",
      );
    const bytes = await readBoundedThumbnail(context.req.raw);
    const thumbnailKey = `${membership.organizationId}/${crypto.randomUUID()}`;
    await storage.writeSmall(thumbnailKey, "image/jpeg", bytes);
    let updated: typeof mediaAssets.$inferSelect;
    try {
      const rows = await db
        .update(mediaAssets)
        .set({ thumbnailKey, updatedAt: new Date() })
        .where(
          and(
            eq(mediaAssets.id, asset.id),
            eq(mediaAssets.organizationId, membership.organizationId),
          ),
        )
        .returning();
      const row = rows[0];
      if (!row) throw new ApiError(404, "not_found", "Media asset not found");
      updated = row;
    } catch (error) {
      await storage.remove(thumbnailKey);
      throw error;
    }
    if (asset.thumbnailKey) await storage.remove(asset.thumbnailKey);
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
    if (asset.thumbnailKey) await storage.remove(asset.thumbnailKey);
    return context.json({ deleted: true });
  });
};
