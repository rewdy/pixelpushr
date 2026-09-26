import { and, asc, eq } from "drizzle-orm";
import type { Database } from "./client";
import { assignments, displays, invitations, mediaAssets, memberships, organizations, playlistItems, playlists, scheduleRules, users } from "./schema";

type Session = Database["db"];

/** Provides tenant-scoped persistence operations used by domain services. */
export const createRepositories = (db: Session) => ({
  organizations: {
    first: async () => db.query.organizations.findFirst(),
    create: async (values: typeof organizations.$inferInsert) => (await db.insert(organizations).values(values).returning())[0]!,
    update: async (id: string, values: Partial<typeof organizations.$inferInsert>) => (await db.update(organizations).set(values).where(eq(organizations.id, id)).returning())[0],
  },
  users: {
    bySubject: async (subject: string) => db.query.users.findFirst({ where: eq(users.subject, subject) }),
    byEmail: async (email: string) => db.query.users.findFirst({ where: eq(users.email, email) }),
    create: async (values: typeof users.$inferInsert) => (await db.insert(users).values(values).returning())[0]!,
  },
  memberships: {
    byUser: async (userId: string) => db.query.memberships.findFirst({ where: eq(memberships.userId, userId) }),
    list: async (organizationId: string) => db.select().from(memberships).where(eq(memberships.organizationId, organizationId)),
    create: async (values: typeof memberships.$inferInsert) => (await db.insert(memberships).values(values).returning())[0]!,
  },
  invitations: {
    list: async (organizationId: string) => db.select().from(invitations).where(eq(invitations.organizationId, organizationId)),
    byHash: async (tokenHash: string) => db.query.invitations.findFirst({ where: eq(invitations.tokenHash, tokenHash) }),
    create: async (values: typeof invitations.$inferInsert) => (await db.insert(invitations).values(values).returning())[0]!,
    accept: async (id: string, at: Date) => (await db.update(invitations).set({ status: "accepted", acceptedAt: at }).where(eq(invitations.id, id)).returning())[0],
    expire: async (id: string) => (await db.update(invitations).set({ status: "expired" }).where(eq(invitations.id, id)).returning())[0],
  },
  media: {
    list: async (organizationId: string) => db.select().from(mediaAssets).where(eq(mediaAssets.organizationId, organizationId)),
    byId: async (organizationId: string, id: string) => db.query.mediaAssets.findFirst({ where: and(eq(mediaAssets.organizationId, organizationId), eq(mediaAssets.id, id)) }),
    create: async (values: typeof mediaAssets.$inferInsert) => (await db.insert(mediaAssets).values(values).returning())[0]!,
    update: async (organizationId: string, id: string, values: Partial<typeof mediaAssets.$inferInsert>) => (await db.update(mediaAssets).set({ ...values, updatedAt: new Date() }).where(and(eq(mediaAssets.organizationId, organizationId), eq(mediaAssets.id, id))).returning())[0],
    remove: async (organizationId: string, id: string) => db.delete(mediaAssets).where(and(eq(mediaAssets.organizationId, organizationId), eq(mediaAssets.id, id))),
  },
  playlists: {
    list: async (organizationId: string) => db.select().from(playlists).where(eq(playlists.organizationId, organizationId)),
    byId: async (organizationId: string, id: string) => db.query.playlists.findFirst({ where: and(eq(playlists.organizationId, organizationId), eq(playlists.id, id)) }),
    create: async (values: typeof playlists.$inferInsert) => (await db.insert(playlists).values(values).returning())[0]!,
    update: async (organizationId: string, id: string, values: Partial<typeof playlists.$inferInsert>) => (await db.update(playlists).set({ ...values, updatedAt: new Date() }).where(and(eq(playlists.organizationId, organizationId), eq(playlists.id, id))).returning())[0],
    remove: async (organizationId: string, id: string) => db.delete(playlists).where(and(eq(playlists.organizationId, organizationId), eq(playlists.id, id))),
    items: async (playlistId: string) => db.select().from(playlistItems).where(eq(playlistItems.playlistId, playlistId)).orderBy(asc(playlistItems.position)),
    addItem: async (values: typeof playlistItems.$inferInsert) => (await db.insert(playlistItems).values(values).returning())[0]!,
    removeItems: async (playlistId: string) => db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId)),
  },
  displays: {
    list: async (organizationId: string) => db.select().from(displays).where(eq(displays.organizationId, organizationId)),
    byId: async (organizationId: string, id: string) => db.query.displays.findFirst({ where: and(eq(displays.organizationId, organizationId), eq(displays.id, id)) }),
    byTokenHash: async (playerTokenHash: string) => db.query.displays.findFirst({ where: eq(displays.playerTokenHash, playerTokenHash) }),
    create: async (values: typeof displays.$inferInsert) => (await db.insert(displays).values(values).returning())[0]!,
    heartbeat: async (id: string, health: string) => db.update(displays).set({ lastSeenAt: new Date(), lastHealth: health }).where(eq(displays.id, id)),
    remove: async (organizationId: string, id: string) => db.delete(displays).where(and(eq(displays.organizationId, organizationId), eq(displays.id, id))),
  },
  schedules: {
    create: async (values: typeof scheduleRules.$inferInsert) => (await db.insert(scheduleRules).values(values).returning())[0]!,
    byId: async (organizationId: string, id: string) => db.query.scheduleRules.findFirst({ where: and(eq(scheduleRules.organizationId, organizationId), eq(scheduleRules.id, id)) }),
    list: async (organizationId: string) => db.select().from(scheduleRules).where(eq(scheduleRules.organizationId, organizationId)),
  },
  assignments: {
    list: async (displayId: string) => db.select().from(assignments).where(eq(assignments.displayId, displayId)).orderBy(asc(assignments.position), asc(assignments.createdAt), asc(assignments.id)),
    create: async (values: typeof assignments.$inferInsert) => (await db.insert(assignments).values(values).returning())[0]!,
    remove: async (displayId: string, id: string) => db.delete(assignments).where(and(eq(assignments.displayId, displayId), eq(assignments.id, id))),
  },
});
