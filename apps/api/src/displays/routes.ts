import { createHash } from "node:crypto";
import type {
  ManifestItem,
  OverrideWindow,
  PlayerManifest,
} from "@pixelpushr/contracts/manifest";
import { and, asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getAdmin } from "../auth/guard";
import type { AuthProvider } from "../auth/provider";
import type { Database } from "../db/client";
import { firstRow } from "../db/rows";
import {
  assignments,
  displays,
  mediaAssets,
  organizations,
  playlistItems,
  playlists,
  scheduleRules,
} from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import type { MediaStorage } from "../media/storage";
import {
  activeOverride,
  isScheduleActive,
  localTimeToInstant,
  overrideTransitions,
} from "./schedules";

type DisplayDependencies = {
  db: Database["db"];
  auth: AuthProvider;
  storage: MediaStorage;
  publicWebUrl: string;
};
const displaySchema = z.object({ name: z.string().trim().min(1).max(160) });
const alwaysSchema = z
  .object({ playlistIds: z.array(z.uuid()).max(100) })
  .refine(
    (value) => new Set(value.playlistIds).size === value.playlistIds.length,
    "Each playlist can be assigned only once in the always queue",
  );
const heartbeatSchema = z.object({
  health: z.enum(["playing", "empty", "error"]),
  itemId: z.string().nullable().optional(),
});
const scheduledSchema = z.object({
  playlistId: z.uuid(),
  startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/),
  endLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/),
  recurrence: z.enum(["none", "weekly"]),
  weekInterval: z.number().int().min(1).max(52).optional(),
  position: z.number().int().min(0).max(1000).default(0),
});
const overrideSchema = z
  .object({
    playlistId: z.uuid(),
    startLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
      .optional(),
    endLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/),
    activateNow: z.boolean().default(false),
    priority: z.number().int().min(0).max(1000).default(0),
  })
  .refine(
    (value) => value.activateNow || !!value.startLocal,
    "Start time is required unless activating now",
  );
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const playerUrl = (base: string, token: string) =>
  `${base.replace(/\/$/, "")}/player/${token}`;

/** Builds the display's deterministic normal queue at a server-authoritative instant. */
export const resolveAlwaysManifest = async (
  db: Database["db"],
  storage: MediaStorage,
  display: typeof displays.$inferSelect,
  at = new Date(),
): Promise<PlayerManifest> => {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, display.organizationId),
  });
  if (!organization)
    throw new ApiError(404, "not_found", "Organization not found");
  const rows = await db
    .select({
      assignment: assignments,
      playlist: playlists,
      item: playlistItems,
      asset: mediaAssets,
      schedule: scheduleRules,
    })
    .from(assignments)
    .innerJoin(playlists, eq(assignments.playlistId, playlists.id))
    .innerJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
    .innerJoin(mediaAssets, eq(playlistItems.mediaAssetId, mediaAssets.id))
    .leftJoin(scheduleRules, eq(assignments.scheduleRuleId, scheduleRules.id))
    .where(
      and(
        eq(assignments.displayId, display.id),
        eq(assignments.enabled, true),
        eq(mediaAssets.status, "ready"),
      ),
    )
    .orderBy(
      asc(assignments.position),
      asc(assignments.createdAt),
      asc(assignments.id),
      asc(playlistItems.position),
      asc(playlistItems.id),
    );
  const toItem = ({
    assignment,
    playlist,
    item,
    asset,
  }: (typeof rows)[number]): ManifestItem => ({
    id: `${assignment.id}:${item.id}`,
    playlistId: playlist.id,
    assetId: asset.id,
    kind: asset.kind,
    url: storage.publicUrl(asset.objectKey),
    imageDurationMs: item.imageDurationMs,
    videoMode: item.videoMode,
    repeatDurationMs: item.repeatDurationMs,
  });
  const normalQueue: ManifestItem[] = rows
    .filter(
      ({ assignment, schedule }) =>
        assignment.mode === "always" ||
        (assignment.mode === "scheduled" &&
          schedule &&
          isScheduleActive(schedule, organization.timezone, at)),
    )
    .sort(
      (left, right) =>
        Number(left.assignment.mode !== "always") -
        Number(right.assignment.mode !== "always"),
    )
    .map(toItem);
  const overrides = new Map<string, OverrideWindow>();
  for (const row of rows) {
    if (
      row.assignment.mode !== "override" ||
      !row.schedule ||
      row.schedule.endAt <= at
    )
      continue;
    const existing = overrides.get(row.assignment.id);
    if (existing) existing.queue.push(toItem(row));
    else
      overrides.set(row.assignment.id, {
        assignmentId: row.assignment.id,
        priority: row.assignment.priority,
        startAt: row.schedule.startAt.toISOString(),
        endAt: row.schedule.endAt.toISOString(),
        queue: [toItem(row)],
      });
  }
  const overrideWindows = [...overrides.values()].sort(
    (left, right) =>
      left.startAt.localeCompare(right.startAt) ||
      right.priority - left.priority ||
      left.assignmentId.localeCompare(right.assignmentId),
  );
  const override = activeOverride(overrideWindows, at);
  const transitions = overrideTransitions(overrideWindows, at);
  const version = createHash("sha256")
    .update(JSON.stringify({ normalQueue, overrideWindows }))
    .digest("hex");
  return {
    display: { id: display.id, name: display.name },
    version,
    serverTime: at.toISOString(),
    normalQueue,
    activeQueue: override?.queue ?? normalQueue,
    override,
    overrideWindows,
    transitions,
  };
};

