import { cleanupExpiredSessions } from "./auth/sessionStorage";
import { databaseUrlFromEnvironment } from "./config/databaseSecret";
import { readConfig } from "./config/env";
import { createRuntime } from "./config/runtime";
import { sessionKeyFromEnvironment } from "./config/sessionSecret";
import { cleanupMedia } from "./media/cleanup";

/** Scheduled media garbage collection after the manifest handoff period. */
export const handler = async () => {
  const databaseUrl = await databaseUrlFromEnvironment(process.env);
  const runtime = createRuntime(
    readConfig({
      ...process.env,
      DATABASE_URL: databaseUrl,
      SESSION_ENCRYPTION_KEY: await sessionKeyFromEnvironment(process.env),
    }),
  );
  try {
    await cleanupExpiredSessions(runtime.dependencies.db);
    const storage = runtime.dependencies.storage;
    if (!storage) throw new Error("Media storage is required for cleanup");
    return await cleanupMedia(runtime.dependencies.db, storage);
  } finally {
    await runtime.close();
  }
};
