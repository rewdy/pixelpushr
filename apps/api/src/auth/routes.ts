import type {
  CreateInvitationResponse,
  SendInvitationEmailResponse,
} from "@pixelpushr/contracts/invitations";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import type { Database } from "../db/client";
import { firstRow } from "../db/rows";
import { invitations, memberships, organizations, users } from "../db/schema";
import { ApiError } from "../http/errors";
import { parseJsonBody } from "../http/validation";
import type { MediaStorage } from "../media/storage";
import {
  getAdmin,
  getOwner,
  requireMembership,
  sessionCredential,
} from "./guard";
import { type InvitationMailer, submitInvitationEmail } from "./mailer";
import type { AuthProvider } from "./provider";
import { sessionLifetimeSeconds } from "./sessionStorage";
import { createSessions, sessionCookieName } from "./sessions";

export type AppDependencies = {
  db: Database["db"];
  auth: AuthProvider;
  mailer: InvitationMailer;
  publicWebUrl: string;
  initialOwnerEmail?: string;
  sessionEncryptionKey?: string;
  storage?: MediaStorage;
  maxImageBytes?: number;
  maxVideoBytes?: number;
};

const registerSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
});
const confirmSchema = z.object({ email: z.email(), code: z.string().min(1) });
const setupSchema = z.object({
  name: z.string().trim().min(1).max(160),
  timezone: z.string().min(1).max(100),
});
const inviteSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});
const acceptSchema = z.object({ token: z.string().min(20) });

const hashToken = async (token: string) =>
  Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  ).toString("hex");

