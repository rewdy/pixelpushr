import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { lte } from "drizzle-orm";
import type { Database } from "../db/client";
import { adminSessions } from "../db/schema";

export const sessionLifetimeSeconds = 7 * 24 * 60 * 60;

/** Generates a browser credential and its database lookup digest. */
export const newSessionCredential = () => randomBytes(32).toString("base64url");

/** Hashes an opaque session credential before querying or storing it. */
export const sessionDigest = (credential: string) =>
  createHash("sha256").update(credential).digest("hex");

/** Protects provider tokens at rest and binds ciphertext to its session. */
export const sessionEncryption = (hexKey: string) => {
  if (!/^[0-9a-f]{64}$/i.test(hexKey))
    throw new Error("Invalid session encryption key");
  const key = Buffer.from(hexKey, "hex");
  return {
    seal: (plaintext: string, digest: string) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(digest));
      const encrypted = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
        "base64url",
      );
    },
    open: (sealed: string, digest: string) => {
      try {
        const buffer = Buffer.from(sealed, "base64url");
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          buffer.subarray(0, 12),
        );
        decipher.setAAD(Buffer.from(digest));
        decipher.setAuthTag(buffer.subarray(12, 28));
        return Buffer.concat([
          decipher.update(buffer.subarray(28)),
          decipher.final(),
        ]).toString();
      } catch {
        throw new Error("Unable to read stored session credentials");
      }
    },
  };
};

/** Deletes sessions at or beyond their absolute expiration time. */
export const cleanupExpiredSessions = (db: Database["db"], now = new Date()) =>
  db.delete(adminSessions).where(lte(adminSessions.expiresAt, now));
