import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

/** Opens a PostgreSQL pool and typed Drizzle session. */
export const createDatabase = (url: string) => {
  const client = postgres(url, { max: 5 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
};
