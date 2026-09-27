import { expect, test } from "bun:test";
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
import { testDatabaseAdminUrl } from "../config";

const migrationsFolder = new URL("../../apps/api/drizzle/", import.meta.url)
  .pathname;

test("recurrence migration preserves weekly and one-time rules", async () => {
  const name = `pixelpushr_recurrence_${crypto.randomUUID().replaceAll("-", "")}`;
  const admin = postgres(testDatabaseAdminUrl, { max: 1 });
  const previousMigrations = await mkdtemp(
    join(tmpdir(), "pixelpushr-old-migrations-"),
  );
  const url = new URL(testDatabaseAdminUrl);
  url.pathname = `/${name}`;
  let connection: ReturnType<typeof createDatabase> | undefined;
  try {
    await admin`CREATE DATABASE ${admin(name)}`;
    await mkdir(join(previousMigrations, "meta"));
    const journal = JSON.parse(
      await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    const oldJournal = { ...journal, entries: journal.entries.slice(0, 4) };
    await writeFile(
      join(previousMigrations, "meta", "_journal.json"),
      JSON.stringify(oldJournal),
    );
    for (const { tag } of oldJournal.entries)
      await copyFile(
        join(migrationsFolder, `${tag}.sql`),
        join(previousMigrations, `${tag}.sql`),
      );
    connection = createDatabase(url.toString());
    await migrate(connection.db, { migrationsFolder: previousMigrations });
    const sql = postgres(url.toString(), { max: 1 });
    try {
      const [organization] = await sql`
        INSERT INTO organizations (name, timezone)
        VALUES ('Migration fixture', 'America/Chicago') RETURNING id
      `;
      await sql`
        INSERT INTO schedule_rules
          (organization_id, recurrence, start_at, end_at, timezone, week_interval, recurrence_until)
        VALUES
          (${organization.id}, 'weekly', '2026-09-07T14:00:00Z', '2026-09-07T15:00:00Z', 'America/Chicago', 3, '2026-12-31T00:00:00Z'),
          (${organization.id}, 'none', '2026-09-08T14:00:00Z', '2026-09-08T15:00:00Z', 'America/Chicago', NULL, NULL)
      `;
      await migrate(connection.db, { migrationsFolder });
      const rows = await sql`
        SELECT recurrence, repeat_interval, weekdays,
               last_occurrence_date, recurrence_until
        FROM schedule_rules ORDER BY start_at
      `;
      expect(rows[0]).toMatchObject({
        recurrence: "weekly",
        repeat_interval: 3,
        weekdays: [1],
        last_occurrence_date: null,
        recurrence_until: new Date("2026-12-31T00:00:00.000Z"),
      });
      expect(rows[1]).toMatchObject({
        recurrence: "none",
        repeat_interval: null,
        weekdays: null,
      });
    } finally {
      await sql.end();
    }
  } finally {
    if (connection) await connection.close();
    await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
    await admin.end();
    await rm(previousMigrations, { recursive: true });
  }
});
