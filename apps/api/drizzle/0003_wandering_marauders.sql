CREATE TABLE "media_asset_tags" (
	"media_asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "media_asset_tags_media_asset_id_tag_id_pk" PRIMARY KEY("media_asset_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "media_replacements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_object_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_replacements_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"normalized_name" varchar(60) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retired_media_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retired_media_objects_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_tag_id_media_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."media_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_replacements" ADD CONSTRAINT "media_replacements_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_replacements_asset_idx" ON "media_replacements" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tags_org_normalized_unique" ON "media_tags" USING btree ("organization_id","normalized_name");--> statement-breakpoint
CREATE INDEX "retired_media_objects_expiry_idx" ON "retired_media_objects" USING btree ("expires_at");