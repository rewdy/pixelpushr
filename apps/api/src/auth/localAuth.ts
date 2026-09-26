import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { ApiError } from "../http/errors";
import type { AuthProvider } from "./provider";

/** Implements a development-only identity provider backed by PostgreSQL. */
export const createLocalAuth = (db: Database["db"], secret: string): AuthProvider => {
  const key = new TextEncoder().encode(secret);
  return {
    signUp: async (email, password) => {
      const normalized = email.trim().toLowerCase();
      const existing = await db.query.users.findFirst({ where: eq(users.email, normalized) });
      if (existing) throw new ApiError(409, "conflict", "Account already exists");
      const subject = crypto.randomUUID();
      await db.insert(users).values({ subject, email: normalized, localPasswordHash: await Bun.password.hash(password) });
      return { subject, confirmationRequired: false };
    },
    confirm: async () => undefined,
    signIn: async (email, password) => {
      const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
      if (!user?.localPasswordHash || !(await Bun.password.verify(password, user.localPasswordHash))) throw new ApiError(401, "unauthorized", "Invalid email or password");
      const accessToken = await new SignJWT({ email: user.email }).setProtectedHeader({ alg: "HS256" }).setSubject(user.subject).setIssuer("pixelpushr-local").setAudience("pixelpushr-admin").setIssuedAt().setExpirationTime("12h").sign(key);
      return { accessToken, expiresIn: 43200 };
    },
    verify: async (token) => {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: "pixelpushr-local", audience: "pixelpushr-admin" });
        if (!payload.sub || typeof payload.email !== "string") throw new Error("Missing identity claims");
        return { subject: payload.sub, email: payload.email };
      } catch {
        throw new ApiError(401, "unauthorized", "Invalid or expired session");
      }
    },
  };
};
