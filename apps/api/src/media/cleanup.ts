import { and, eq, lte, ne } from "drizzle-orm";
import type { Database } from "../db/client";
import { mediaReplacements, retiredMediaObjects } from "../db/schema";
import type { MediaStorage } from "./storage";

/** Removes expired, non-published uploads and retired media in retryable batches. */
export const cleanupMedia = async (
  db: Database["db"],
  storage: MediaStorage,
  now = new Date(),
) => {
  let removedCandidates = 0;
  let removedObjects = 0;
  const candidates = await db
    .select()
    .from(mediaReplacements)
    .where(
      and(
        ne(mediaReplacements.status, "ready"),
        lte(mediaReplacements.createdAt, new Date(now.getTime() - 86400000)),
      ),
    )
    .limit(100);
  for (const candidate of candidates) {
    const claimed = await db.transaction(async (transaction) => {
      const rows = await transaction
        .delete(mediaReplacements)
        .where(
          and(
            ne(mediaReplacements.status, "ready"),
            lte(
              mediaReplacements.createdAt,
              new Date(now.getTime() - 86400000),
            ),
            eq(mediaReplacements.id, candidate.id),
          ),
        )
        .returning();
      if (!rows[0]) return false;
      await transaction.insert(retiredMediaObjects).values({
        objectKey: candidate.objectKey,
        expiresAt: now,
      });
      return true;
    });
    if (claimed) removedCandidates++;
  }
  // Successful staging keys are retired by completion. Discard their audit rows
  // here; the active server-only copy is tracked by the media asset itself.
  await db
    .delete(mediaReplacements)
    .where(
      and(
        eq(mediaReplacements.status, "ready"),
        lte(mediaReplacements.createdAt, new Date(now.getTime() - 86400000)),
      ),
    );
  const retired = await db
    .select()
    .from(retiredMediaObjects)
    .where(lte(retiredMediaObjects.expiresAt, now))
    .limit(100);
  for (const object of retired) {
    await storage.remove(object.objectKey);
    await db
      .delete(retiredMediaObjects)
      .where(eq(retiredMediaObjects.id, object.id));
    removedObjects++;
  }
  return { removedCandidates, removedObjects };
};