/** Registers first-run, session, and administrator protection endpoints. */
export const registerAuthRoutes = (
  app: Hono,
  {
    db,
    auth,
    mailer,
    publicWebUrl,
    initialOwnerEmail,
    sessionEncryptionKey,
  }: AppDependencies,
) => {
  const sessions = createSessions(db, auth, sessionEncryptionKey);
  const origin = new URL(publicWebUrl).origin;
  const cookieOptions = {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "Lax" as const,
    path: "/",
  };
  app.use("*", async (context, next) => {
    const path = context.req.path;
    const protectedPath =
      path.startsWith("/admin/") ||
      path.startsWith("/auth/") ||
      path === "/setup" ||
      path === "/invitations/accept";
    if (protectedPath) {
      context.header("Cache-Control", "no-store");
      if (
        !["GET", "HEAD", "OPTIONS"].includes(context.req.method) &&
        context.req.header("origin") !== origin
      )
        throw new ApiError(
          403,
          "forbidden",
          "This request must come from the pixelpushr site.",
        );
    }
    await next();
  });
  app.use("/admin/*", async (context, next) => {
    const { user } = await sessions.resolve(sessionCredential(context));
    context.set("admin", await requireMembership(db, user));
    await next();
  });

  app.get("/setup/status", async (context) => {
    const existing = await db.query.organizations.findFirst();
    return context.json({ setupRequired: !existing });
  });

  app.post("/auth/register", async (context) => {
    const body = await parseJsonBody(context, registerSchema);
    const organization = await db.query.organizations.findFirst();
    if (organization) {
      const invitation = await db.query.invitations.findFirst({
        where: and(
          eq(invitations.organizationId, organization.id),
          eq(invitations.email, body.email),
          eq(invitations.status, "pending"),
        ),
      });
      if (!invitation || invitation.expiresAt <= new Date())
        throw new ApiError(
          403,
          "forbidden",
          "An active invitation is required",
        );
    }
    const result = await auth.signUp(body.email, body.password);
    await db
      .insert(users)
      .values({ subject: result.subject, email: body.email })
      .onConflictDoNothing({ target: users.subject });
    return context.json(
      { confirmationRequired: result.confirmationRequired },
      201,
    );
  });

  app.post("/auth/confirm", async (context) => {
    const body = await parseJsonBody(context, confirmSchema);
    await auth.confirm(body.email, body.code);
    return context.json({ confirmed: true });
  });

  app.post("/auth/login", async (context) => {
    const body = await parseJsonBody(context, registerSchema);
    const credential = await sessions.login(
      body.email,
      body.password,
      sessionCredential(context),
    );
    setCookie(context, sessionCookieName, credential, {
      ...cookieOptions,
      maxAge: sessionLifetimeSeconds,
    });
    return context.json({ signedIn: true });
  });

  app.get("/auth/session", async (context) => {
    await sessions.resolve(sessionCredential(context));
    return context.json({ signedIn: true });
  });

  app.post("/auth/logout", async (context) => {
    await sessions.logout(sessionCredential(context));
    setCookie(context, sessionCookieName, "", { ...cookieOptions, maxAge: 0 });
    return context.json({ signedOut: true });
  });

  app.post("/setup", async (context) => {
    const identity = await sessions.resolve(
      sessionCredential(context),
      Boolean(initialOwnerEmail),
    );
    const body = await parseJsonBody(context, setupSchema);
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
    } catch {
      throw new ApiError(400, "invalid_request", "Invalid IANA timezone", [
        {
          path: "timezone",
          message: "Enter an IANA timezone such as America/Chicago",
        },
      ]);
    }
    const created = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(73250113)`);
      const existing = await transaction
        .select({ id: organizations.id })
        .from(organizations)
        .limit(1);
      if (existing.length)
        throw new ApiError(
          409,
          "conflict",
          "Organization setup is already complete",
        );
      if (
        initialOwnerEmail &&
        identity.email.toLowerCase() !== initialOwnerEmail
      )
        throw new ApiError(
          403,
          "forbidden",
          "Workspace setup requires the designated owner's verified email",
        );
      const organization = firstRow(
        await transaction.insert(organizations).values(body).returning(),
      );
      await transaction.insert(memberships).values({
        organizationId: organization.id,
        userId: identity.user.id,
        role: "owner",
      });
      return organization;
    });
    return context.json({ organization: created }, 201);
  });

  app.get("/admin/me", async (context) => {
    const { user, membership } = getAdmin(context);
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, membership.organizationId),
    });
    return context.json({
      user: { id: user.id, email: user.email, name: user.name },
      membership,
      organization,
    });
  });

  app.get("/admin/members", async (context) => {
    const { membership } = getAdmin(context);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, membership.organizationId));
    return context.json({ members: rows });
  });

  app.patch("/admin/organization", async (context) => {
    const membership = getOwner(context);
    const body = await parseJsonBody(context, setupSchema);
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
    } catch {
      throw new ApiError(400, "invalid_request", "Invalid IANA timezone", [
        {
          path: "timezone",
          message: "Enter an IANA timezone such as America/Chicago",
        },
      ]);
    }
    const organization = firstRow(
      await db
        .update(organizations)
        .set(body)
        .where(eq(organizations.id, membership.organizationId))
        .returning(),
    );
    return context.json({ organization });
  });

  const invitationUrl = (token: string) =>
    `${publicWebUrl.replace(/\/$/, "")}/invite/${token}`;

  app.get("/admin/invitations", async (context) => {
    const membership = getOwner(context);
    const records = await db.query.invitations.findMany({
      where: eq(invitations.organizationId, membership.organizationId),
    });
    return context.json({
      invitations: records.map(({ tokenHash: _tokenHash, ...invitation }) => ({
        ...invitation,
        status:
          invitation.status === "pending" && invitation.expiresAt <= new Date()
            ? "expired"
            : invitation.status,
      })),
    });
  });

  app.post("/admin/invitations", async (context) => {
    const membership = getOwner(context);
    const { email } = await parseJsonBody(context, inviteSchema);
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    const existingMembership = existingUser
      ? await db.query.memberships.findFirst({
          where: and(
            eq(memberships.organizationId, membership.organizationId),
            eq(memberships.userId, existingUser.id),
          ),
        })
      : undefined;
    if (existingMembership)
      throw new ApiError(
        409,
        "conflict",
        "This user is already an administrator",
      );
    const pending = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.organizationId, membership.organizationId),
        eq(invitations.email, email),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    });
    if (pending)
      throw new ApiError(
        409,
        "conflict",
        "A pending invitation already exists for this email",
      );
    const token = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64url");
    const record = firstRow(
      await db
        .insert(invitations)
        .values({
          organizationId: membership.organizationId,
          email,
          tokenHash: await hashToken(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning(),
    );
    context.header("Cache-Control", "no-store");
    return context.json(
      {
        invitation: {
          id: record.id,
          email: record.email,
          status: record.status,
          expiresAt: record.expiresAt.toISOString(),
        },
        url: invitationUrl(token),
      } satisfies CreateInvitationResponse,
      201,
    );
  });

  app.delete("/admin/invitations/:id", async (context) => {
    const membership = getOwner(context);
    const id = z.uuid().safeParse(context.req.param("id"));
    if (!id.success)
      throw new ApiError(400, "invalid_request", "Invalid invitation ID");
    const [revoked] = await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.id, id.data),
          eq(invitations.organizationId, membership.organizationId),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: invitations.id });
    if (!revoked)
      throw new ApiError(404, "not_found", "Pending invitation not found");
    return context.json({ revoked: true });
  });

  app.post("/admin/invitations/email", async (context) => {
    const membership = getOwner(context);
    const { token } = await parseJsonBody(context, acceptSchema);
    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.organizationId, membership.organizationId),
        eq(invitations.tokenHash, await hashToken(token)),
      ),
    });
    if (!invitation)
      throw new ApiError(404, "not_found", "Invitation not found");
    if (invitation.status === "expired" || invitation.expiresAt <= new Date())
      throw new ApiError(410, "conflict", "Invitation has expired");
    if (invitation.status === "accepted")
      throw new ApiError(
        409,
        "conflict",
        "Invitation has already been accepted",
      );
    const emailStatus = await submitInvitationEmail(
      mailer,
      invitation.email,
      invitationUrl(token),
    );
    return context.json<SendInvitationEmailResponse>({ emailStatus });
  });

  app.post("/invitations/accept", async (context) => {
    const identity = await sessions.resolve(sessionCredential(context), true);
    const { token } = await parseJsonBody(context, acceptSchema);
    const tokenHash = await hashToken(token);
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select id from invitations where token_hash = ${tokenHash} for update`,
      );
      const invitation = await transaction.query.invitations.findFirst({
        where: eq(invitations.tokenHash, tokenHash),
      });
      if (!invitation) return "not_found" as const;
      if (invitation.status !== "pending") return invitation.status;
      if (invitation.expiresAt <= new Date()) {
        await transaction
          .update(invitations)
          .set({ status: "expired" })
          .where(eq(invitations.id, invitation.id));
        return "expired" as const;
      }
      const { user } = identity;
      if (!identity.email || identity.email.toLowerCase() !== invitation.email)
        return "wrong_account" as const;
      const existing = await transaction.query.memberships.findFirst({
        where: and(
          eq(memberships.organizationId, invitation.organizationId),
          eq(memberships.userId, user.id),
        ),
      });
      if (existing) return "already_member" as const;
      await transaction.insert(memberships).values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: "admin",
      });
      await transaction
        .update(invitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));
      return "accepted_now" as const;
    });
    if (result === "not_found")
      throw new ApiError(404, "not_found", "Invitation not found");
    if (result === "expired")
      throw new ApiError(410, "conflict", "Invitation has expired");
    if (result === "wrong_account")
      throw new ApiError(
        403,
        "forbidden",
        "Sign in with the invited email address",
      );
    if (result === "already_member")
      throw new ApiError(
        409,
        "conflict",
        "This user is already an administrator",
      );
    if (result === "accepted")
      throw new ApiError(
        409,
        "conflict",
        "Invitation has already been accepted",
      );
    return context.json({ accepted: true });
  });
};
