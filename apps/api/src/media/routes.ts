import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getAdmin } from "../auth/guard";
import type { AuthProvider } from "../auth/provider";
import type { Database } from "../db/client";
import { firstRow } from "../db/rows";
import {
  mediaAssets,
  mediaAssetTags,
  mediaReplacements,
  mediaTags,
  playlistItems,
  playlists,
  retiredMediaObjects,
} from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import { buildMediaDeleteImpact } from "./deleteImpact";
import { type MediaStorage, maxSmallObjectBytes } from "./storage";
import {
  uploadDeclarationFailure,
  uploadedMediaFailure,
} from "./uploadValidation";
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
const replacementSchema = uploadSchema.omit({ name: true });
const deleteSchema = z.object({
  snapshotToken: z.string().length(64).optional(),
});
const tagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
});
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
  tags: Array<{ id: string; name: string }> = [],
) => ({
  ...asset,
  contentVersion: asset.objectKey,
  tags,
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
  const tagsFor = async (assetId: string) =>
    db
      .select({ id: mediaTags.id, name: mediaTags.name })
      .from(mediaAssetTags)
      .innerJoin(mediaTags, eq(mediaAssetTags.tagId, mediaTags.id))
      .where(eq(mediaAssetTags.mediaAssetId, assetId));
  app.get("/admin/media", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const search =
      context.req.query("search")?.trim().toLocaleLowerCase() ?? "";
    const tagIds = [
      ...new Set((context.req.query("tags") ?? "").split(",").filter(Boolean)),
    ];
    if (
      tagIds.length > 20 ||
      tagIds.some((id) => !z.uuid().safeParse(id).success)
    )
      throw new ApiError(400, "invalid_request", "Invalid tag filter");
    const assets = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.organizationId, membership.organizationId));
    const tagRows = await db
      .select({
        mediaAssetId: mediaAssetTags.mediaAssetId,
        id: mediaTags.id,
        name: mediaTags.name,
      })
      .from(mediaAssetTags)
      .innerJoin(mediaTags, eq(mediaAssetTags.tagId, mediaTags.id))
      .where(eq(mediaTags.organizationId, membership.organizationId));
    const byAsset = new Map<string, Array<{ id: string; name: string }>>();
    for (const tag of tagRows) {
      const tags = byAsset.get(tag.mediaAssetId) ?? [];
      tags.push({ id: tag.id, name: tag.name });
      byAsset.set(tag.mediaAssetId, tags);
    }
    return context.json({
      assets: assets
        .filter((asset) => {
          const tags = byAsset.get(asset.id) ?? [];
          return (
            (!search || asset.name.toLocaleLowerCase().includes(search)) &&
            (!tagIds.length || tags.some((tag) => tagIds.includes(tag.id)))
          );
        })
        .map((asset) => ({
          ...serializeAsset(asset, storage),
          tags: (byAsset.get(asset.id) ?? []).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        })),
    });
  });

  app.get("/admin/media/tags", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const tags = await db
      .select({ id: mediaTags.id, name: mediaTags.name })
      .from(mediaTags)
      .where(eq(mediaTags.organizationId, membership.organizationId));
    return context.json({
      tags: tags.sort((a, b) => a.name.localeCompare(b.name)),
    });
  });

  app.post("/admin/media/uploads", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, uploadSchema);
    const kind = supportedMedia[body.mimeType as keyof typeof supportedMedia];
    const id = crypto.randomUUID();
    const objectKey = `${membership.organizationId}/${id}`;
    const failureReason = uploadDeclarationFailure(
      body.mimeType,
      body.sizeBytes,
      maxImageBytes,
      maxVideoBytes,
    );
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
    const failureReason = await uploadedMediaFailure(storage, asset, preview);
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

  app.post("/admin/media/:id/replacements", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, replacementSchema);
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, membership.organizationId),
        eq(mediaAssets.id, context.req.param("id")),
      ),
    });
    if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
    if (asset.status !== "ready")
      throw new ApiError(409, "conflict", "Only ready media can be replaced");
    const kind = supportedMedia[body.mimeType as keyof typeof supportedMedia];
    if (kind !== asset.kind)
      throw new ApiError(
        400,
        "invalid_request",
        "Replacement must be the same media kind",
      );
    const failure = uploadDeclarationFailure(
      body.mimeType,
      body.sizeBytes,
      maxImageBytes,
      maxVideoBytes,
    );
    if (failure) throw new ApiError(400, "invalid_request", failure);
    const replacementId = crypto.randomUUID();
    const objectKey = `${membership.organizationId}/${crypto.randomUUID()}`;
    await db.insert(mediaReplacements).values({
      id: replacementId,
      mediaAssetId: asset.id,
      objectKey,
      originalObjectKey: asset.objectKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });
    try {
      return context.json(
        {
          replacementId,
          uploadUrl: await storage.createUploadUrl(objectKey, body.mimeType),
        },
        201,
      );
    } catch (error) {
      await db
        .update(mediaReplacements)
        .set({
          status: "failed",
          failureReason: "Storage upload could not be initialized",
        })
        .where(eq(mediaReplacements.id, replacementId));
      throw error;
    }
  });

  app.post(
    "/admin/media/:id/replacements/:replacementId/complete",
    async (context) => {
      const { membership } = await getAdmin(context, db, auth);
      const preview = await parseJsonBody(context, completeSchema);
      const asset = await db.query.mediaAssets.findFirst({
        where: and(
          eq(mediaAssets.organizationId, membership.organizationId),
          eq(mediaAssets.id, context.req.param("id")),
        ),
      });
      if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
      const candidate = await db.query.mediaReplacements.findFirst({
        where: and(
          eq(mediaReplacements.id, context.req.param("replacementId")),
          eq(mediaReplacements.mediaAssetId, asset.id),
        ),
      });
      if (!candidate)
        throw new ApiError(404, "not_found", "Replacement not found");
      if (
        candidate.status !== "pending" ||
        asset.objectKey !== candidate.originalObjectKey
      )
        throw new ApiError(409, "conflict", "Replacement is no longer current");
      if (candidate.createdAt.getTime() <= Date.now() - 86400000)
        throw new ApiError(409, "conflict", "Replacement upload has expired");
      const failureReason = await uploadedMediaFailure(
        storage,
        {
          kind: asset.kind,
          mimeType: candidate.mimeType,
          sizeBytes: candidate.sizeBytes,
          objectKey: candidate.objectKey,
        },
        preview,
      );
      if (failureReason) {
        await db
          .update(mediaReplacements)
          .set({ status: "failed", failureReason })
          .where(
            and(
              eq(mediaReplacements.id, candidate.id),
              eq(mediaReplacements.status, "pending"),
            ),
          );
        throw new ApiError(400, "invalid_request", failureReason);
      }
      // The presigned URL remains writable after completion. Only a separate
      // server-owned copy may become a public asset key.
      const publishedKey = `${membership.organizationId}/${crypto.randomUUID()}`;
      await db.insert(retiredMediaObjects).values({
        objectKey: publishedKey,
        expiresAt: new Date(Date.now() + 86400000),
      });
      await storage.copy(candidate.objectKey, publishedKey);
      const copiedFailure = await uploadedMediaFailure(
        storage,
        {
          kind: asset.kind,
          mimeType: candidate.mimeType,
          sizeBytes: candidate.sizeBytes,
          objectKey: publishedKey,
        },
        preview,
      );
      if (copiedFailure) {
        await db
          .update(mediaReplacements)
          .set({ status: "failed", failureReason: copiedFailure })
          .where(
            and(
              eq(mediaReplacements.id, candidate.id),
              eq(mediaReplacements.status, "pending"),
            ),
          );
        throw new ApiError(400, "invalid_request", copiedFailure);
      }
      const updated = await db.transaction(async (transaction) => {
        const locked = await transaction.execute(sql`SELECT id FROM media_assets
          WHERE id = ${asset.id} AND organization_id = ${membership.organizationId}
          FOR UPDATE`);
        if (!locked.length)
          throw new ApiError(
            409,
            "conflict",
            "Replacement is no longer current",
          );
        const current = firstRow(
          await transaction
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.id, asset.id)),
        );
        if (
          current.status !== "ready" ||
          current.objectKey !== candidate.originalObjectKey
        )
          throw new ApiError(
            409,
            "conflict",
            "Replacement is no longer current",
          );
        const claimed = await transaction
          .update(mediaReplacements)
          .set({ status: "ready" })
          .where(
            and(
              eq(mediaReplacements.id, candidate.id),
              eq(mediaReplacements.status, "pending"),
              eq(
                mediaReplacements.originalObjectKey,
                candidate.originalObjectKey,
              ),
            ),
          )
          .returning();
        if (!claimed[0])
          throw new ApiError(
            409,
            "conflict",
            "Replacement is no longer current",
          );
        const rows = await transaction
          .update(mediaAssets)
          .set({
            objectKey: publishedKey,
            mimeType: candidate.mimeType,
            sizeBytes: candidate.sizeBytes,
            width: preview.width ?? null,
            height: preview.height ?? null,
            durationMs: preview.durationMs ?? null,
            thumbnailKey: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(mediaAssets.id, asset.id),
              eq(mediaAssets.objectKey, candidate.originalObjectKey),
              eq(mediaAssets.status, "ready"),
            ),
          )
          .returning();
        const published = rows[0];
        if (!published)
          throw new ApiError(
            409,
            "conflict",
            "Replacement is no longer current",
          );
        const expiresAt = new Date(Date.now() + 7 * 86400000);
        await transaction.insert(retiredMediaObjects).values([
          { objectKey: current.objectKey, expiresAt },
          ...(current.thumbnailKey
            ? [{ objectKey: current.thumbnailKey, expiresAt }]
            : []),
          {
            objectKey: candidate.objectKey,
            expiresAt: new Date(Date.now() + 86400000),
          },
        ]);
        await transaction
          .delete(retiredMediaObjects)
          .where(eq(retiredMediaObjects.objectKey, publishedKey));
        return published;
      });
      return context.json({
        asset: serializeAsset(updated, storage, await tagsFor(updated.id)),
      });
    },
  );

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
    return context.json({
      asset: serializeAsset(updated, storage, await tagsFor(updated.id)),
    });
  });

  app.put("/admin/media/:id/tags", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, tagsSchema);
    const normalized = [
      ...new Map(
        body.tags.map((name) => [name.toLocaleLowerCase(), name]),
      ).entries(),
    ];
    const tags = await db.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT id FROM media_assets
        WHERE id = ${context.req.param("id")} AND organization_id = ${membership.organizationId}
        FOR SHARE`);
      if (!locked.length)
        throw new ApiError(404, "not_found", "Media asset not found");
      const ids: string[] = [];
      for (const [normalizedName, name] of normalized) {
        const [tag] = await transaction
          .insert(mediaTags)
          .values({
            organizationId: membership.organizationId,
            name,
            normalizedName,
          })
          .onConflictDoUpdate({
            target: [mediaTags.organizationId, mediaTags.normalizedName],
            set: { normalizedName },
          })
          .returning({ id: mediaTags.id });
        if (tag) ids.push(tag.id);
      }
      await transaction
        .delete(mediaAssetTags)
        .where(eq(mediaAssetTags.mediaAssetId, context.req.param("id")));
      if (ids.length)
        await transaction.insert(mediaAssetTags).values(
          ids.map((tagId) => ({
            mediaAssetId: context.req.param("id"),
            tagId,
          })),
        );
      return ids.length
        ? await transaction
            .select({ id: mediaTags.id, name: mediaTags.name })
            .from(mediaTags)
            .where(inArray(mediaTags.id, ids))
        : [];
    });
    return context.json({
      tags: tags.sort((a, b) => a.name.localeCompare(b.name)),
    });
  });

  app.get("/admin/media/:id/delete-impact", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, membership.organizationId),
        eq(mediaAssets.id, context.req.param("id")),
      ),
    });
    if (!asset) throw new ApiError(404, "not_found", "Media asset not found");
    const uses = await db
      .select({
        itemId: playlistItems.id,
        playlistId: playlists.id,
        playlistName: playlists.name,
      })
      .from(playlistItems)
      .innerJoin(playlists, eq(playlistItems.playlistId, playlists.id))
      .where(eq(playlistItems.mediaAssetId, asset.id));
    return context.json(buildMediaDeleteImpact(asset.id, uses));
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
    if (context.req.header("x-media-version") !== asset.objectKey)
      throw new ApiError(
        409,
        "conflict",
        "Video changed while preparing thumbnail",
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
      updated = await db.transaction(async (transaction) => {
        const rows = await transaction
          .update(mediaAssets)
          .set({ thumbnailKey, updatedAt: new Date() })
          .where(
            and(
              eq(mediaAssets.id, asset.id),
              eq(mediaAssets.organizationId, membership.organizationId),
              eq(mediaAssets.objectKey, asset.objectKey),
              eq(mediaAssets.status, "ready"),
              asset.thumbnailKey
                ? eq(mediaAssets.thumbnailKey, asset.thumbnailKey)
                : isNull(mediaAssets.thumbnailKey),
            ),
          )
          .returning();
        const row = rows[0];
        if (!row)
          throw new ApiError(
            409,
            "conflict",
            "Video changed while uploading thumbnail",
          );
        if (asset.thumbnailKey)
          await transaction.insert(retiredMediaObjects).values({
            objectKey: asset.thumbnailKey,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          });
        return row;
      });
    } catch (error) {
      await storage.remove(thumbnailKey);
      throw error;
    }
    return context.json({
      asset: serializeAsset(updated, storage, await tagsFor(updated.id)),
    });
  });

  app.delete("/admin/media/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = context.req
      .header("content-type")
      ?.includes("application/json")
      ? await parseJsonBody(context, deleteSchema)
      : {};
    await db.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT id FROM media_assets
        WHERE id = ${context.req.param("id")} AND organization_id = ${membership.organizationId}
        FOR UPDATE`);
      if (!locked.length)
        throw new ApiError(404, "not_found", "Media asset not found");
      const asset = firstRow(
        await transaction
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.id, context.req.param("id"))),
      );
      const uses = await transaction
        .select({
          itemId: playlistItems.id,
          playlistId: playlists.id,
          playlistName: playlists.name,
        })
        .from(playlistItems)
        .innerJoin(playlists, eq(playlistItems.playlistId, playlists.id))
        .where(eq(playlistItems.mediaAssetId, asset.id));
      const impact = buildMediaDeleteImpact(asset.id, uses);
      if (impact.totalItems && !body.snapshotToken)
        throw new ApiError(
          409,
          "conflict",
          "Review playlist uses before deleting this media",
        );
      if (body.snapshotToken && body.snapshotToken !== impact.snapshotToken)
        throw new ApiError(
          409,
          "conflict",
          "Playlist uses changed; review deletion impact again",
        );
      const candidates = await transaction
        .select({ objectKey: mediaReplacements.objectKey })
        .from(mediaReplacements)
        .where(eq(mediaReplacements.mediaAssetId, asset.id));
      await transaction
        .delete(playlistItems)
        .where(eq(playlistItems.mediaAssetId, asset.id));
      await transaction.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      await transaction
        .insert(retiredMediaObjects)
        .values([
          { objectKey: asset.objectKey, expiresAt },
          ...(asset.thumbnailKey
            ? [{ objectKey: asset.thumbnailKey, expiresAt }]
            : []),
          ...candidates
            .filter((candidate) => candidate.objectKey !== asset.objectKey)
            .map((candidate) => ({
              objectKey: candidate.objectKey,
              expiresAt: new Date(Date.now() + 86400000),
            })),
        ])
        .onConflictDoNothing();
    });
    return context.json({ deleted: true });
  });
};
