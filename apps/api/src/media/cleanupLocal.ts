import { cleanupExpiredSessions } from "../auth/sessionStorage";
import { readConfig } from "../config/env";
import { createRuntime } from "../config/runtime";
import { cleanupMedia } from "./cleanup";

const runtime = createRuntime(readConfig(process.env));
try {
  await cleanupExpiredSessions(runtime.dependencies.db);
  const storage = runtime.dependencies.storage;
  if (!storage) throw new Error("Media storage is required for cleanup");
  console.info(await cleanupMedia(runtime.dependencies.db, storage));
} finally {
  await runtime.close();
}
