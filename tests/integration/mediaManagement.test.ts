import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MediaDeleteImpact } from "@pixelpushr/contracts/media";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createApp } from "../../apps/api/src/app";
import { createLocalAuth } from "../../apps/api/src/auth/localAuth";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  assignments,
  mediaAssets,
  mediaReplacements,
  mediaTags,
  organizations,
  playlistItems,
  retiredMediaObjects,
} from "../../apps/api/src/db/schema";
import { cleanupMedia } from "../../apps/api/src/media/cleanup";
import { createLocalStorage } from "../../apps/api/src/media/localStorage";
import { testDatabaseAdminUrl } from "../config";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
const pngNext = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 5, 6, 7, 8]);
const databaseName = `pixelpushr_media_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let storage: ReturnType<typeof createLocalStorage>;
let app: ReturnType<typeof createApp>;
let directory: string;
let headers: Record<string, string>;
let imageId: string;
let firstPlaylistId: string;
let displayToken: string;
let displayId: string;
let originalManifestUrl: string;
let replacementManifestUrl: string;

const json = (body: unknown) => JSON.stringify(body);
const uploadBytes = async (
  uploadUrl: string,
  bytes: Uint8Array,
  mimeType = "image/png",
) => {
  const url = new URL(uploadUrl);
  return app.request(url.pathname.replace(/^\/api/, "") + url.search, {
    method: "PUT",
    headers: { "content-type": mimeType },
    body: bytes,
  });
};
const uploadImage = async (name: string) => {
  const started = await app.request("/admin/media/uploads", {
    method: "POST",
    headers,
    body: json({ name, mimeType: "image/png", sizeBytes: png.length }),
  });
  expect(started.status).toBe(201);
  const body = (await started.json()) as {
    asset: { id: string };
    uploadUrl: string;
  };
  expect((await uploadBytes(body.uploadUrl, png)).status).toBe(200);
  const completed = await app.request(
    `/admin/media/${body.asset.id}/complete`,
    {
      method: "POST",
      headers,
      body: json({ width: 1, height: 1 }),
    },
  );
  expect(completed.status).toBe(200);
  return body.asset.id;
};
const createPlaylist = async (
  name: string,
  items: Array<{ mediaAssetId: string; imageDurationMs: number }>,
) => {
  const created = await app.request("/admin/playlists", {
    method: "POST",
    headers,
    body: json({ name }),
  });
  const body = (await created.json()) as { playlist: { id: string } };
  const saved = await app.request(
    `/admin/playlists/${body.playlist.id}/items`,
    {
      method: "PUT",
      headers,
      body: json({ items }),
    },
  );
  expect(saved.status).toBe(200);
  return body.playlist.id;
};

describe("media management", () => {
  beforeAll(async () => {
    admin = postgres(testDatabaseAdminUrl, { max: 1 });
    await admin`CREATE DATABASE ${admin(databaseName)}`;
    const url = new URL(testDatabaseAdminUrl);
    url.pathname = `/${databaseName}`;
    connection = createDatabase(url.toString());
    await migrate(connection.db, {
      migrationsFolder: new URL("../../apps/api/drizzle", import.meta.url)
        .pathname,
    });
    directory = await mkdtemp(join(tmpdir(), "pixelpushr-management-"));
    storage = createLocalStorage(
      directory,
      "http://127.0.0.1:5173",
      "test-secret-longer-than-thirty-two-characters",
    );
    app = createApp({
      db: connection.db,
      auth: createLocalAuth(
        connection.db,
        "test-secret-longer-than-thirty-two-characters",
      ),
      storage,
      mailer: { send: async () => {} },
      publicWebUrl: "http://127.0.0.1:5173",
    });
    expect(
      (
        await app.request("/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: json({
            email: "owner@example.com",
            password: "super-long-password",
          }),
        })
      ).status,
    ).toBe(201);
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = ((await login.json()) as { accessToken: string }).accessToken;
    headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    expect(
      (
        await app.request("/setup", {
          method: "POST",
          headers,
          body: json({ name: "Media management", timezone: "UTC" }),
        })
      ).status,
    ).toBe(201);
    imageId = await uploadImage("Original image");
  });
  afterAll(async () => {
    if (connection) await connection.close();
    if (admin) {
      await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
      await admin.end();
    }
    if (directory) await rm(directory, { recursive: true });
  });

  test("tags reuse labels case-insensitively and filters combine OR tags with name search", async () => {
    const otherId = await uploadImage("Campaign image");
    const put = (id: string, tags: string[]) =>
      app.request(`/admin/media/${id}/tags`, {
        method: "PUT",
        headers,
        body: json({ tags }),
      });
    expect((await put(imageId, ["Events", "Weekly"])).status).toBe(200);
    expect((await put(otherId, ["events"])).status).toBe(200);
    const tags = (await (
      await app.request("/admin/media/tags", { headers })
    ).json()) as {
      tags: Array<{ id: string; name: string }>;
    };
    expect(tags.tags).toHaveLength(2);
    const [otherOrganization] = await connection.db
      .insert(organizations)
      .values({ name: "Other" })
      .returning();
    if (!otherOrganization) throw new Error("Missing other organization");
    await connection.db.insert(mediaTags).values({
      organizationId: otherOrganization.id,
      name: "Private tag",
      normalizedName: "private tag",
    });
    const [foreignAsset] = await connection.db
      .insert(mediaAssets)
      .values({
        organizationId: otherOrganization.id,
        name: "Foreign asset",
        kind: "image",
        status: "ready",
        mimeType: "image/png",
        objectKey: `${otherOrganization.id}/${crypto.randomUUID()}`,
        sizeBytes: png.length,
      })
      .returning();
    if (!foreignAsset) throw new Error("Missing foreign asset");
    expect(
      (
        await app.request(`/admin/media/${foreignAsset.id}/delete-impact`, {
          headers,
        })
      ).status,
    ).toBe(404);
    const scopedTags = (await (
      await app.request("/admin/media/tags", { headers })
    ).json()) as { tags: Array<{ name: string }> };
    expect(scopedTags.tags.map((tag) => tag.name)).not.toContain("Private tag");
    const eventId = tags.tags.find((tag) => tag.name === "Events")?.id;
    const weeklyId = tags.tags.find((tag) => tag.name === "Weekly")?.id;
    expect(eventId).toBeTruthy();
    expect(weeklyId).toBeTruthy();
    const filtered = await app.request(
      `/admin/media?search=Original&tags=${eventId},${weeklyId}`,
      { headers },
    );
    expect(
      ((await filtered.json()) as { assets: Array<{ id: string }> }).assets.map(
        (asset) => asset.id,
      ),
    ).toEqual([imageId]);
    const eventsOnly = await app.request(`/admin/media?tags=${eventId}`, {
      headers,
    });
    expect(
      ((await eventsOnly.json()) as { assets: Array<{ id: string }> }).assets,
    ).toHaveLength(2);
    expect((await put(otherId, [])).status).toBe(200);
    const afterRemoval = await app.request(`/admin/media?tags=${weeklyId}`, {
      headers,
    });
    expect(
      (
        (await afterRemoval.json()) as { assets: Array<{ id: string }> }
      ).assets.map((asset) => asset.id),
    ).toEqual([imageId]);
  });

  test("replacement validates before publication and preserves playlist references", async () => {
    firstPlaylistId = await createPlaylist("Brand", [
      { mediaAssetId: imageId, imageDurationMs: 8000 },
      { mediaAssetId: imageId, imageDurationMs: 3000 },
    ]);
    const createdDisplay = await app.request("/admin/displays", {
      method: "POST",
      headers,
      body: json({ name: "Media test display" }),
    });
    expect(createdDisplay.status).toBe(201);
    const display = (await createdDisplay.json()) as {
      display: { id: string; playerUrl: string };
    };
    displayId = display.display.id;
    displayToken = display.display.playerUrl.split("/").at(-1) ?? "";
    expect(
      (
        await app.request(`/admin/displays/${display.display.id}/always`, {
          method: "PUT",
          headers,
          body: json({ playlistIds: [firstPlaylistId] }),
        })
      ).status,
    ).toBe(200);
    const initialManifest = (await (
      await app.request(`/player/${displayToken}/manifest`)
    ).json()) as {
      version: string;
      normalQueue: Array<{ id: string; url: string; assetId: string }>;
    };
    expect(initialManifest.normalQueue).toHaveLength(2);
    originalManifestUrl = initialManifest.normalQueue[0]?.url ?? "";
    const before = await connection.db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, imageId),
    });
    if (!before) throw new Error("Missing original image");
    const itemRows = await connection.db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, firstPlaylistId));
    const wrongKind = await app.request(
      `/admin/media/${imageId}/replacements`,
      {
        method: "POST",
        headers,
        body: json({ mimeType: "video/mp4", sizeBytes: 16 }),
      },
    );
    expect(wrongKind.status).toBe(400);
    const start = async () => {
      const response = await app.request(
        `/admin/media/${imageId}/replacements`,
        {
          method: "POST",
          headers,
          body: json({ mimeType: "image/png", sizeBytes: pngNext.length }),
        },
      );
      expect(response.status).toBe(201);
      return response.json() as Promise<{
        replacementId: string;
        uploadUrl: string;
      }>;
    };
    const missing = await start();
    expect(
      (
        await app.request(
          `/admin/media/${imageId}/replacements/${missing.replacementId}/complete`,
          {
            method: "POST",
            headers,
            body: json({ width: 1, height: 1 }),
          },
        )
      ).status,
    ).toBe(400);
    const invalid = await start();
    const badBytes = new Uint8Array(pngNext.length).fill(1);
    expect((await uploadBytes(invalid.uploadUrl, badBytes)).status).toBe(200);
    expect(
      (
        await app.request(
          `/admin/media/${imageId}/replacements/${invalid.replacementId}/complete`,
          {
            method: "POST",
            headers,
            body: json({ width: 1, height: 1 }),
          },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await connection.db.query.mediaAssets.findFirst({
          where: eq(mediaAssets.id, imageId),
        })
      )?.objectKey,
    ).toBe(before.objectKey);
    const valid = await start();
    expect((await uploadBytes(valid.uploadUrl, pngNext)).status).toBe(200);
    const completeUrl = `/admin/media/${imageId}/replacements/${valid.replacementId}/complete`;
    const completions = await Promise.all(
      [0, 1].map(() =>
        app.request(completeUrl, {
          method: "POST",
          headers,
          body: json({ width: 2, height: 2 }),
        }),
      ),
    );
    expect(completions.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const after = await connection.db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, imageId),
    });
    expect(after?.objectKey).not.toBe(before.objectKey);
    expect(after?.name).toBe(before.name);
    const staging = await connection.db.query.mediaReplacements.findFirst({
      where: eq(mediaReplacements.id, valid.replacementId),
    });
    if (!after || !staging) throw new Error("Missing published replacement");
    expect(after.objectKey).not.toBe(staging.objectKey);
    expect(await storage.readPrefix(after.objectKey, pngNext.length)).toEqual(
      pngNext,
    );
    // The 15-minute PUT URL remains valid, but it can only change staging.
    expect((await uploadBytes(valid.uploadUrl, badBytes)).status).toBe(200);
    expect(
      await storage.readPrefix(staging.objectKey, badBytes.length),
    ).toEqual(badBytes);
    expect(await storage.readPrefix(after.objectKey, pngNext.length)).toEqual(
      pngNext,
    );
    expect(
      await connection.db
        .select()
        .from(retiredMediaObjects)
        .where(eq(retiredMediaObjects.objectKey, staging.objectKey)),
    ).toHaveLength(1);
    expect(
      await connection.db
        .select()
        .from(retiredMediaObjects)
        .where(eq(retiredMediaObjects.objectKey, after.objectKey)),
    ).toHaveLength(0);
    const newManifest = (await (
      await app.request(`/player/${displayToken}/manifest`)
    ).json()) as {
      version: string;
      normalQueue: Array<{ id: string; url: string; assetId: string }>;
    };
    expect(newManifest.version).not.toBe(initialManifest.version);
    expect(newManifest.normalQueue.map((item) => item.id)).toEqual(
      initialManifest.normalQueue.map((item) => item.id),
    );
    expect(newManifest.normalQueue[0]?.url).not.toBe(originalManifestUrl);
    replacementManifestUrl = newManifest.normalQueue[0]?.url ?? "";
    expect(replacementManifestUrl).toBe(storage.publicUrl(after.objectKey));
    expect(JSON.stringify(newManifest)).not.toContain('"tags"');
    expect(
      (
        await app.request(
          new URL(originalManifestUrl).pathname.replace(/^\/api/, ""),
        )
      ).status,
    ).toBe(200);
    const list = await app.request("/admin/media", { headers });
    const listed = (
      (await list.json()) as {
        assets: Array<{ id: string; tags: Array<{ name: string }> }>;
      }
    ).assets.find((asset) => asset.id === imageId);
    expect(listed?.tags.map((tag) => tag.name).sort()).toEqual([
      "Events",
      "Weekly",
    ]);
    expect(
      (
        await connection.db
          .select()
          .from(playlistItems)
          .where(eq(playlistItems.playlistId, firstPlaylistId))
      ).map((item) => item.id),
    ).toEqual(itemRows.map((item) => item.id));
    expect(await storage.head(before.objectKey)).not.toBeNull();
    expect(
      await connection.db
        .select()
        .from(retiredMediaObjects)
        .where(eq(retiredMediaObjects.objectKey, before.objectKey)),
    ).toHaveLength(1);
  });

  test("invalid server copy cannot publish and remains reserved for cleanup", async () => {
    const before = await connection.db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, imageId),
    });
    if (!before) throw new Error("Missing original image");
    const started = await app.request(`/admin/media/${imageId}/replacements`, {
      method: "POST",
      headers,
      body: json({ mimeType: "image/png", sizeBytes: pngNext.length }),
    });
    expect(started.status).toBe(201);
    const candidate = (await started.json()) as {
      replacementId: string;
      uploadUrl: string;
    };
    expect((await uploadBytes(candidate.uploadUrl, pngNext)).status).toBe(200);
    const originalCopy = storage.copy;
    let finalKey = "";
    storage.copy = async (source, target) => {
      finalKey = target;
      await originalCopy(source, target);
      await storage.writeSmall(
        target,
        "image/png",
        new Uint8Array(pngNext.length).fill(1),
      );
    };
    try {
      const response = await app.request(
        `/admin/media/${imageId}/replacements/${candidate.replacementId}/complete`,
        { method: "POST", headers, body: json({ width: 1, height: 1 }) },
      );
      expect(response.status).toBe(400);
    } finally {
      storage.copy = originalCopy;
    }
    expect(finalKey).not.toBe("");
    expect(
      (
        await connection.db.query.mediaAssets.findFirst({
          where: eq(mediaAssets.id, imageId),
        })
      )?.objectKey,
    ).toBe(before.objectKey);
    expect(
      await connection.db
        .select()
        .from(retiredMediaObjects)
        .where(eq(retiredMediaObjects.objectKey, finalKey)),
    ).toHaveLength(1);
  });

  test("video replacement keeps playback mode, clears poster, and rejects late thumbnails", async () => {
    const mp4 = new Uint8Array([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    const started = await app.request("/admin/media/uploads", {
      method: "POST",
      headers,
      body: json({
        name: "Event video",
        mimeType: "video/mp4",
        sizeBytes: mp4.length,
      }),
    });
    const initial = (await started.json()) as {
      asset: { id: string };
      uploadUrl: string;
    };
    expect(
      (await uploadBytes(initial.uploadUrl, mp4, "video/mp4")).status,
    ).toBe(200);
    const ready = await app.request(
      `/admin/media/${initial.asset.id}/complete`,
      {
        method: "POST",
        headers,
        body: json({ durationMs: 5000 }),
      },
    );
    const readyAsset = (await ready.json()) as {
      asset: { contentVersion: string };
    };
    const jpeg = new Uint8Array([255, 216, 255, 224, 0, 1, 255, 217]);
    const poster = await app.request(
      `/admin/media/${initial.asset.id}/thumbnail`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "content-type": "image/jpeg",
          "x-media-version": readyAsset.asset.contentVersion,
        },
        body: jpeg,
      },
    );
    expect(poster.status).toBe(200);
    const oldPoster = (
      (await poster.json()) as { asset: { thumbnailKey: string } }
    ).asset.thumbnailKey;
    const playlist = await app.request("/admin/playlists", {
      method: "POST",
      headers,
      body: json({ name: "Video playlist" }),
    });
    const playlistId = ((await playlist.json()) as { playlist: { id: string } })
      .playlist.id;
    expect(
      (
        await app.request(`/admin/playlists/${playlistId}/items`, {
          method: "PUT",
          headers,
          body: json({
            items: [
              {
                mediaAssetId: initial.asset.id,
                videoMode: "repeat",
                repeatDurationMs: 9000,
              },
            ],
          }),
        })
      ).status,
    ).toBe(200);
    const replacement = await app.request(
      `/admin/media/${initial.asset.id}/replacements`,
      {
        method: "POST",
        headers,
        body: json({ mimeType: "video/mp4", sizeBytes: mp4.length }),
      },
    );
    const replacementBody = (await replacement.json()) as {
      replacementId: string;
      uploadUrl: string;
    };
    expect(
      (await uploadBytes(replacementBody.uploadUrl, mp4, "video/mp4")).status,
    ).toBe(200);
    const completed = await app.request(
      `/admin/media/${initial.asset.id}/replacements/${replacementBody.replacementId}/complete`,
      {
        method: "POST",
        headers,
        body: json({ durationMs: 7000 }),
      },
    );
    expect(completed.status).toBe(200);
    const replaced = (await completed.json()) as {
      asset: { previewUrl: string | null; durationMs: number };
    };
    expect(replaced.asset.previewUrl).toBeNull();
    expect(replaced.asset.durationMs).toBe(7000);
    expect(await storage.head(oldPoster)).not.toBeNull();
    expect(
      (
        await app.request(`/admin/media/${initial.asset.id}/thumbnail`, {
          method: "PUT",
          headers: {
            ...headers,
            "content-type": "image/jpeg",
            "x-media-version": readyAsset.asset.contentVersion,
          },
          body: jpeg,
        })
      ).status,
    ).toBe(409);
    const detail = await app.request(`/admin/playlists/${playlistId}`, {
      headers,
    });
    const items = (await detail.json()) as {
      items: Array<{ videoMode: string; repeatDurationMs: number }>;
    };
    expect(items.items[0]).toMatchObject({
      videoMode: "repeat",
      repeatDurationMs: 9000,
    });
  });

  test("deletion rejects a stale impact and removes only confirmed uses", async () => {
    const otherId = await uploadImage("Keep this item");
    const secondPlaylistId = await createPlaylist("Campaign", [
      { mediaAssetId: otherId, imageDurationMs: 4000 },
      { mediaAssetId: imageId, imageDurationMs: 4000 },
      { mediaAssetId: otherId, imageDurationMs: 5000 },
    ]);
    const impactResponse = await app.request(
      `/admin/media/${imageId}/delete-impact`,
      { headers },
    );
    expect(impactResponse.status).toBe(200);
    const impact = (await impactResponse.json()) as MediaDeleteImpact;
    expect(impact.totalItems).toBe(3);
    expect(impact.playlists.map((playlist) => playlist.id).sort()).toEqual(
      [firstPlaylistId, secondPlaylistId].sort(),
    );
    expect(
      (
        await app.request(`/admin/media/${imageId}`, {
          method: "DELETE",
          headers,
          body: json({ snapshotToken: "0".repeat(64) }),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(`/admin/media/${imageId}`, {
          method: "DELETE",
          headers,
          body: json({ snapshotToken: impact.snapshotToken }),
        })
      ).status,
    ).toBe(200);
    const remaining = await connection.db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, secondPlaylistId));
    expect(
      remaining
        .sort((a, b) => a.position - b.position)
        .map((item) => [item.position, item.mediaAssetId]),
    ).toEqual([
      [0, otherId],
      [2, otherId],
    ]);
    expect(
      await connection.db
        .select()
        .from(assignments)
        .where(eq(assignments.displayId, displayId)),
    ).toHaveLength(1);
    expect(
      await connection.db
        .select()
        .from(playlistItems)
        .where(eq(playlistItems.playlistId, firstPlaylistId)),
    ).toHaveLength(0);
    expect(
      await connection.db.query.mediaAssets.findFirst({
        where: eq(mediaAssets.id, imageId),
      }),
    ).toBeUndefined();
    const afterDeletion = (await (
      await app.request(`/player/${displayToken}/manifest`)
    ).json()) as {
      normalQueue: Array<{ assetId: string }>;
    };
    expect(afterDeletion.normalQueue).toHaveLength(0);
    expect(
      (
        await app.request(
          new URL(replacementManifestUrl).pathname.replace(/^\/api/, ""),
        )
      ).status,
    ).toBe(200);
  });

  test("concurrent playlist save and confirmed deletion cannot silently add a use", async () => {
    const racingAssetId = await uploadImage("Race image");
    const racingPlaylistId = await createPlaylist("Race playlist", [
      { mediaAssetId: racingAssetId, imageDurationMs: 3000 },
    ]);
    const impact = (await (
      await app.request(`/admin/media/${racingAssetId}/delete-impact`, {
        headers,
      })
    ).json()) as MediaDeleteImpact;
    const [save, deletion] = await Promise.all([
      app.request(`/admin/playlists/${racingPlaylistId}/items`, {
        method: "PUT",
        headers,
        body: json({
          items: [
            { mediaAssetId: racingAssetId, imageDurationMs: 3000 },
            { mediaAssetId: racingAssetId, imageDurationMs: 4000 },
          ],
        }),
      }),
      app.request(`/admin/media/${racingAssetId}`, {
        method: "DELETE",
        headers,
        body: json({ snapshotToken: impact.snapshotToken }),
      }),
    ]);
    expect(
      [save.status, deletion.status].filter((status) => status === 200),
    ).toHaveLength(1);
    expect([400, 409]).toContain(
      save.status === 200 ? deletion.status : save.status,
    );
    const current = await connection.db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, racingAssetId),
    });
    const uses = await connection.db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.mediaAssetId, racingAssetId));
    if (current) expect(uses).toHaveLength(2);
    else expect(uses).toHaveLength(0);
  });

  test("cleanup removes expired retired files but not live media", async () => {
    const retired = await connection.db.select().from(retiredMediaObjects);
    expect(retired.length).toBeGreaterThan(0);
    const firstRetired = retired[0];
    if (!firstRetired) throw new Error("Missing retired object");
    const live = await connection.db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.kind, "image"),
    });
    if (!live) throw new Error("Missing live asset");
    const pending = await app.request(`/admin/media/${live.id}/replacements`, {
      method: "POST",
      headers,
      body: json({ mimeType: live.mimeType, sizeBytes: png.length }),
    });
    expect(pending.status).toBe(201);
    const pendingBody = (await pending.json()) as {
      replacementId: string;
      uploadUrl: string;
    };
    expect((await uploadBytes(pendingBody.uploadUrl, png)).status).toBe(200);
    const candidate = await connection.db.query.mediaReplacements.findFirst({
      where: eq(mediaReplacements.id, pendingBody.replacementId),
    });
    if (!candidate) throw new Error("Missing pending replacement");
    await connection.db
      .update(mediaReplacements)
      .set({ createdAt: new Date(Date.now() - 2 * 86400000) })
      .where(eq(mediaReplacements.id, candidate.id));
    const result = await cleanupMedia(
      connection.db,
      storage,
      new Date(Date.now() + 8 * 86400000),
    );
    expect(result.removedCandidates).toBeGreaterThan(0);
    expect(await storage.head(candidate.objectKey)).toBeNull();
    expect(result.removedObjects).toBeGreaterThan(0);
    expect(await storage.head(firstRetired.objectKey)).toBeNull();
    expect(await storage.head(live.objectKey)).not.toBeNull();
    expect(
      (
        await cleanupMedia(
          connection.db,
          storage,
          new Date(Date.now() + 8 * 86400000),
        )
      ).removedObjects,
    ).toBe(0);
  });
});
