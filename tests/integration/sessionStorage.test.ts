import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  cleanupExpiredSessions,
  newSessionCredential,
  sessionDigest,
  sessionEncryption,
  sessionLifetimeSeconds,
} from "../../apps/api/src/auth/sessionStorage";
import { createDatabase } from "../../apps/api/src/db/client";
import { adminSessions, users } from "../../apps/api/src/db/schema";
import { testDatabaseAdminUrl } from "../config";

test("session migration works on empty and existing databases and cleans up at the deadline", async () => {
  const admin = postgres(testDatabaseAdminUrl);
  const migrations = new URL("../../apps/api/drizzle", import.meta.url)
    .pathname;
  const previous = await mkdtemp(join(tmpdir(), "pixelpushr-previous-schema-"));
  const database = `pixelpushr_test_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    const journal = (await Bun.file(
      join(migrations, "meta/_journal.json"),
    ).json()) as { entries: { idx: number; tag: string }[] };
    const beforeSessions = journal.entries.filter((entry) => entry.idx < 6);
    for (const entry of beforeSessions)
      await Bun.write(
        join(previous, `${entry.tag}.sql`),
        Bun.file(join(migrations, `${entry.tag}.sql`)),
      );
    await Bun.write(
      join(previous, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: beforeSessions }),
    );
    for (const upgrade of [false, true]) {
      await admin`CREATE DATABASE ${admin(database)}`;
      const url = new URL(testDatabaseAdminUrl);
      url.pathname = database;
      const connection = createDatabase(url.toString());
      const { db } = connection;
      try {
        if (upgrade) await migrate(db, { migrationsFolder: previous });
        if (!upgrade) await migrate(db, { migrationsFolder: migrations });
        const [user] = await db
          .insert(users)
          .values({
            subject: "subject",
            email: "admin@example.test",
          })
          .returning();
        if (!user) throw new Error("Missing test user");
        if (upgrade) await migrate(db, { migrationsFolder: migrations });
        const credential = newSessionCredential();
        const digest = sessionDigest(credential);
        expect(digest).not.toBe(credential);
        const encryption = sessionEncryption("ab".repeat(32));
        const sealed = encryption.seal("provider-token", digest);
        expect(sealed).not.toContain("provider-token");
        expect(encryption.open(sealed, digest)).toBe("provider-token");
        expect(() => encryption.open(sealed, "another-session")).toThrow(
          "Unable to read stored session credentials",
        );
        const signedInAt = Date.UTC(2026, 0, 1);
        const expires = signedInAt + sessionLifetimeSeconds * 1000;
        await db.insert(adminSessions).values({
          userId: user.id,
          digest,
          expiresAt: new Date(expires),
          providerCredentials: sealed,
        });
        await cleanupExpiredSessions(db, new Date(expires - 1));
        expect(await db.select().from(adminSessions)).toHaveLength(1);
        await cleanupExpiredSessions(db, new Date(expires));
        expect(await db.select().from(adminSessions)).toHaveLength(0);
      } finally {
        await connection.close();
        await admin`DROP DATABASE ${admin(database)}`;
      }
    }
  } finally {
    await admin.end();
    await rm(previous, { recursive: true, force: true });
  }
});
