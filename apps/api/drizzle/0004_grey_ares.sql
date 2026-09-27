ALTER TYPE "public"."recurrence_kind" ADD VALUE 'daily' BEFORE 'weekly';--> statement-breakpoint
ALTER TYPE "public"."recurrence_kind" ADD VALUE 'monthly';--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "repeat_interval" integer;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "weekdays" integer[];--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "month_day" integer;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "month_ordinal" integer;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "month_weekday" integer;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD COLUMN "last_occurrence_date" date;--> statement-breakpoint
UPDATE "schedule_rules"
SET "repeat_interval" = COALESCE("week_interval", 1),
    "weekdays" = ARRAY[EXTRACT(ISODOW FROM "start_at" AT TIME ZONE "timezone")::integer]
WHERE "recurrence" = 'weekly';
