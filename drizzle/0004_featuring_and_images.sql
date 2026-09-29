CREATE TABLE "event_features" (
	"event_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_features_event_id_week_start_pk" PRIMARY KEY("event_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "featured_per_week" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_features" ADD CONSTRAINT "event_features_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_features_week_idx" ON "event_features" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "media_assets_org_idx" ON "media_assets" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_image_id_media_assets_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;