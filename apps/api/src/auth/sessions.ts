import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { adminSessions, users } from "../db/schema";
import { ApiError } from "../http/errors";
import type { AuthProvider } from "./provider";
import {
  newSessionCredential,
  sessionDigest,
  sessionEncryption,
  sessionLifetimeSeconds,
} from "./sessionStorage";

export const sessionCookieName = "pixelpushr-session";
export const sessionRequired = () =>
  new ApiError(401, "session_required", "Sign in to continue.");
const sessionEnded = () =>
  new ApiError(
    401,
    "session_ended",
    "Your session ended. Sign in again to continue.",
  );

type Credentials = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
};

/** Persists and renews application sessions independently of provider lifetimes. */
export const createSessions = (
  db: Database["db"],
  auth: AuthProvider,
  key?: string,
  now = Date.now,
) => {
  const encryption = key ? sessionEncryption(key) : undefined;
  if (auth.renew && !encryption)
    throw new Error("Missing session encryption configuration");
  const read = (
    row: typeof adminSessions.$inferSelect,
  ): Credentials | undefined => {
    if (!row.providerCredentials) return undefined;
    if (!encryption)
      throw new Error("Missing session encryption configuration");
    return JSON.parse(
      encryption.open(row.providerCredentials, row.digest),
    ) as Credentials;
  };
  return {
    login: async (email: string, password: string, previous?: string) => {
      const result = await auth.signIn(email, password);
      const issuedAt = now();
      const identity = await auth.verify(result.accessToken);
      const user = await db.query.users.findFirst({
        where: eq(users.subject, identity.subject),
      });
      if (!user)
        throw new ApiError(401, "unauthorized", "Registered account required");
      const credential = newSessionCredential();
      const digest = sessionDigest(credential);
      let providerCredentials: string | undefined;
      if (encryption && auth.renew) {
        if (!result.refreshToken)
          throw new Error("Missing provider session credentials");
        providerCredentials = encryption.seal(
          JSON.stringify({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            accessExpiresAt: issuedAt + result.expiresIn * 1000,
          } satisfies Credentials),
          digest,
        );
      }
      await db.transaction(async (tx) => {
        if (previous)
          await tx
            .delete(adminSessions)
            .where(eq(adminSessions.digest, sessionDigest(previous)));
        await tx.insert(adminSessions).values({
          digest,
          userId: user.id,
          expiresAt: new Date(issuedAt + sessionLifetimeSeconds * 1000),
          providerCredentials,
        });
      });
      return credential;
    },
    resolve: async (credential: string | undefined, verifiedEmail = false) => {
      if (!credential) throw sessionRequired();
      if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) throw sessionEnded();
      const digest = sessionDigest(credential);
      const requested = await db.query.adminSessions.findFirst({
        where: eq(adminSessions.digest, digest),
      });
      if (!requested || requested.expiresAt.getTime() <= now())
        throw sessionEnded();
      let credentials = read(requested);
      if (credentials && credentials.accessExpiresAt <= now() + 5000) {
        const renewed = await db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(adminSessions)
            .where(eq(adminSessions.digest, digest))
            .for("update");
          if (!row || row.expiresAt.getTime() <= now()) return undefined;
          const stored = read(row);
          if (!stored || !auth.renew || !encryption) return undefined;
          if (stored.accessExpiresAt > now() + 5000) return stored;
          try {
            const startedAt = now();
            const next = await auth.renew(stored.refreshToken);
            const identity = await auth.verify(next.accessToken);
            const user = await tx.query.users.findFirst({
              where: eq(users.id, row.userId),
            });
            if (!next.refreshToken || identity.subject !== user?.subject)
              throw sessionEnded();
            if (row.expiresAt.getTime() <= now()) return undefined;
            const rotated = {
              accessToken: next.accessToken,
              refreshToken: next.refreshToken,
              accessExpiresAt: startedAt + next.expiresIn * 1000,
            };
            await tx
              .update(adminSessions)
              .set({
                providerCredentials: encryption.seal(
                  JSON.stringify(rotated),
                  digest,
                ),
              })
              .where(eq(adminSessions.digest, digest));
            return rotated;
          } catch (error) {
            if (!(error instanceof ApiError) || error.code !== "session_ended")
              throw error;
            await tx
              .delete(adminSessions)
              .where(eq(adminSessions.digest, digest));
            return undefined;
          }
        });
        if (!renewed) throw sessionEnded();
        credentials = renewed;
      }
      const user = await db.query.users.findFirst({
        where: eq(users.id, requested.userId),
      });
      if (!user || requested.expiresAt.getTime() <= now()) throw sessionEnded();
      let email = user.email;
      if (verifiedEmail && credentials) {
        try {
          email = (
            await auth.verify(credentials.accessToken, {
              requireVerifiedEmail: true,
            })
          ).email;
        } catch (error) {
          if (error instanceof ApiError && error.code === "session_ended")
            await db
              .delete(adminSessions)
              .where(eq(adminSessions.digest, digest));
          throw error;
        }
      }
      if (requested.expiresAt.getTime() <= now()) throw sessionEnded();
      return { user, email };
    },
    logout: async (credential?: string) => {
      if (!credential) return;
      const [row] = await db
        .delete(adminSessions)
        .where(eq(adminSessions.digest, sessionDigest(credential)))
        .returning();
      if (!row || !auth.revoke) return;
      try {
        const stored = read(row);
        if (stored) await auth.revoke(stored.refreshToken);
      } catch {
        console.warn(
          JSON.stringify({ event: "provider_session_revocation_failed" }),
        );
      }
    },
  };
};
