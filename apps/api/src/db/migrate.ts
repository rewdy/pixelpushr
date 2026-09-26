import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required to apply migrations");
const connection = createDatabase(url);
try {
  await migrate(connection.db, {
    migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
  });
  console.info("Database migrations applied");
} finally {
  await connection.close();
}
