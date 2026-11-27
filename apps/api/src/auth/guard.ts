import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Database } from "../db/client";
import { memberships, type users } from "../db/schema";
import { ApiError } from "../http/errors";
import { sessionCookieName } from "./sessions";

declare module "hono" {
  interface ContextVariableMap {
    admin: {
      user: typeof users.$inferSelect;
      membership: typeof memberships.$inferSelect;
    };
  }
}

/** Extracts the opaque browser session credential. */
export const sessionCredential = (context: Context) =>
  getCookie(context, sessionCookieName);

/** Checks that the current account still holds workspace membership. */
export const requireMembership = async (
  db: Database["db"],
  user: typeof users.$inferSelect,
) => {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership)
    throw new ApiError(
      403,
      "membership_required",
      "This account is not an administrator. Accept an invitation to continue.",
    );
  return { user, membership };
};

/** Reads the administrator resolved by the route middleware. */
export const getAdmin = (context: Context) => context.get("admin");

/** Limits a workspace operation to its owner. */
export const getOwner = (context: Context) => {
  const { membership } = getAdmin(context);
  if (membership.role !== "owner")
    throw new ApiError(
      403,
      "owner_required",
      "Only the workspace owner can do this.",
    );
  return membership;
};
