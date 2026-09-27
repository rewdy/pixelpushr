import { databaseUrlFromEnvironment } from "./config/databaseSecret";
import { readConfig } from "./config/env";
import { createRuntime } from "./config/runtime";
import { cleanupMedia } from "./media/cleanup";

/** Scheduled media garbage collection after the manifest handoff period. */
export const handler = async () => {
  const databaseUrl = await databaseUrlFromEnvironment(process.env);
  const runtime = createRuntime(
    readConfig({ ...process.env, DATABASE_URL: databaseUrl }),
  );
  try {
    const storage = runtime.dependencies.storage;
    if (!storage) throw new Error("Media storage is required for cleanup");
    return await cleanupMedia(runtime.dependencies.db, storage);
  } finally {
    await runtime.close();
  }
};
