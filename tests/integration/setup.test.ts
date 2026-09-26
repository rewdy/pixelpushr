import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createApp } from "../../apps/api/src/app";
import { createLocalAuth } from "../../apps/api/src/auth/localAuth";
import { createDatabase } from "../../apps/api/src/db/client";
import { invitations, organizations } from "../../apps/api/src/db/schema";
import { createLocalStorage } from "../../apps/api/src/media/localStorage";
import { testDatabaseAdminUrl } from "../config";

const adminUrl = testDatabaseAdminUrl;
const databaseName = `pixelpushr_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let app: ReturnType<typeof createApp>;
let mediaDirectory: string;
let readyImageId: string;
let readyPlaylistId: string;
const sentInvitations: { email: string; url: string }[] = [];

describe("first-run organization setup", () => {
  beforeAll(async () => {
    admin = postgres(adminUrl, { max: 1 });
    await admin`CREATE DATABASE ${admin(databaseName)}`;
    const url = new URL(adminUrl);
    url.pathname = `/${databaseName}`;
    connection = createDatabase(url.toString());
    await migrate(connection.db, {
      migrationsFolder: new URL("../../apps/api/drizzle", import.meta.url)
        .pathname,
    });
    mediaDirectory = await mkdtemp(join(tmpdir(), "pixelpushr-media-test-"));
    app = createApp({
      db: connection.db,
      auth: createLocalAuth(
        connection.db,
        "test-secret-longer-than-thirty-two-characters",
      ),
      mailer: {
        send: async (email, url) => {
          sentInvitations.push({ email, url });
        },
      },
      publicWebUrl: "http://127.0.0.1:5173",
      storage: createLocalStorage(
        mediaDirectory,
        "http://127.0.0.1:5173",
        "test-secret-longer-than-thirty-two-characters",
      ),
    });
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (mediaDirectory) await rm(mediaDirectory, { recursive: true });
    if (admin) {
      await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
      await admin.end();
    }
  });

  test("first authenticated user becomes owner and second setup is rejected", async () => {
    const status = await app.request("/setup/status");
    expect(await status.json()).toEqual({ setupRequired: true });
    const registered = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    expect(registered.status).toBe(201);
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const session = (await login.json()) as { accessToken: string };
    expect(login.status).toBe(200);
    const payload = { name: "First Community", timezone: "America/Chicago" };
    const setup = await app.request("/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(setup.status).toBe(201);
    const me = await app.request("/admin/me", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(me.status).toBe(200);
    expect(
      ((await me.json()) as { membership: { role: string } }).membership.role,
    ).toBe("owner");
    const second = await app.request("/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: {
        code: "conflict",
        message: "Organization setup is already complete",
      },
    });
  });

  test("unauthenticated admin access is denied", async () => {
    const response = await app.request("/admin/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "Administrator session required",
      },
    });
  });

  test("owner invites an admin, rejects duplicates, and recipient accepts", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const invite = () =>
      app.request("/admin/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ email: "new-admin@example.com" }),
      });
    const invitation = await invite();
    expect(invitation.status).toBe(201);
    const invitationBody = (await invitation.json()) as { url: string };
    expect(sentInvitations).toEqual([
      { email: "new-admin@example.com", url: invitationBody.url },
    ]);
    const duplicate = await invite();
    expect(duplicate.status).toBe(409);
    const registered = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new-admin@example.com",
        password: "another-long-password",
      }),
    });
    expect(registered.status).toBe(201);
    const adminLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new-admin@example.com",
        password: "another-long-password",
      }),
    });
    const adminToken = ((await adminLogin.json()) as { accessToken: string })
      .accessToken;
    const token = invitationBody.url.split("/").at(-1)!;
    const accept = () =>
      app.request("/invitations/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ token }),
      });
    const accepted = await accept();
    expect(accepted.status).toBe(200);
    const me = await app.request("/admin/me", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(
      ((await me.json()) as { membership: { role: string } }).membership.role,
    ).toBe("admin");
    const repeat = await accept();
    expect(repeat.status).toBe(409);
  });

  test("expired invitation cannot be accepted and is reported expired", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const invitation = await app.request("/admin/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ email: "expired@example.com" }),
    });
    const { invitation: record, url } = (await invitation.json()) as {
      invitation: { id: string };
      url: string;
    };
    await connection.db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, record.id));
    const registered = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "expired@example.com",
        password: "another-long-password",
      }),
    });
    expect(registered.status).toBe(403);
    const listed = await app.request("/admin/invitations", {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const listedBody = (await listed.json()) as {
      invitations: { id: string; status: string }[];
    };
    expect(
      listedBody.invitations.find((item) => item.id === record.id)?.status,
    ).toBe("expired");
    const accept = await app.request("/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ token: url.split("/").at(-1) }),
    });
    expect(accept.status).toBe(410);
  });

  test("supported upload becomes ready and unsupported upload stays failed", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`,
    };
    const bad = await app.request("/admin/media/uploads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Unsupported",
        mimeType: "application/pdf",
        sizeBytes: 4,
      }),
    });
    expect(bad.status).toBe(201);
    const badBody = (await bad.json()) as {
      asset: { status: string };
      uploadUrl: string | null;
    };
    expect(badBody.asset.status).toBe("failed");
    expect(badBody.uploadUrl).toBeNull();
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const created = await app.request("/admin/media/uploads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Logo",
        mimeType: "image/png",
        sizeBytes: png.byteLength,
      }),
    });
    const { asset, uploadUrl } = (await created.json()) as {
      asset: { id: string; status: string };
      uploadUrl: string;
    };
    readyImageId = asset.id;
    expect(asset.status).toBe("pending");
    const url = new URL(uploadUrl);
    const uploaded = await app.request(
      url.pathname.replace(/^\/api/, "") + url.search,
      { method: "PUT", headers: { "content-type": "image/png" }, body: png },
    );
    expect(uploaded.status).toBe(200);
    const completed = await app.request(`/admin/media/${asset.id}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ width: 1, height: 1 }),
    });
    expect(completed.status).toBe(200);
    expect(
      ((await completed.json()) as { asset: { status: string; width: number } })
        .asset,
    ).toMatchObject({ status: "ready", width: 1 });
    const list = await app.request("/admin/media", {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(
      ((await list.json()) as { assets: { status: string }[] }).assets.map(
        (item) => item.status,
      ),
    ).toContain("ready");
    const forged = await app.request("/admin/media/uploads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Forged PNG",
        mimeType: "image/png",
        sizeBytes: 4,
      }),
    });
    const forgedBody = (await forged.json()) as {
      asset: { id: string };
      uploadUrl: string;
    };
    const forgedUrl = new URL(forgedBody.uploadUrl);
    await app.request(
      forgedUrl.pathname.replace(/^\/api/, "") + forgedUrl.search,
      {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([37, 80, 68, 70]),
      },
    );
    const forgedComplete = await app.request(
      `/admin/media/${forgedBody.asset.id}/complete`,
      { method: "POST", headers, body: "{}" },
    );
    expect(
      ((await forgedComplete.json()) as { asset: { status: string } }).asset
        .status,
    ).toBe("failed");
    const oversize = await app.request("/admin/media/uploads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Too large",
        mimeType: "image/png",
        sizeBytes: 21 * 1024 * 1024,
      }),
    });
    expect(
      ((await oversize.json()) as { asset: { status: string } }).asset.status,
    ).toBe("failed");
  });

  test("playlist item order and playback settings survive reload", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`,
    };
    const created = await app.request("/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Brand loop" }),
    });
    expect(created.status).toBe(201);
    const playlistId = ((await created.json()) as { playlist: { id: string } })
      .playlist.id;
    readyPlaylistId = playlistId;
    const items = [
      { mediaAssetId: readyImageId, imageDurationMs: 8000 },
      { mediaAssetId: readyImageId, imageDurationMs: 3000 },
    ];
    const saved = await app.request(`/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ items }),
    });
    expect(saved.status).toBe(200);
    const reloaded = await app.request(`/admin/playlists/${playlistId}`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(
      (
        (await reloaded.json()) as {
          items: { position: number; imageDurationMs: number }[];
        }
      ).items.map(({ position, imageDurationMs }) => ({
        position,
        imageDurationMs,
      })),
    ).toEqual([
      { position: 0, imageDurationMs: 8000 },
      { position: 1, imageDurationMs: 3000 },
    ]);
    const invalidDuration = await app.request(
      `/admin/playlists/${playlistId}/items`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          items: [{ mediaAssetId: readyImageId, imageDurationMs: 0 }],
        }),
      },
    );
    expect(invalidDuration.status).toBe(400);
    const unavailable = await app.request(
      `/admin/playlists/${playlistId}/items`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          items: [{ mediaAssetId: crypto.randomUUID(), imageDurationMs: 5000 }],
        }),
      },
    );
    expect(unavailable.status).toBe(400);
  });

  test("display URLs are distinct and always playlists form an ordered manifest", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`,
    };
    const createDisplay = (name: string) =>
      app.request("/admin/displays", {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });
    const first = (
      (await (await createDisplay("Lobby")).json()) as {
        display: { id: string; playerUrl: string };
      }
    ).display;
    const second = (
      (await (await createDisplay("Hallway")).json()) as {
        display: { id: string; playerUrl: string };
      }
    ).display;
    expect(first.playerUrl).not.toBe(second.playerUrl);
    const extraPlaylist = await app.request("/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Campaign" }),
    });
    const extraId = (
      (await extraPlaylist.json()) as { playlist: { id: string } }
    ).playlist.id;
    await app.request(`/admin/playlists/${extraId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
      }),
    });
    const assigned = await app.request(`/admin/displays/${first.id}/always`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ playlistIds: [readyPlaylistId, extraId] }),
    });
    expect(assigned.status).toBe(200);
    const token = first.playerUrl.split("/").at(-1)!;
    const manifestResponse = await app.request(`/player/${token}/manifest`);
    expect(manifestResponse.status).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      normalQueue: { playlistId: string; imageDurationMs: number }[];
    };
    expect(
      manifest.normalQueue.map((item) => [
        item.playlistId,
        item.imageDurationMs,
      ]),
    ).toEqual([
      [readyPlaylistId, 8000],
      [readyPlaylistId, 3000],
      [extraId, 5000],
    ]);
    const missing = await app.request("/player/unknown/manifest");
    expect(missing.status).toBe(404);
    const heartbeat = await app.request(`/player/${token}/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        health: "playing",
        itemId: manifest.normalQueue[0]?.playlistId,
      }),
    });
    expect(heartbeat.status).toBe(200);
    const listed = await app.request("/admin/displays", {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const listedBody = (await listed.json()) as {
      displays: { id: string; lastSeenAt: string | null }[];
    };
    expect(
      listedBody.displays.find((display) => display.id === first.id)
        ?.lastSeenAt,
    ).not.toBeNull();
  });

  test("additive schedules combine ordered playlists and rotate across three weeks", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`,
    };
    const created = await app.request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Rotating display" }),
    });
    const displayId = ((await created.json()) as { display: { id: string } })
      .display.id;
    await app.request(`/admin/displays/${displayId}/always`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ playlistIds: [readyPlaylistId] }),
    });
    const campaigns: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const playlistResponse = await app.request("/admin/playlists", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `Campaign ${index + 1}` }),
      });
      const playlistId = (
        (await playlistResponse.json()) as { playlist: { id: string } }
      ).playlist.id;
      campaigns.push(playlistId);
      await app.request(`/admin/playlists/${playlistId}/items`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
        }),
      });
      const day = 7 + index * 7;
      const scheduled = await app.request(
        `/admin/displays/${displayId}/schedules`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            playlistId,
            startLocal: `2026-09-${String(day).padStart(2, "0")}T00:00`,
            endLocal: `2026-09-${String(day + 7).padStart(2, "0")}T00:00`,
            recurrence: "weekly",
            weekInterval: 3,
            position: index,
          }),
        },
      );
      expect(scheduled.status).toBe(201);
    }
    for (const [atLocal, expected] of [
      ["2026-09-08T12:00", campaigns[0]],
      ["2026-09-15T12:00", campaigns[1]],
      ["2026-09-22T12:00", campaigns[2]],
      ["2026-09-29T12:00", campaigns[0]],
    ] as const) {
      const preview = await app.request(
        `/admin/displays/${displayId}/preview?atLocal=${atLocal}`,
        { headers },
      );
      expect(preview.status).toBe(200);
      const manifest = (await preview.json()) as {
        normalQueue: { playlistId: string }[];
      };
      expect([
        ...new Set(manifest.normalQueue.map((item) => item.playlistId)),
      ]).toEqual([readyPlaylistId, expected]);
    }
    const overlap = await app.request(
      `/admin/displays/${displayId}/schedules`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          playlistId: campaigns[2],
          startLocal: "2026-09-08T10:00",
          endLocal: "2026-09-08T14:00",
          recurrence: "none",
          position: 3,
        }),
      },
    );
    expect(overlap.status).toBe(201);
    const overlapId = ((await overlap.json()) as { assignment: { id: string } })
      .assignment.id;
    const overlapping = await app.request(
      `/admin/displays/${displayId}/preview?atLocal=2026-09-08T12:00`,
      { headers },
    );
    expect([
      ...new Set(
        (
          (await overlapping.json()) as {
            normalQueue: { playlistId: string }[];
          }
        ).normalQueue.map((item) => item.playlistId),
      ),
    ]).toEqual([readyPlaylistId, campaigns[0], campaigns[2]]);
    const removed = await app.request(
      `/admin/displays/${displayId}/schedules/${overlapId}`,
      { method: "DELETE", headers },
    );
    expect(removed.status).toBe(200);
    const invalid = await app.request(
      `/admin/displays/${displayId}/schedules`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          playlistId: campaigns[0],
          startLocal: "2026-09-09T12:00",
          endLocal: "2026-09-08T12:00",
          recurrence: "none",
        }),
      },
    );
    expect(invalid.status).toBe(400);
    const empty = await app.request(
      `/admin/displays/${displayId}/preview?atLocal=2026-09-01T12:00`,
      { headers },
    );
    expect([
      ...new Set(
        (
          (await empty.json()) as { normalQueue: { playlistId: string }[] }
        ).normalQueue.map((item) => item.playlistId),
      ),
    ]).toEqual([readyPlaylistId]);
    const organization = await connection.db.query.organizations.findFirst();
    await connection.db
      .update(organizations)
      .set({ timezone: "America/New_York" })
      .where(eq(organizations.id, organization!.id));
    const changed = await app.request(
      `/admin/displays/${displayId}/preview?atLocal=2026-09-08T00:30`,
      { headers },
    );
    expect([
      ...new Set(
        (
          (await changed.json()) as { normalQueue: { playlistId: string }[] }
        ).normalQueue.map((item) => item.playlistId),
      ),
    ]).toEqual([readyPlaylistId, campaigns[0]]);
  });

  test("override priority suppresses normal content and immediate activation has an expiry", async () => {
    const ownerLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = ((await ownerLogin.json()) as { accessToken: string })
      .accessToken;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`,
    };
    const created = await app.request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Event display" }),
    });
    const display = (
      (await created.json()) as { display: { id: string; playerUrl: string } }
    ).display;
    const extra = await app.request("/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Countdown" }),
    });
    const countdownId = ((await extra.json()) as { playlist: { id: string } })
      .playlist.id;
    await app.request(`/admin/playlists/${countdownId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
      }),
    });
    await app.request(`/admin/displays/${display.id}/always`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ playlistIds: [readyPlaylistId] }),
    });
    const createOverride = (
      playlistId: string,
      priority: number,
      startLocal: string,
      endLocal: string,
    ) =>
      app.request(`/admin/displays/${display.id}/overrides`, {
        method: "POST",
        headers,
        body: JSON.stringify({ playlistId, priority, startLocal, endLocal }),
      });
    expect(
      (
        await createOverride(
          readyPlaylistId,
          1,
          "2026-10-01T12:00",
          "2026-10-01T12:05",
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await createOverride(
          countdownId,
          9,
          "2026-10-01T12:01",
          "2026-10-01T12:03",
        )
      ).status,
    ).toBe(201);
    const preview = async (atLocal: string) =>
      (await (
        await app.request(
          `/admin/displays/${display.id}/preview?atLocal=${atLocal}`,
          { headers },
        )
      ).json()) as {
        normalQueue: { playlistId: string }[];
        activeQueue: { playlistId: string }[];
        override: { priority: number } | null;
        transitions: { at: string }[];
      };
    expect((await preview("2026-10-01T11:59")).override).toBeNull();
    const low = await preview("2026-10-01T12:00");
    expect(low.override?.priority).toBe(1);
    expect(low.activeQueue.map((item) => item.playlistId)).toEqual([
      readyPlaylistId,
      readyPlaylistId,
    ]);
    const high = await preview("2026-10-01T12:01");
    expect(high.override?.priority).toBe(9);
    expect(high.activeQueue.map((item) => item.playlistId)).toEqual([
      countdownId,
    ]);
    expect(high.normalQueue.map((item) => item.playlistId)).toEqual([
      readyPlaylistId,
      readyPlaylistId,
    ]);
    expect((await preview("2026-10-01T12:03")).override?.priority).toBe(1);
    expect((await preview("2026-10-01T12:05")).override).toBeNull();
    const now = await app.request(`/admin/displays/${display.id}/overrides`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        playlistId: countdownId,
        activateNow: true,
        endLocal: "2099-01-01T00:00",
        priority: 100,
      }),
    });
    expect(now.status).toBe(201);
    const current = await app.request(
      `/player/${display.playerUrl.split("/").at(-1)}/manifest`,
    );
    expect(
      ((await current.json()) as { override: { priority: number } }).override
        .priority,
    ).toBe(100);
    const missingExpiry = await app.request(
      `/admin/displays/${display.id}/overrides`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ playlistId: countdownId, activateNow: true }),
      },
    );
    expect(missingExpiry.status).toBe(400);
  });
});
