import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Database } from "../db/client";
import { memberships, users } from "../db/schema";
import { ApiError } from "../http/errors";
import type { AuthProvider } from "./provider";

/** Resolves the authenticated administrator's single-organization membership. */
export const getAdmin = async (context: Context, db: Database["db"], auth: AuthProvider) => {
  const header = context.req.header("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "unauthorized", "Administrator session required");
  const identity = await auth.verify(header.slice(7));
  const user = await db.query.users.findFirst({ where: eq(users.subject, identity.subject) });
  const membership = user ? await db.query.memberships.findFirst({ where: eq(memberships.userId, user.id) }) : undefined;
  if (!user || !membership) throw new ApiError(403, "forbidden", "Administrator membership required");
  return { user, membership };
};
