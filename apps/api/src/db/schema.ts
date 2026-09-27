import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["owner", "admin"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
]);
export const mediaKind = pgEnum("media_kind", ["image", "video"]);
export const mediaStatus = pgEnum("media_status", [
  "pending",
  "ready",
  "failed",
]);
export const videoMode = pgEnum("video_mode", ["once", "repeat"]);
export const assignmentMode = pgEnum("assignment_mode", [
  "always",
  "scheduled",
  "override",
]);
export const recurrenceKind = pgEnum("recurrence_kind", ["none", "weekly"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: varchar("subject", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }),
    localPasswordHash: text("local_password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(table.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    status: invitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invitations_org_email_idx").on(table.organizationId, table.email),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    kind: mediaKind("kind").notNull(),
    status: mediaStatus("status").notNull().default("pending"),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    objectKey: text("object_key").notNull().unique(),
    thumbnailKey: text("thumbnail_key"),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("media_assets_org_idx").on(table.organizationId)],
);

export const mediaReplacements = pgTable(
  "media_replacements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    originalObjectKey: text("original_object_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: mediaStatus("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("media_replacements_asset_idx").on(table.mediaAssetId)],
);

export const retiredMediaObjects = pgTable(
  "retired_media_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    objectKey: text("object_key").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("retired_media_objects_expiry_idx").on(table.expiresAt)],
);

export const mediaTags = pgTable(
  "media_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 60 }).notNull(),
  },
  (table) => [
    uniqueIndex("media_tags_org_normalized_unique").on(
      table.organizationId,
      table.normalizedName,
    ),
  ],
);

export const mediaAssetTags = pgTable(
  "media_asset_tags",
  {
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => mediaTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.mediaAssetId, table.tagId] })],
);

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("playlists_org_idx").on(table.organizationId)],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    imageDurationMs: integer("image_duration_ms"),
    videoMode: videoMode("video_mode"),
    repeatDurationMs: integer("repeat_duration_ms"),
  },
  (table) => [
    uniqueIndex("playlist_items_position_unique").on(
      table.playlistId,
      table.position,
    ),
  ],
);

export const displays = pgTable(
  "displays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    playerTokenHash: varchar("player_token_hash", { length: 64 })
      .notNull()
      .unique(),
    playerToken: varchar("player_token", { length: 100 }).notNull().unique(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastHealth: text("last_health"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("displays_org_idx").on(table.organizationId)],
);

export const scheduleRules = pgTable(
  "schedule_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recurrence: recurrenceKind("recurrence").notNull().default("none"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull(),
    weekInterval: integer("week_interval"),
    recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
  },
  (table) => [index("schedule_rules_org_idx").on(table.organizationId)],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayId: uuid("display_id")
      .notNull()
      .references(() => displays.id, { onDelete: "cascade" }),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    scheduleRuleId: uuid("schedule_rule_id").references(
      () => scheduleRules.id,
      { onDelete: "cascade" },
    ),
    mode: assignmentMode("mode").notNull(),
    position: integer("position").notNull().default(0),
    priority: integer("priority").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("assignments_display_idx").on(table.displayId)],
);

export const organizationRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  mediaAssets: many(mediaAssets),
  playlists: many(playlists),
  displays: many(displays),
}));
export const playlistRelations = relations(playlists, ({ many }) => ({
  items: many(playlistItems),
  assignments: many(assignments),
}));
export const displayRelations = relations(displays, ({ many }) => ({
  assignments: many(assignments),
}));
