import { and, asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getAdmin } from "../auth/guard";
import type { AuthProvider } from "../auth/provider";
import type { Database } from "../db/client";
import {
  assignments,
  mediaAssets,
  playlistItems,
  playlists,
} from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import type { MediaStorage } from "../media/storage";

type PlaylistDependencies = {
  db: Database["db"];
  auth: AuthProvider;
  storage: MediaStorage;
};
const playlistSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
});
const itemSchema = z.object({
  mediaAssetId: z.uuid(),
  imageDurationMs: z.number().int().min(1000).max(86400000).optional(),
  videoMode: z.enum(["once", "repeat"]).optional(),
  repeatDurationMs: z.number().int().min(1000).max(86400000).optional(),
});
const itemsSchema = z.object({ items: z.array(itemSchema).max(500) });

/** Validates playback settings against the selected asset kind. */
export const validatePlaylistItem = (
  kind: "image" | "video",
  item: z.infer<typeof itemSchema>,
) => {
  if (kind === "image") {
    if (!item.imageDurationMs || item.videoMode || item.repeatDurationMs)
      throw new ApiError(
        400,
        "invalid_request",
        "Images require a duration and cannot use video playback settings",
      );
  } else if (
    item.imageDurationMs ||
    !item.videoMode ||
    (item.videoMode === "repeat" && !item.repeatDurationMs) ||
    (item.videoMode === "once" && item.repeatDurationMs)
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "Videos require play-once or repeat-for-duration settings",
    );
  }
};

/** Registers playlist CRUD and atomic ordered-item editing. */
export const registerPlaylistRoutes = (
  app: Hono,
  { db, auth, storage }: PlaylistDependencies,
) => {
  app.get("/admin/playlists", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const rows = await db
      .select()
      .from(playlists)
      .where(eq(playlists.organizationId, membership.organizationId))
      .orderBy(asc(playlists.name));
    return context.json({ playlists: rows });
  });

  app.post("/admin/playlists", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, playlistSchema);
    const playlist = (
      await db
        .insert(playlists)
        .values({ organizationId: membership.organizationId, ...body })
        .returning()
    )[0]!;
    return context.json({ playlist }, 201);
  });

  app.get("/admin/playlists/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const playlist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.organizationId, membership.organizationId),
        eq(playlists.id, context.req.param("id")),
      ),
    });
    if (!playlist) throw new ApiError(404, "not_found", "Playlist not found");
    const rows = await db
      .select({ item: playlistItems, asset: mediaAssets })
      .from(playlistItems)
      .innerJoin(mediaAssets, eq(playlistItems.mediaAssetId, mediaAssets.id))
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(asc(playlistItems.position));
    return context.json({
      playlist,
      items: rows.map(({ item, asset }) => ({
        ...item,
        asset: {
          ...asset,
          url:
            asset.status === "ready"
              ? storage.publicUrl(asset.objectKey)
              : null,
        },
      })),
    });
  });

  app.patch("/admin/playlists/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, playlistSchema);
    const playlist = (
      await db
        .update(playlists)
        .set({ ...body, updatedAt: new Date() })
        .where(
          and(
            eq(playlists.organizationId, membership.organizationId),
            eq(playlists.id, context.req.param("id")),
          ),
        )
        .returning()
    )[0];
    if (!playlist) throw new ApiError(404, "not_found", "Playlist not found");
    return context.json({ playlist });
  });

  app.put("/admin/playlists/:id/items", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, itemsSchema);
    const playlist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.organizationId, membership.organizationId),
        eq(playlists.id, context.req.param("id")),
      ),
    });
    if (!playlist) throw new ApiError(404, "not_found", "Playlist not found");
    const assets = await Promise.all(
      body.items.map((item) =>
        db.query.mediaAssets.findFirst({
          where: and(
            eq(mediaAssets.organizationId, membership.organizationId),
            eq(mediaAssets.id, item.mediaAssetId),
          ),
        }),
      ),
    );
    body.items.forEach((item, position) => {
      const asset = assets[position];
      if (!asset || asset.status !== "ready")
        throw new ApiError(
          400,
          "invalid_request",
          `Item ${position + 1} must reference a ready media asset`,
        );
      validatePlaylistItem(asset.kind, item);
    });
    await db.transaction(async (transaction) => {
      await transaction
        .delete(playlistItems)
        .where(eq(playlistItems.playlistId, playlist.id));
      if (body.items.length)
        await transaction
          .insert(playlistItems)
          .values(
            body.items.map((item, position) => ({
              playlistId: playlist.id,
              mediaAssetId: item.mediaAssetId,
              position,
              imageDurationMs: item.imageDurationMs ?? null,
              videoMode: item.videoMode ?? null,
              repeatDurationMs: item.repeatDurationMs ?? null,
            })),
          );
      await transaction
        .update(playlists)
        .set({ updatedAt: new Date() })
        .where(eq(playlists.id, playlist.id));
    });
    return context.json({ updated: true, itemCount: body.items.length });
  });

  app.delete("/admin/playlists/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const playlist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.organizationId, membership.organizationId),
        eq(playlists.id, context.req.param("id")),
      ),
    });
    if (!playlist) throw new ApiError(404, "not_found", "Playlist not found");
    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.playlistId, playlist.id),
    });
    if (assignment)
      throw new ApiError(
        409,
        "conflict",
        "Remove display assignments before deleting this playlist",
      );
    await db.delete(playlists).where(eq(playlists.id, playlist.id));
    return context.json({ deleted: true });
  });
};
