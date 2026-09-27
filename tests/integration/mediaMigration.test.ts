import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase } from "../../apps/api/src/db/client";
import {
  mediaAssets,
  organizations,
  playlistItems,
  playlists,
} from "../../apps/api/src/db/schema";
import { testDatabaseAdminUrl } from "../config";

const databaseName = `pixelpushr_upgrade_${crypto.randomUUID().replaceAll("-", "")}`;
const migrationsPath = new URL("../../apps/api/drizzle", import.meta.url)
  .pathname;
let admin: ReturnType<typeof postgres>;
let connection: ReturnType<typeof createDatabase>;
let oldMigrationsPath: string;

beforeAll(async () => {
  admin = postgres(testDatabaseAdminUrl, { max: 1 });
  await admin`CREATE DATABASE ${admin(databaseName)}`;
  const url = new URL(testDatabaseAdminUrl);
  url.pathname = `/${databaseName}`;
  connection = createDatabase(url.toString());
  oldMigrationsPath = await mkdtemp(
    join(tmpdir(), "pixelpushr-old-migrations-"),
  );
  await mkdir(join(oldMigrationsPath, "meta"));
  const journal = JSON.parse(
    await readFile(join(migrationsPath, "meta/_journal.json"), "utf8"),
  ) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= 2);
  await writeFile(
    join(oldMigrationsPath, "meta/_journal.json"),
    JSON.stringify(journal),
  );
  for (const entry of journal.entries)
    await copyFile(
      join(migrationsPath, `${entry.tag}.sql`),
      join(oldMigrationsPath, `${entry.tag}.sql`),
    );
});

afterAll(async () => {
  if (connection) await connection.close();
  if (admin) {
    await admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`;
    await admin.end();
  }
  if (oldMigrationsPath) await rm(oldMigrationsPath, { recursive: true });
});

test("new media tables migrate an existing database without changing playlist rows", async () => {
  await migrate(connection.db, { migrationsFolder: oldMigrationsPath });
  const [organization] = await connection.db
    .insert(organizations)
    .values({ name: "Existing organization" })
    .returning();
  if (!organization) throw new Error("Missing organization");
  const [asset] = await connection.db
    .insert(mediaAssets)
    .values({
      organizationId: organization.id,
      name: "Existing asset",
      kind: "image",
      status: "ready",
      mimeType: "image/png",
      objectKey: `${organization.id}/${crypto.randomUUID()}`,
      sizeBytes: 12,
    })
    .returning();
  const [playlist] = await connection.db
    .insert(playlists)
    .values({
      organizationId: organization.id,
      name: "Existing playlist",
    })
    .returning();
  if (!asset || !playlist) throw new Error("Missing existing rows");
  const [item] = await connection.db
    .insert(playlistItems)
    .values({
      playlistId: playlist.id,
      mediaAssetId: asset.id,
      position: 0,
      imageDurationMs: 8000,
    })
    .returning();
  await migrate(connection.db, { migrationsFolder: migrationsPath });
  expect(
    (await connection.db.select().from(mediaAssets)).map((row) => row.id),
  ).toEqual([asset.id]);
  expect(
    (await connection.db.select().from(playlistItems)).map((row) => row.id),
  ).toEqual([item?.id]);
});
