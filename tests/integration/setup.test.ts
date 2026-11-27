import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CreateInvitationResponse,
  SendInvitationEmailResponse,
} from "@pixelpushr/contracts/invitations";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createApp } from "../../apps/api/src/app";
import { createLocalAuth } from "../../apps/api/src/auth/localAuth";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  assignments,
  displays,
  invitations,
  organizations,
  scheduleRules,
} from "../../apps/api/src/db/schema";
import { createLocalStorage } from "../../apps/api/src/media/localStorage";
import { testDatabaseAdminUrl } from "../config";
import { browserRequest, loginCookie } from "../fixtures/authRequests";

const adminUrl = testDatabaseAdminUrl;
const databaseName = `pixelpushr_test_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let request: ReturnType<typeof browserRequest>;
let mediaDirectory: string;
let readyImageId: string;
let readyPlaylistId: string;
let mediaStorage: ReturnType<typeof createLocalStorage>;
const sentInvitations: { email: string; url: string }[] = [];
let stalledEmail:
  | { signal: AbortSignal; reject: (error: Error) => void }
  | undefined;

const sendInvitationEmail = (sessionCookie: string, url: string) =>
  request("/admin/invitations/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie,
    },
    body: JSON.stringify({ token: new URL(url).pathname.split("/").at(-1) }),
  });

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
    mediaStorage = createLocalStorage(
      mediaDirectory,
      "http://127.0.0.1:5173",
      "test-secret-longer-than-thirty-two-characters",
    );
    request = browserRequest(
      createApp({
        db: connection.db,
        auth: createLocalAuth(
          connection.db,
          "test-secret-longer-than-thirty-two-characters",
        ),
        mailer: {
          send: async (email, url, signal) => {
            sentInvitations.push({ email, url });
            if (email === "new-admin@example.com")
              throw new Error("Provider rejected submission");
            if (email === "stalled@example.com") {
              return new Promise<void>((_resolve, reject) => {
                stalledEmail = { signal, reject };
              });
            }
          },
        },
        publicWebUrl: "http://127.0.0.1:5173",
        initialOwnerEmail: "owner@example.com",
        storage: mediaStorage,
      }),
    );
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (mediaDirectory) await rm(mediaDirectory, { recursive: true });
    if (admin) {
      await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
      await admin.end();
    }
  });

  test("another authenticated account cannot claim an empty workspace", async () => {
    const credentials = {
      email: "other@example.com",
      password: "super-long-password",
    };
    const credentialsRequest = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    };
    expect((await request("/auth/register", credentialsRequest)).status).toBe(
      201,
    );
    const login = await request("/auth/login", credentialsRequest);
    expect(login.status).toBe(200);
    const sessionCookie = loginCookie(login);
    const setup = await request("/setup", {
      method: "POST",
      headers: {
        ...credentialsRequest.headers,
        cookie: sessionCookie,
      },
      body: JSON.stringify({ name: "Other", timezone: "America/Chicago" }),
    });
    expect(setup.status).toBe(403);
    expect(await (await request("/setup/status")).json()).toEqual({
      setupRequired: true,
    });
  });

  test("designated account becomes owner and second setup is rejected", async () => {
    const status = await request("/setup/status");
    expect(await status.json()).toEqual({ setupRequired: true });
    const registered = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    expect(registered.status).toBe(201);
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const session = loginCookie(login);
    expect(login.status).toBe(200);
    const payload = { name: "First Community", timezone: "America/Chicago" };
    const setup = await request("/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session,
      },
      body: JSON.stringify(payload),
    });
    expect(setup.status).toBe(201);
    const me = await request("/admin/me", {
      headers: { cookie: session },
    });
    expect(me.status).toBe(200);
    expect(
      ((await me.json()) as { membership: { role: string } }).membership.role,
    ).toBe("owner");
    const second = await request("/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session,
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
    const response = await request("/admin/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "session_required",
        message: "Sign in to continue.",
      },
    });
  });

  test("owner invites an admin, rejects duplicates, and recipient accepts", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const invite = () =>
      request("/admin/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: ownerToken,
        },
        body: JSON.stringify({ email: "new-admin@example.com" }),
      });
    const invitation = await invite();
    expect(invitation.status).toBe(201);
    expect(invitation.headers.get("Cache-Control")).toBe("no-store");
    const invitationBody =
      (await invitation.json()) as CreateInvitationResponse;
    expect(sentInvitations).toHaveLength(0);
    const emailResponse = await sendInvitationEmail(
      ownerToken,
      invitationBody.url,
    );
    expect(emailResponse.status).toBe(200);
    expect((await emailResponse.json()) as SendInvitationEmailResponse).toEqual(
      {
        emailStatus: "unconfirmed",
      },
    );
    const duplicate = await invite();
    expect(duplicate.status).toBe(409);
    const registered = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new-admin@example.com",
        password: "another-long-password",
      }),
    });
    expect(registered.status).toBe(201);
    const adminLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new-admin@example.com",
        password: "another-long-password",
      }),
    });
    const adminToken = loginCookie(adminLogin);
    const token = invitationBody.url.split("/").at(-1);
    if (!token) throw new Error("Invitation URL has no token");
    const accept = (sessionCookie: string) =>
      request("/invitations/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({ token }),
      });
    const listed = await request("/admin/invitations", {
      headers: { cookie: ownerToken },
    });
    const list = (await listed.json()) as {
      invitations: Record<string, unknown>[];
    };
    const record = list.invitations.find(
      (item) => item.id === invitationBody.invitation.id,
    );
    expect(record).toMatchObject({ status: "pending" });
    expect(record).not.toHaveProperty("url");
    expect(record).not.toHaveProperty("token");
    expect(record).not.toHaveProperty("tokenHash");
    expect((await accept(ownerToken)).status).toBe(403);
    const accepted = await accept(adminToken);
    expect(accepted.status).toBe(200);
    const me = await request("/admin/me", {
      headers: { cookie: adminToken },
    });
    expect(
      ((await me.json()) as { membership: { role: string } }).membership.role,
    ).toBe("admin");
    const repeat = await accept(adminToken);
    expect(repeat.status).toBe(409);
    expect(
      (
        await request(`/admin/invitations/${invitationBody.invitation.id}`, {
          method: "DELETE",
          headers: { cookie: ownerToken },
        })
      ).status,
    ).toBe(404);
    const unauthorized = await request("/admin/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: adminToken,
      },
      body: JSON.stringify({ email: "other-invite@example.com" }),
    });
    expect(unauthorized.status).toBe(403);
    expect(
      (await sendInvitationEmail(adminToken, invitationBody.url)).status,
    ).toBe(403);
    expect(
      (await sendInvitationEmail(ownerToken, invitationBody.url)).status,
    ).toBe(409);
    expect(
      (
        await sendInvitationEmail(
          ownerToken,
          "https://example.com/invite/unknown-invitation-token",
        )
      ).status,
    ).toBe(404);
    expect(sentInvitations).toHaveLength(1);
  });

  test("only the owner can revoke a pending invitation and reissue it", async () => {
    const login = async (email: string, password: string) => {
      const response = await request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      expect(response.status).toBe(200);
      return loginCookie(response);
    };
    const owner = await login("owner@example.com", "super-long-password");
    const administrator = await login(
      "new-admin@example.com",
      "another-long-password",
    );
    const headers = {
      "content-type": "application/json",
      cookie: owner,
    };
    const create = () =>
      request("/admin/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "lost-link@example.com" }),
      });
    const response = await create();
    expect(response.status).toBe(201);
    const original = (await response.json()) as CreateInvitationResponse;
    const revoke = (id: string, sessionCookie: string) =>
      request(`/admin/invitations/${id}`, {
        method: "DELETE",
        headers: { cookie: sessionCookie },
      });
    expect((await revoke("invalid", owner)).status).toBe(400);
    expect((await revoke(original.invitation.id, administrator)).status).toBe(
      403,
    );
    expect((await create()).status).toBe(409);
    expect((await revoke(original.invitation.id, owner)).status).toBe(200);
    expect((await revoke(original.invitation.id, owner)).status).toBe(404);
    const replacement = await create();
    expect(replacement.status).toBe(201);
    expect(
      ((await replacement.json()) as CreateInvitationResponse).url,
    ).not.toBe(original.url);
    const listed = await request("/admin/invitations", { headers });
    const { invitations: listedInvitations } = (await listed.json()) as {
      invitations: { id: string }[];
    };
    expect(
      listedInvitations.some(({ id }) => id === original.invitation.id),
    ).toBe(false);
    const accept = await request("/invitations/accept", {
      method: "POST",
      headers,
      body: JSON.stringify({
        token: new URL(original.url).pathname.split("/").at(-1),
      }),
    });
    expect(accept.status).toBe(404);
    expect((await sendInvitationEmail(owner, original.url)).status).toBe(404);
  });

  test("expired invitation cannot be accepted and is reported expired", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const invitation = await request("/admin/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerToken,
      },
      body: JSON.stringify({ email: "expired@example.com" }),
    });
    expect(invitation.status).toBe(201);
    const { invitation: record, url } =
      (await invitation.json()) as CreateInvitationResponse;
    const emailResponse = await sendInvitationEmail(ownerToken, url);
    expect(emailResponse.status).toBe(200);
    expect((await emailResponse.json()) as SendInvitationEmailResponse).toEqual(
      {
        emailStatus: "submitted",
      },
    );
    expect(sentInvitations).toContainEqual({
      email: "expired@example.com",
      url,
    });
    await connection.db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, record.id));
    const registered = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "expired@example.com",
        password: "another-long-password",
      }),
    });
    expect(registered.status).toBe(403);
    const listed = await request("/admin/invitations", {
      headers: { cookie: ownerToken },
    });
    const listedBody = (await listed.json()) as {
      invitations: { id: string; status: string }[];
    };
    expect(
      listedBody.invitations.find((item) => item.id === record.id)?.status,
    ).toBe("expired");
    const accept = await request("/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerToken,
      },
      body: JSON.stringify({ token: url.split("/").at(-1) }),
    });
    expect(accept.status).toBe(410);
    expect(
      (
        await request(`/admin/invitations/${record.id}`, {
          method: "DELETE",
          headers: { cookie: ownerToken },
        })
      ).status,
    ).toBe(404);
    expect((await sendInvitationEmail(ownerToken, url)).status).toBe(410);
    expect(
      sentInvitations.filter(({ email }) => email === "expired@example.com"),
    ).toHaveLength(1);
  });

  test("a stalled optional mail attempt reaches its deadline independently of creation", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const sessionCookie = loginCookie(ownerLogin);
    const response = await request("/admin/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: JSON.stringify({ email: "stalled@example.com" }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as CreateInvitationResponse;
    expect(stalledEmail).toBeUndefined();
    const emailResponse = await sendInvitationEmail(sessionCookie, body.url);
    expect(emailResponse.status).toBe(200);
    expect((await emailResponse.json()) as SendInvitationEmailResponse).toEqual(
      {
        emailStatus: "unconfirmed",
      },
    );
    expect(body.invitation.status).toBe("pending");
    expect(body.url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/invite\//);
    expect(stalledEmail?.signal.aborted).toBe(true);
    stalledEmail?.reject(new Error("Late mail provider rejection"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }, 10_000);

  test("supported upload becomes ready and unsupported upload stays failed", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const headers = {
      "content-type": "application/json",
      cookie: ownerToken,
    };
    const bad = await request("/admin/media/uploads", {
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
    const created = await request("/admin/media/uploads", {
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
    const uploaded = await request(
      url.pathname.replace(/^\/api/, "") + url.search,
      { method: "PUT", headers: { "content-type": "image/png" }, body: png },
    );
    expect(uploaded.status).toBe(200);
    const completed = await request(`/admin/media/${asset.id}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ width: 1, height: 1 }),
    });
    expect(completed.status).toBe(200);
    expect(
      ((await completed.json()) as { asset: { status: string; width: number } })
        .asset,
    ).toMatchObject({ status: "ready", width: 1 });
    const list = await request("/admin/media", {
      headers: { cookie: ownerToken },
    });
    expect(
      ((await list.json()) as { assets: { status: string }[] }).assets.map(
        (item) => item.status,
      ),
    ).toContain("ready");
    const forged = await request("/admin/media/uploads", {
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
    await request(forgedUrl.pathname.replace(/^\/api/, "") + forgedUrl.search, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([37, 80, 68, 70]),
    });
    const forgedComplete = await request(
      `/admin/media/${forgedBody.asset.id}/complete`,
      { method: "POST", headers, body: "{}" },
    );
    expect(
      ((await forgedComplete.json()) as { asset: { status: string } }).asset
        .status,
    ).toBe("failed");
    const oversize = await request("/admin/media/uploads", {
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

  test("ready video thumbnails validate uploads, serialize, and clean up", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = { cookie: token };
    const mp4 = new Uint8Array([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    const created = await request("/admin/media/uploads", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Countdown",
        mimeType: "video/mp4",
        sizeBytes: mp4.length,
      }),
    });
    const { asset, uploadUrl } = (await created.json()) as {
      asset: { id: string };
      uploadUrl: string;
    };
    const upload = new URL(uploadUrl);
    expect(
      (
        await request(upload.pathname.replace(/^\/api/, "") + upload.search, {
          method: "PUT",
          headers: { "content-type": "video/mp4" },
          body: mp4,
        })
      ).status,
    ).toBe(200);
    const completed = await request(`/admin/media/${asset.id}/complete`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ width: 640, height: 360, durationMs: 5000 }),
    });
    const completedAsset = (await completed.json()) as {
      asset: { previewUrl: string | null; contentVersion: string };
    };
    expect(completedAsset.asset.previewUrl).toBeNull();
    const versionHeaders = {
      ...headers,
      "x-media-version": completedAsset.asset.contentVersion,
    };
    const playlist = await request("/admin/playlists", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Thumbnail test" }),
    });
    const playlistId = ((await playlist.json()) as { playlist: { id: string } })
      .playlist.id;
    await request(`/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ mediaAssetId: asset.id, videoMode: "once" }],
      }),
    });
    const withoutThumbnail = await request(`/admin/playlists/${playlistId}`, {
      headers,
    });
    expect(
      (
        (await withoutThumbnail.json()) as {
          items: { asset: { previewUrl: string | null } }[];
        }
      ).items[0]?.asset.previewUrl,
    ).toBeNull();

    const endpoint = `/admin/media/${asset.id}/thumbnail`;
    const jpeg = new Uint8Array([255, 216, 255, 224, 0, 1, 255, 217]);
    expect(
      (
        await request(endpoint, {
          method: "PUT",
          headers: { "content-type": "image/jpeg" },
          body: jpeg,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/admin/media/00000000-0000-0000-0000-000000000000/thumbnail",
          {
            method: "PUT",
            headers: { ...headers, "content-type": "image/jpeg" },
            body: jpeg,
          },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`/admin/media/${readyImageId}/thumbnail`, {
          method: "PUT",
          headers: { ...headers, "content-type": "image/jpeg" },
          body: jpeg,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(endpoint, {
          method: "PUT",
          headers: { ...versionHeaders, "content-type": "image/png" },
          body: jpeg,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(endpoint, {
          method: "PUT",
          headers: { ...versionHeaders, "content-type": "image/jpeg" },
          body: new Uint8Array([1, 2, 3]),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(endpoint, {
          method: "PUT",
          headers: { ...versionHeaders, "content-type": "image/jpeg" },
          body: new Uint8Array(1024 * 1024 + 1),
        })
      ).status,
    ).toBe(413);
    const thumbnail = await request(endpoint, {
      method: "PUT",
      headers: { ...versionHeaders, "content-type": "image/jpeg" },
      body: jpeg,
    });
    expect(thumbnail.status).toBe(200);
    const thumbAsset = (
      (await thumbnail.json()) as {
        asset: { previewUrl: string; thumbnailKey: string };
      }
    ).asset;
    expect(thumbAsset.previewUrl).toContain(thumbAsset.thumbnailKey);
    expect((await mediaStorage.head(thumbAsset.thumbnailKey))?.sizeBytes).toBe(
      jpeg.length,
    );
    const list = await request("/admin/media", { headers });
    const listed = (
      (await list.json()) as {
        assets: { id: string; previewUrl: string | null }[];
      }
    ).assets.find((item) => item.id === asset.id);
    expect(listed?.previewUrl).toBe(thumbAsset.previewUrl);
    const detail = await request(`/admin/playlists/${playlistId}`, {
      headers,
    });
    expect(
      ((await detail.json()) as { items: { asset: { previewUrl: string } }[] })
        .items[0]?.asset.previewUrl,
    ).toBe(thumbAsset.previewUrl);
    await request(`/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    expect(
      (
        await request(`/admin/media/${asset.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(200);
    expect(await mediaStorage.head(thumbAsset.thumbnailKey)).not.toBeNull();
  });

  test("playlist item order and playback settings survive reload", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const headers = {
      "content-type": "application/json",
      cookie: ownerToken,
    };
    const created = await request("/admin/playlists", {
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
    const saved = await request(`/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ items }),
    });
    expect(saved.status).toBe(200);
    const reloaded = await request(`/admin/playlists/${playlistId}`, {
      headers: { cookie: ownerToken },
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
    const invalidDuration = await request(
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
    const unavailable = await request(`/admin/playlists/${playlistId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [{ mediaAssetId: crypto.randomUUID(), imageDurationMs: 5000 }],
      }),
    });
    expect(unavailable.status).toBe(400);
  });

  test("display URLs are distinct and always playlists form an ordered manifest", async () => {
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const headers = {
      "content-type": "application/json",
      cookie: ownerToken,
    };
    const createDisplay = (name: string) =>
      request("/admin/displays", {
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
    const extraPlaylist = await request("/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Campaign" }),
    });
    const extraId = (
      (await extraPlaylist.json()) as { playlist: { id: string } }
    ).playlist.id;
    await request(`/admin/playlists/${extraId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
      }),
    });
    const assigned = await request(`/admin/displays/${first.id}/always`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ playlistIds: [readyPlaylistId, extraId] }),
    });
    expect(assigned.status).toBe(200);
    const token = first.playerUrl.split("/").at(-1);
    if (!token) throw new Error("Player URL has no token");
    const manifestResponse = await request(`/player/${token}/manifest`);
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
    const missing = await request("/player/unknown/manifest");
    expect(missing.status).toBe(404);
    const heartbeat = await request(`/player/${token}/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        health: "playing",
        itemId: manifest.normalQueue[0]?.playlistId,
      }),
    });
    expect(heartbeat.status).toBe(200);
    const listed = await request("/admin/displays", {
      headers: { cookie: ownerToken },
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
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const headers = {
      "content-type": "application/json",
      cookie: ownerToken,
    };
    const created = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Rotating display" }),
    });
    const displayId = ((await created.json()) as { display: { id: string } })
      .display.id;
    await request(`/admin/displays/${displayId}/always`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ playlistIds: [readyPlaylistId] }),
    });
    const campaigns: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const playlistResponse = await request("/admin/playlists", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `Campaign ${index + 1}` }),
      });
      const playlistId = (
        (await playlistResponse.json()) as { playlist: { id: string } }
      ).playlist.id;
      campaigns.push(playlistId);
      await request(`/admin/playlists/${playlistId}/items`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
        }),
      });
      const day = 7 + index * 7;
      const scheduled = await request(
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
      const preview = await request(
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
    const overlap = await request(`/admin/displays/${displayId}/schedules`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        playlistId: campaigns[2],
        startLocal: "2026-09-08T10:00",
        endLocal: "2026-09-08T14:00",
        recurrence: "none",
        position: 3,
      }),
    });
    expect(overlap.status).toBe(201);
    const overlapId = ((await overlap.json()) as { assignment: { id: string } })
      .assignment.id;
    const overlapping = await request(
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
    const removed = await request(
      `/admin/displays/${displayId}/schedules/${overlapId}`,
      { method: "DELETE", headers },
    );
    expect(removed.status).toBe(200);
    const invalid = await request(`/admin/displays/${displayId}/schedules`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        playlistId: campaigns[0],
        startLocal: "2026-09-09T12:00",
        endLocal: "2026-09-08T12:00",
        recurrence: "none",
      }),
    });
    expect(invalid.status).toBe(400);
    const empty = await request(
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
    if (!organization) throw new Error("Organization was not created");
    await connection.db
      .update(organizations)
      .set({ timezone: "America/New_York" })
      .where(eq(organizations.id, organization.id));
    const changed = await request(
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
    const ownerLogin = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const ownerToken = loginCookie(ownerLogin);
    const headers = {
      "content-type": "application/json",
      cookie: ownerToken,
    };
    const created = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Event display" }),
    });
    const display = (
      (await created.json()) as { display: { id: string; playerUrl: string } }
    ).display;
    const extra = await request("/admin/playlists", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Countdown" }),
    });
    const countdownId = ((await extra.json()) as { playlist: { id: string } })
      .playlist.id;
    await request(`/admin/playlists/${countdownId}/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        items: [{ mediaAssetId: readyImageId, imageDurationMs: 5000 }],
      }),
    });
    await request(`/admin/displays/${display.id}/always`, {
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
      request(`/admin/displays/${display.id}/overrides`, {
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
        await request(
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
    const now = await request(`/admin/displays/${display.id}/overrides`, {
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
    const current = await request(
      `/player/${display.playerUrl.split("/").at(-1)}/manifest`,
    );
    expect(
      ((await current.json()) as { override: { priority: number } }).override
        .priority,
    ).toBe(100);
    const missingExpiry = await request(
      `/admin/displays/${display.id}/overrides`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ playlistId: countdownId, activateNow: true }),
      },
    );
    expect(missingExpiry.status).toBe(400);
  });

  test("Append and Override creation accept general recurrence and reject invalid combinations", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = {
      "content-type": "application/json",
      cookie: token,
    };
    const created = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Recurrence fixture" }),
    });
    const displayId = ((await created.json()) as { display: { id: string } })
      .display.id;
    const patterns = [
      { recurrence: "daily", repeatInterval: 2 },
      {
        recurrence: "weekly",
        repeatInterval: 2,
        weekdays: [1, 4],
      },
      { recurrence: "monthly", repeatInterval: 1, monthDay: 31 },
      {
        recurrence: "monthly",
        repeatInterval: 1,
        monthOrdinal: -1,
        monthWeekday: 5,
      },
    ];
    for (const path of ["schedules", "overrides"] as const) {
      for (const pattern of patterns) {
        const response = await request(`/admin/displays/${displayId}/${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            playlistId: readyPlaylistId,
            startLocal: "2026-01-31T09:00",
            endLocal: "2026-01-31T10:00",
            lastOccurrenceDate: "2026-12-31",
            ...pattern,
          }),
        });
        expect(response.status).toBe(201);
        const saved = (await response.json()) as {
          assignment: {
            schedule: { recurrence: string; repeatInterval: number };
          };
        };
        expect(saved.assignment.schedule.recurrence).toBe(pattern.recurrence);
        expect(saved.assignment.schedule.repeatInterval).toBe(
          pattern.repeatInterval,
        );
      }
    }
    for (const invalid of [
      { recurrence: "weekly", weekdays: [] },
      { recurrence: "monthly", monthDay: 1, monthOrdinal: -1, monthWeekday: 5 },
      { recurrence: "daily", repeatInterval: 0 },
      { recurrence: "daily", lastOccurrenceDate: "2025-01-01" },
    ]) {
      const response = await request(`/admin/displays/${displayId}/schedules`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          playlistId: readyPlaylistId,
          startLocal: "2026-01-31T09:00",
          endLocal: "2026-01-31T10:00",
          ...invalid,
        }),
      });
      expect(response.status).toBe(400);
    }
    const invalidNow = await request(`/admin/displays/${displayId}/overrides`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        playlistId: readyPlaylistId,
        activateNow: true,
        endLocal: "2099-01-01T00:00",
        recurrence: "daily",
      }),
    });
    expect(invalidNow.status).toBe(400);
  });

  test("assignment settings edit preserves identity, timezone, and detects stale or foreign edits", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = {
      "content-type": "application/json",
      cookie: token,
    };
    const created = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Edit recurrence fixture" }),
    });
    const displayId = ((await created.json()) as { display: { id: string } })
      .display.id;
    const create = async (path: "schedules" | "overrides") => {
      const response = await request(`/admin/displays/${displayId}/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          playlistId: readyPlaylistId,
          startLocal: "2026-02-01T09:00",
          endLocal: "2026-02-01T10:00",
          recurrence: "daily",
        }),
      });
      expect(response.status).toBe(201);
      return (await response.json()) as {
        assignment: {
          id: string;
          mode: string;
          playlistId: string;
          version?: string;
          schedule: { timezone: string };
        };
      };
    };
    const append = (await create("schedules")).assignment;
    const override = (await create("overrides")).assignment;
    const list = await request(`/admin/displays/${displayId}/assignments`, {
      headers,
    });
    const listed = (await list.json()) as {
      assignments: { id: string; version: string }[];
    };
    const version = (id: string) =>
      listed.assignments.find((item) => item.id === id)?.version ?? "";
    const edit = (
      id: string,
      body: Record<string, unknown>,
      targetDisplay = displayId,
    ) =>
      request(`/admin/displays/${targetDisplay}/assignments/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
    const noop = await edit(append.id, { expectedVersion: version(append.id) });
    expect(noop.status).toBe(200);
    const unchanged = (await noop.json()) as {
      assignment: typeof append & { version: string };
    };
    expect(unchanged.assignment.version).toBe(version(append.id));
    expect(unchanged.assignment.schedule.timezone).toBe(
      append.schedule.timezone,
    );
    const changed = await edit(append.id, {
      expectedVersion: unchanged.assignment.version,
      recurrence: "monthly",
      monthDay: 31,
      startLocal: "2026-02-02T09:00",
      endLocal: "2026-02-02T10:00",
    });
    expect(changed.status).toBe(200);
    const saved = (await changed.json()) as {
      assignment: typeof append & {
        version: string;
        schedule: { timezone: string; recurrence: string; monthDay: number };
      };
    };
    expect(saved.assignment.playlistId).toBe(append.playlistId);
    expect(saved.assignment.mode).toBe("scheduled");
    expect(saved.assignment.schedule).toMatchObject({
      timezone: append.schedule.timezone,
      recurrence: "monthly",
      monthDay: 31,
    });
    expect(
      (
        await edit(append.id, {
          expectedVersion: version(append.id),
          endLocal: "2026-02-02T11:00",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await edit(append.id, {
          expectedVersion: saved.assignment.version,
          priority: 9,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await edit(append.id, {
          expectedVersion: saved.assignment.version,
          recurrence: "weekly",
          weekdays: [],
        })
      ).status,
    ).toBe(400);
    const changedOverride = await edit(override.id, {
      expectedVersion: version(override.id),
      priority: 7,
      recurrence: "weekly",
      repeatInterval: 2,
      weekdays: [1, 5],
    });
    expect(changedOverride.status).toBe(200);
    const savedOverride = (await changedOverride.json()) as {
      assignment: {
        mode: string;
        playlistId: string;
        priority: number;
        schedule: { recurrence: string; weekdays: number[] };
      };
    };
    expect(savedOverride.assignment).toMatchObject({
      mode: "override",
      playlistId: readyPlaylistId,
      priority: 7,
    });
    expect(savedOverride.assignment.schedule).toMatchObject({
      recurrence: "weekly",
      weekdays: [1, 5],
    });
    const [otherOrganization] = await connection.db
      .insert(organizations)
      .values({ name: "Other organization", timezone: "America/New_York" })
      .returning();
    if (!otherOrganization)
      throw new Error("Other organization was not created");
    const [otherDisplay] = await connection.db
      .insert(displays)
      .values({
        organizationId: otherOrganization.id,
        name: "Foreign display",
        playerToken: crypto.randomUUID(),
        playerTokenHash: crypto.randomUUID(),
      })
      .returning();
    if (!otherDisplay) throw new Error("Foreign display was not created");
    expect(
      (
        await edit(
          append.id,
          { expectedVersion: saved.assignment.version },
          otherDisplay.id,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await edit(
          override.id,
          { expectedVersion: version(override.id) },
          otherDisplay.id,
        )
      ).status,
    ).toBe(404);
  });

  test("partial edits retain immediate seconds and the later DST-overlap instant", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = {
      "content-type": "application/json",
      cookie: token,
    };
    const displayResponse = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Partial edit fixture" }),
    });
    const display = (
      (await displayResponse.json()) as {
        display: { id: string; playerUrl: string };
      }
    ).display;
    const displayId = display.id;
    const create = (path: "schedules" | "overrides", body: object) =>
      request(`/admin/displays/${displayId}/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ playlistId: readyPlaylistId, ...body }),
      });
    const immediate = await create("overrides", {
      activateNow: true,
      endLocal: "2099-01-01T00:00",
      priority: 1,
    });
    expect(immediate.status).toBe(201);
    const immediateId = (
      (await immediate.json()) as { assignment: { id: string } }
    ).assignment.id;
    const append = await create("schedules", {
      startLocal: "2026-11-01T01:30",
      endLocal: "2026-11-01T02:00",
      recurrence: "none",
    });
    expect(append.status).toBe(201);
    const appendId = ((await append.json()) as { assignment: { id: string } })
      .assignment.id;
    const [appendRow] = await connection.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, appendId));
    if (!appendRow?.scheduleRuleId) throw new Error("Append schedule missing");
    await connection.db
      .update(scheduleRules)
      .set({
        startAt: new Date("2026-11-01T06:30:00.000Z"),
        endAt: new Date("2026-11-01T07:00:00.000Z"),
        timezone: "America/New_York",
      })
      .where(eq(scheduleRules.id, appendRow.scheduleRuleId));
    const listed = await request(`/admin/displays/${displayId}/assignments`, {
      headers,
    });
    type Listed = {
      id: string;
      version: string;
      playlistId: string;
      mode: string;
      position: number;
      schedule: {
        id: string;
        startAt: string;
        endAt: string;
        timezone: string;
      };
    };
    const items = ((await listed.json()) as { assignments: Listed[] })
      .assignments;
    const originalImmediate = items.find((item) => item.id === immediateId);
    const originalAppend = items.find((item) => item.id === appendId);
    if (!originalImmediate || !originalAppend)
      throw new Error("Edit fixture assignments missing");
    const preview = async () => {
      const response = await request(
        `/admin/displays/${displayId}/preview?atLocal=2026-11-03T01:45`,
        { headers },
      );
      expect(response.status).toBe(200);
      return (await response.json()) as {
        normalQueue: { playlistId: string }[];
      };
    };
    expect((await preview()).normalQueue).toEqual([]);
    const patch = (id: string, body: object) =>
      request(`/admin/displays/${displayId}/assignments/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
    const priority = await patch(immediateId, {
      expectedVersion: originalImmediate.version,
      priority: 7,
    });
    expect(priority.status).toBe(200);
    const prioritySaved = (await priority.json()) as {
      assignment: Listed & { priority: number };
    };
    expect(prioritySaved.assignment.priority).toBe(7);
    expect(prioritySaved.assignment.schedule.startAt).toBe(
      originalImmediate.schedule.startAt,
    );
    expect(prioritySaved.assignment.schedule.endAt).toBe(
      originalImmediate.schedule.endAt,
    );
    const manifestResponse = await request(
      `${new URL(display.playerUrl).pathname}/manifest`,
    );
    expect(manifestResponse.status).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      override: { priority: number; startAt: string; endAt: string } | null;
    };
    expect(manifest.override).toMatchObject({
      priority: 7,
      startAt: originalImmediate.schedule.startAt,
      endAt: originalImmediate.schedule.endAt,
    });
    const recurrence = await patch(appendId, {
      expectedVersion: originalAppend.version,
      recurrence: "daily",
      repeatInterval: 2,
    });
    expect(recurrence.status).toBe(200);
    const recurrenceSaved = (await recurrence.json()) as {
      assignment: Listed & { version: string };
    };
    expect(recurrenceSaved.assignment.schedule.startAt).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    expect(recurrenceSaved.assignment.schedule.endAt).toBe(
      "2026-11-01T07:00:00.000Z",
    );
    expect(recurrenceSaved.assignment.schedule.timezone).toBe(
      "America/New_York",
    );
    expect(recurrenceSaved.assignment.schedule.id).toBe(
      originalAppend.schedule.id,
    );
    expect(recurrenceSaved.assignment).toMatchObject({
      id: originalAppend.id,
      playlistId: originalAppend.playlistId,
      mode: originalAppend.mode,
      position: originalAppend.position,
    });
    expect((await preview()).normalQueue).toContainEqual(
      expect.objectContaining({ playlistId: readyPlaylistId }),
    );
    const boundary = await patch(appendId, {
      expectedVersion: recurrenceSaved.assignment.version,
      endLocal: "2026-11-01T02:15",
    });
    expect(boundary.status).toBe(200);
    const boundarySaved = (await boundary.json()) as {
      assignment: Listed;
    };
    expect(boundarySaved.assignment.schedule.startAt).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    expect(boundarySaved.assignment.schedule.endAt).toBe(
      "2026-11-01T07:15:00.000Z",
    );
  });

  test("recurring Overrides publish absolute lookahead windows with priority handoff", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = {
      "content-type": "application/json",
      cookie: token,
    };
    const created = await request("/admin/displays", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Override windows fixture" }),
    });
    const displayId = ((await created.json()) as { display: { id: string } })
      .display.id;
    const add = async (
      priority: number,
      recurrence: Record<string, unknown>,
    ) => {
      const response = await request(`/admin/displays/${displayId}/overrides`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          playlistId: readyPlaylistId,
          priority,
          startLocal: "2026-10-01T12:00",
          endLocal: "2026-10-01T12:05",
          ...recurrence,
        }),
      });
      expect(response.status).toBe(201);
      return ((await response.json()) as { assignment: { id: string } })
        .assignment.id;
    };
    const dailyId = await add(1, {
      recurrence: "daily",
      lastOccurrenceDate: "2026-10-03",
    });
    const highId = await add(9, {
      recurrence: "daily",
      startLocal: "2026-10-02T12:01",
      endLocal: "2026-10-02T12:03",
      lastOccurrenceDate: "2026-10-03",
    });
    const preview = async (atLocal: string) => {
      const response = await request(
        `/admin/displays/${displayId}/preview?atLocal=${atLocal}`,
        { headers },
      );
      expect(response.status).toBe(200);
      return (await response.json()) as {
        version: string;
        override: { assignmentId: string } | null;
        overrideWindows: {
          assignmentId: string;
          startAt: string;
          endAt: string;
        }[];
        transitions: { overrideId: string | null }[];
      };
    };
    const before = await preview("2026-10-02T11:59");
    expect(before.override).toBeNull();
    expect(
      before.overrideWindows.filter(
        (window) => window.assignmentId === dailyId,
      ),
    ).toHaveLength(2);
    expect(
      before.transitions.map((transition) => transition.overrideId),
    ).toEqual([dailyId, highId, dailyId, null, dailyId, highId, dailyId, null]);
    expect((await preview("2026-10-02T12:00")).override?.assignmentId).toBe(
      dailyId,
    );
    expect((await preview("2026-10-02T12:01")).override?.assignmentId).toBe(
      highId,
    );
    expect((await preview("2026-10-02T12:03")).override?.assignmentId).toBe(
      dailyId,
    );
    expect((await preview("2026-10-02T12:05")).override).toBeNull();
    expect((await preview("2026-10-04T12:00")).override).toBeNull();
    const same = await preview("2026-10-02T11:59");
    expect(same.version).toBe(before.version);
    const long = await request(`/admin/displays/${displayId}/overrides`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        playlistId: readyPlaylistId,
        priority: 2,
        startLocal: "2026-10-10T12:00",
        endLocal: "2026-11-30T12:00",
      }),
    });
    expect(long.status).toBe(201);
    const withLong = await preview("2026-10-02T11:59");
    expect(
      withLong.overrideWindows.some((window) =>
        window.endAt.startsWith("2026-11-30"),
      ),
    ).toBeTrue();
  });

  test("Append preview shares daily, weekday, monthly, end-date, and DST resolution", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    const headers = {
      "content-type": "application/json",
      cookie: token,
    };
    const cases = [
      {
        rule: {
          recurrence: "daily",
          startLocal: "2026-01-01T09:00",
          endLocal: "2026-01-01T10:00",
          lastOccurrenceDate: "2026-01-03",
        },
        yes: "2026-01-03T09:30",
        no: "2026-01-04T09:30",
      },
      {
        rule: {
          recurrence: "weekly",
          startLocal: "2026-01-05T09:00",
          endLocal: "2026-01-05T10:00",
          weekdays: [1, 4],
        },
        yes: "2026-01-08T09:30",
        no: "2026-01-09T09:30",
      },
      {
        rule: {
          recurrence: "monthly",
          startLocal: "2026-01-31T09:00",
          endLocal: "2026-01-31T10:00",
          monthDay: 31,
        },
        yes: "2026-03-31T09:30",
        no: "2026-02-28T09:30",
      },
      {
        rule: {
          recurrence: "monthly",
          startLocal: "2026-01-30T09:00",
          endLocal: "2026-01-30T10:00",
          monthOrdinal: -1,
          monthWeekday: 5,
        },
        yes: "2026-02-27T09:30",
        no: "2026-02-20T09:30",
      },
      {
        rule: {
          recurrence: "daily",
          startLocal: "2026-03-07T02:30",
          endLocal: "2026-03-07T03:00",
        },
        yes: "2026-03-08T03:45",
        no: "2026-03-08T04:00",
      },
    ];
    for (const { rule, yes, no } of cases) {
      const created = await request("/admin/displays", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `Append ${rule.recurrence} ${yes}` }),
      });
      const displayId = ((await created.json()) as { display: { id: string } })
        .display.id;
      const assigned = await request(`/admin/displays/${displayId}/schedules`, {
        method: "POST",
        headers,
        body: JSON.stringify({ playlistId: readyPlaylistId, ...rule }),
      });
      expect(assigned.status).toBe(201);
      for (const [at, expected] of [
        [yes, true],
        [no, false],
      ] as const) {
        const preview = await request(
          `/admin/displays/${displayId}/preview?atLocal=${at}`,
          { headers },
        );
        expect(preview.status).toBe(200);
        const manifest = (await preview.json()) as { normalQueue: unknown[] };
        expect(
          manifest.normalQueue.length > 0,
          `${rule.recurrence} ${yes} at ${at}`,
        ).toBe(expected);
      }
    }
  });
});
