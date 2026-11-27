import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createApp } from "../../apps/api/src/app";
import { createLocalAuth } from "../../apps/api/src/auth/localAuth";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  displays,
  mediaAssets,
  mediaAssetTags,
  mediaTags,
  organizations,
  playlists,
} from "../../apps/api/src/db/schema";
import { createLocalStorage } from "../../apps/api/src/media/localStorage";
import { testDatabaseAdminUrl } from "../config";
import { browserRequest, loginCookie } from "../fixtures/authRequests";

const databaseName = `pixelpushr_paging_${crypto.randomUUID().replaceAll("-", "")}`;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let request: ReturnType<typeof browserRequest>;
let directory: string;
let headers: Record<string, string>;
let assetIds: string[];
let playlistIds: string[];
let displayIds: string[];

type ListResponse = Record<string, unknown> & {
  page?: number;
  pageSize?: number;
  total?: number;
};
const listed = async (path: string): Promise<ListResponse> => {
  const response = await request(path, { headers });
  expect(response.status).toBe(200);
  return response.json() as Promise<ListResponse>;
};

describe("opt-in admin pagination", () => {
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
    directory = await mkdtemp(join(tmpdir(), "pixelpushr-paging-"));
    request = browserRequest(
      createApp({
        db: connection.db,
        auth: createLocalAuth(
          connection.db,
          "test-secret-longer-than-thirty-two-characters",
        ),
        storage: createLocalStorage(
          directory,
          "http://127.0.0.1:5173",
          "test-secret-longer-than-thirty-two-characters",
        ),
        mailer: { send: async () => {} },
        publicWebUrl: "http://127.0.0.1:5173",
      }),
    );
    await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "paging@example.com",
        password: "super-long-password",
      }),
    });
    const login = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "paging@example.com",
        password: "super-long-password",
      }),
    });
    const token = loginCookie(login);
    headers = {
      cookie: token,
      "content-type": "application/json",
    };
    const setup = await request("/setup", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Paging", timezone: "UTC" }),
    });
    const organizationId = (
      (await setup.json()) as { organization: { id: string } }
    ).organization.id;
    const mediaRows = await connection.db
      .insert(mediaAssets)
      .values(
        Array.from({ length: 32 }, (_, index) => ({
          organizationId,
          name:
            index === 31
              ? "Zebra later match"
              : index === 29 || index === 30
                ? "Same name"
                : `Asset ${String(index + 1).padStart(2, "0")}`,
          kind: "image" as const,
          status: "ready" as const,
          mimeType: "image/png",
          objectKey: `${organizationId}/${crypto.randomUUID()}`,
          sizeBytes: 10,
        })),
      )
      .returning();
    assetIds = mediaRows.map((row) => row.id);
    const firstAssetId = assetIds[0];
    const secondAssetId = assetIds[1];
    const lastAssetId = assetIds[31];
    if (!firstAssetId || !secondAssetId || !lastAssetId)
      throw new Error("Missing paging assets");
    const playlistRows = await connection.db
      .insert(playlists)
      .values(
        Array.from({ length: 27 }, (_, index) => ({
          organizationId,
          name:
            index >= 25
              ? "Same playlist"
              : `Playlist ${String(index + 1).padStart(2, "0")}`,
        })),
      )
      .returning();
    playlistIds = playlistRows.map((row) => row.id);
    const displayRows = await connection.db
      .insert(displays)
      .values(
        Array.from({ length: 27 }, (_, index) => ({
          organizationId,
          name:
            index >= 25
              ? "Same display"
              : `Display ${String(index + 1).padStart(2, "0")}`,
          playerToken: crypto.randomUUID(),
          playerTokenHash: crypto.randomUUID(),
        })),
      )
      .returning();
    displayIds = displayRows.map((row) => row.id);
    const [blue, red] = await connection.db
      .insert(mediaTags)
      .values([
        { organizationId, name: "Blue", normalizedName: "blue" },
        { organizationId, name: "Red", normalizedName: "red" },
      ])
      .returning();
    if (!blue || !red) throw new Error("Missing tags");
    await connection.db.insert(mediaAssetTags).values([
      { mediaAssetId: firstAssetId, tagId: blue.id },
      { mediaAssetId: secondAssetId, tagId: red.id },
      { mediaAssetId: lastAssetId, tagId: blue.id },
      { mediaAssetId: lastAssetId, tagId: red.id },
    ]);
    const [foreign] = await connection.db
      .insert(organizations)
      .values({ name: "Foreign" })
      .returning();
    if (!foreign) throw new Error("Missing foreign organization");
    await connection.db.insert(mediaAssets).values({
      organizationId: foreign.id,
      name: "Zebra foreign",
      kind: "image",
      status: "ready",
      mimeType: "image/png",
      objectKey: `${foreign.id}/${crypto.randomUUID()}`,
      sizeBytes: 10,
    });
    await connection.db
      .insert(playlists)
      .values({ organizationId: foreign.id, name: "Foreign playlist" });
    await connection.db.insert(displays).values({
      organizationId: foreign.id,
      name: "Foreign display",
      playerToken: crypto.randomUUID(),
      playerTokenHash: crypto.randomUUID(),
    });
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (admin) {
      await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
      await admin.end();
    }
    if (directory) await rm(directory, { recursive: true });
  });

  test("validates positive pages and bounded sizes on all three routes", async () => {
    for (const route of ["media", "playlists", "displays"]) {
      for (const query of [
        "page=0",
        "page=-1",
        "page=1.5",
        "page=abc",
        "page=",
        "pageSize=0",
        "pageSize=101",
        "pageSize=bogus",
      ]) {
        expect(
          (await request(`/admin/${route}?${query}`, { headers })).status,
        ).toBe(400);
      }
      const sizeOnly = await listed(`/admin/${route}?pageSize=5`);
      expect(sizeOnly).toMatchObject({ page: 1, pageSize: 5 });
    }
  });

  test("legacy lists remain complete while pages have stable totals and ordering", async () => {
    const cases = [
      ["media", "assets", assetIds],
      ["playlists", "playlists", playlistIds],
      ["displays", "displays", displayIds],
    ] as const;
    for (const [route, key, expectedIds] of cases) {
      const legacy = await listed(`/admin/${route}`);
      const unpaged = legacy[key] as Array<{ id: string }>;
      expect(unpaged).toHaveLength(expectedIds.length);
      expect("total" in legacy).toBe(false);
      const pagedIds: string[] = [];
      for (let page = 1; page <= Math.ceil(expectedIds.length / 5); page++) {
        const result = await listed(`/admin/${route}?page=${page}&pageSize=5`);
        expect(result).toMatchObject({
          page,
          pageSize: 5,
          total: expectedIds.length,
        });
        pagedIds.push(
          ...(result[key] as Array<{ id: string }>).map((row) => row.id),
        );
      }
      expect(pagedIds).toEqual(unpaged.map((row) => row.id));
      expect(new Set(pagedIds).size).toBe(expectedIds.length);
      const pastEnd = await listed(`/admin/${route}?page=999&pageSize=5`);
      expect(pastEnd[key]).toEqual([]);
      expect(pastEnd.total).toBe(expectedIds.length);
    }
  });

  test("media search and OR tags are counted before paging across all matches", async () => {
    const tags = (await listed("/admin/media/tags")).tags as Array<{
      id: string;
      name: string;
    }>;
    const blue = tags.find((tag) => tag.name === "Blue");
    const red = tags.find((tag) => tag.name === "Red");
    if (!blue || !red) throw new Error("Missing listed tags");
    const later = await listed("/admin/media?page=1&pageSize=5&search=Zebra");
    expect(later.total).toBe(1);
    expect(
      (later.assets as Array<{ name: string }>).map((row) => row.name),
    ).toEqual(["Zebra later match"]);
    const orTags = await listed(
      `/admin/media?page=1&pageSize=2&tags=${blue.id},${red.id}`,
    );
    expect(orTags.total).toBe(3);
    expect(orTags.assets).toHaveLength(2);
    const secondPage = await listed(
      `/admin/media?page=2&pageSize=2&tags=${blue.id},${red.id}`,
    );
    expect(
      (secondPage.assets as Array<{ id: string }>).map((row) => row.id),
    ).toEqual([assetIds[31]]);
    const combined = await listed(
      `/admin/media?page=1&pageSize=5&tags=${blue.id},${red.id}&search=Zebra`,
    );
    expect(combined.total).toBe(1);
    expect((combined.assets as Array<{ id: string }>)[0]?.id).toBe(
      assetIds[31],
    );
  });
});
