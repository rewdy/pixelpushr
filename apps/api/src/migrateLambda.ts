import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseUrlFromEnvironment } from "./config/databaseSecret";
import { createDatabase } from "./db/client";

/** Run explicitly after provisioning and before directing users to the site. */
export const handler = async () => {
  const connection = createDatabase(await databaseUrlFromEnvironment(process.env));
  try {
    await migrate(connection.db, { migrationsFolder: new URL("./drizzle", import.meta.url).pathname });
    return { migrated: true };
  } finally {
    await connection.close();
  }
};
