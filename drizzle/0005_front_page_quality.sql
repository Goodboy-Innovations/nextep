DROP TABLE "event_features" CASCADE;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "front_page_limit" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
-- Keep deliberate admin choices: organizations switched off (0) or given more than the new default.
UPDATE "organizations" SET "front_page_limit" = "featured_per_week" WHERE "featured_per_week" = 0 OR "featured_per_week" > 5;--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "featured_per_week";