/** Registers administrator display management and public player endpoints. */
export const registerDisplayRoutes = (
  app: Hono,
  { db, auth, storage, publicWebUrl }: DisplayDependencies,
) => {
  app.get("/admin/displays", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const rows = await db
      .select()
      .from(displays)
      .where(eq(displays.organizationId, membership.organizationId))
      .orderBy(asc(displays.name));
    return context.json({
      displays: rows.map(
        ({ playerTokenHash: _playerTokenHash, playerToken, ...display }) => ({
          ...display,
          playerUrl: playerUrl(publicWebUrl, playerToken),
        }),
      ),
    });
  });

  app.post("/admin/displays", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, displaySchema);
    const token = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64url");
    const {
      playerTokenHash: _playerTokenHash,
      playerToken: _playerToken,
      ...display
    } = firstRow(
      await db
        .insert(displays)
        .values({
          organizationId: membership.organizationId,
          name: body.name,
          playerToken: token,
          playerTokenHash: hashToken(token),
        })
        .returning(),
    );
    return context.json(
      { display: { ...display, playerUrl: playerUrl(publicWebUrl, token) } },
      201,
    );
  });

  app.patch("/admin/displays/:id", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, displaySchema);
    const row = (
      await db
        .update(displays)
        .set(body)
        .where(
          and(
            eq(displays.organizationId, membership.organizationId),
            eq(displays.id, context.req.param("id")),
          ),
        )
        .returning()
    )[0];
    if (!row) throw new ApiError(404, "not_found", "Display not found");
    return context.json({
      display: {
        id: row.id,
        name: row.name,
        playerUrl: playerUrl(publicWebUrl, row.playerToken),
      },
    });
  });

  app.get("/admin/displays/:id/assignments", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    const rows = await db
      .select({
        assignment: assignments,
        playlist: playlists,
        schedule: scheduleRules,
      })
      .from(assignments)
      .innerJoin(playlists, eq(assignments.playlistId, playlists.id))
      .leftJoin(scheduleRules, eq(assignments.scheduleRuleId, scheduleRules.id))
      .where(eq(assignments.displayId, display.id))
      .orderBy(
        asc(assignments.position),
        asc(assignments.createdAt),
        asc(assignments.id),
      );
    return context.json({
      assignments: rows.map(({ assignment, playlist, schedule }) => ({
        ...assignment,
        playlistName: playlist.name,
        schedule,
      })),
    });
  });

  app.post("/admin/displays/:id/schedules", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, scheduledSchema);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    const playlist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.organizationId, membership.organizationId),
        eq(playlists.id, body.playlistId),
      ),
    });
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, membership.organizationId),
    });
    if (!display || !playlist || !organization)
      throw new ApiError(404, "not_found", "Display or playlist not found");
    let startAt: Date;
    let endAt: Date;
    try {
      startAt = localTimeToInstant(body.startLocal, organization.timezone);
      endAt = localTimeToInstant(body.endLocal, organization.timezone);
    } catch {
      throw new ApiError(400, "invalid_request", "Invalid local schedule time");
    }
    if (endAt <= startAt)
      throw new ApiError(
        400,
        "invalid_request",
        "Schedule end must be after start",
      );
    if (
      body.recurrence === "weekly" &&
      endAt.getTime() - startAt.getTime() >
        (body.weekInterval ?? 1) * 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Weekly window cannot exceed its repeat interval",
      );
    const result = await db.transaction(async (transaction) => {
      const rule = firstRow(
        await transaction
          .insert(scheduleRules)
          .values({
            organizationId: organization.id,
            recurrence: body.recurrence,
            startAt,
            endAt,
            timezone: organization.timezone,
            weekInterval:
              body.recurrence === "weekly" ? (body.weekInterval ?? 1) : null,
          })
          .returning(),
      );
      const assignment = firstRow(
        await transaction
          .insert(assignments)
          .values({
            displayId: display.id,
            playlistId: playlist.id,
            scheduleRuleId: rule.id,
            mode: "scheduled",
            position: body.position,
          })
          .returning(),
      );
      return { ...assignment, schedule: rule, playlistName: playlist.name };
    });
    return context.json({ assignment: result }, 201);
  });

  app.delete("/admin/displays/:id/schedules/:assignmentId", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    const assignment = (
      await db
        .delete(assignments)
        .where(
          and(
            eq(assignments.id, context.req.param("assignmentId")),
            eq(assignments.displayId, display.id),
            eq(assignments.mode, "scheduled"),
          ),
        )
        .returning()
    )[0];
    if (!assignment)
      throw new ApiError(404, "not_found", "Scheduled assignment not found");
    if (assignment.scheduleRuleId)
      await db
        .delete(scheduleRules)
        .where(eq(scheduleRules.id, assignment.scheduleRuleId));
    return context.json({ deleted: true });
  });

  app.post("/admin/displays/:id/overrides", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, overrideSchema);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    const playlist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.organizationId, membership.organizationId),
        eq(playlists.id, body.playlistId),
      ),
    });
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, membership.organizationId),
    });
    if (!display || !playlist || !organization)
      throw new ApiError(404, "not_found", "Display or playlist not found");
    const readyItems = await db
      .select({ item: playlistItems })
      .from(playlistItems)
      .innerJoin(mediaAssets, eq(playlistItems.mediaAssetId, mediaAssets.id))
      .where(
        and(
          eq(playlistItems.playlistId, playlist.id),
          eq(mediaAssets.status, "ready"),
        ),
      );
    if (!readyItems.length)
      throw new ApiError(
        400,
        "invalid_request",
        "Override playlist must contain playable media",
      );
    let startAt: Date;
    let endAt: Date;
    try {
      startAt = body.activateNow
        ? new Date()
        : localTimeToInstant(body.startLocal ?? "", organization.timezone);
      endAt = localTimeToInstant(body.endLocal, organization.timezone);
    } catch {
      throw new ApiError(400, "invalid_request", "Invalid local override time");
    }
    if (endAt <= startAt)
      throw new ApiError(
        400,
        "invalid_request",
        "Override expiration must be after its start",
      );
    const result = await db.transaction(async (transaction) => {
      const rule = firstRow(
        await transaction
          .insert(scheduleRules)
          .values({
            organizationId: organization.id,
            recurrence: "none",
            startAt,
            endAt,
            timezone: organization.timezone,
          })
          .returning(),
      );
      const assignment = firstRow(
        await transaction
          .insert(assignments)
          .values({
            displayId: display.id,
            playlistId: playlist.id,
            scheduleRuleId: rule.id,
            mode: "override",
            priority: body.priority,
          })
          .returning(),
      );
      return { ...assignment, schedule: rule, playlistName: playlist.name };
    });
    return context.json({ assignment: result }, 201);
  });

  app.delete("/admin/displays/:id/overrides/:assignmentId", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    const assignment = (
      await db
        .delete(assignments)
        .where(
          and(
            eq(assignments.id, context.req.param("assignmentId")),
            eq(assignments.displayId, display.id),
            eq(assignments.mode, "override"),
          ),
        )
        .returning()
    )[0];
    if (!assignment) throw new ApiError(404, "not_found", "Override not found");
    if (assignment.scheduleRuleId)
      await db
        .delete(scheduleRules)
        .where(eq(scheduleRules.id, assignment.scheduleRuleId));
    return context.json({ deleted: true });
  });

  app.get("/admin/displays/:id/preview", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, membership.organizationId),
    });
    if (!organization)
      throw new ApiError(404, "not_found", "Organization not found");
    let at: Date;
    try {
      at = localTimeToInstant(
        context.req.query("atLocal") ?? "",
        organization.timezone,
      );
    } catch {
      throw new ApiError(
        400,
        "invalid_request",
        "Preview requires a valid local timestamp",
      );
    }
    return context.json(await resolveAlwaysManifest(db, storage, display, at));
  });

  app.put("/admin/displays/:id/always", async (context) => {
    const { membership } = await getAdmin(context, db, auth);
    const body = await parseJsonBody(context, alwaysSchema);
    const display = await db.query.displays.findFirst({
      where: and(
        eq(displays.organizationId, membership.organizationId),
        eq(displays.id, context.req.param("id")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    for (const playlistId of body.playlistIds) {
      const playlist = await db.query.playlists.findFirst({
        where: and(
          eq(playlists.organizationId, membership.organizationId),
          eq(playlists.id, playlistId),
        ),
      });
      if (!playlist)
        throw new ApiError(
          400,
          "invalid_request",
          "All assigned playlists must belong to this workspace",
        );
    }
    await db.transaction(async (transaction) => {
      await transaction
        .delete(assignments)
        .where(
          and(
            eq(assignments.displayId, display.id),
            eq(assignments.mode, "always"),
          ),
        );
      if (body.playlistIds.length)
        await transaction.insert(assignments).values(
          body.playlistIds.map((playlistId, position) => ({
            displayId: display.id,
            playlistId,
            mode: "always" as const,
            position,
          })),
        );
    });
    return context.json({ updated: true });
  });

  app.get("/player/:token/manifest", async (context) => {
    const display = await db.query.displays.findFirst({
      where: eq(
        displays.playerTokenHash,
        hashToken(context.req.param("token")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    context.header("cache-control", "no-store");
    return context.json(await resolveAlwaysManifest(db, storage, display));
  });

  app.post("/player/:token/heartbeat", async (context) => {
    const display = await db.query.displays.findFirst({
      where: eq(
        displays.playerTokenHash,
        hashToken(context.req.param("token")),
      ),
    });
    if (!display) throw new ApiError(404, "not_found", "Display not found");
    const body = await parseJsonBody(context, heartbeatSchema);
    await db
      .update(displays)
      .set({ lastSeenAt: new Date(), lastHealth: JSON.stringify(body) })
      .where(eq(displays.id, display.id));
    return context.json({ received: true });
  });
};
