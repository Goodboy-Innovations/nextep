CREATE TABLE "event_occurrences" (
	"event_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "event_occurrences_event_id_starts_at_pk" PRIMARY KEY("event_id","starts_at")
);
--> statement-breakpoint
CREATE TABLE "event_terms" (
	"event_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "event_terms_event_id_term_id_pk" PRIMARY KEY("event_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uid" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"extract" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"dtstart_local" timestamp NOT NULL,
	"tzid" text DEFAULT 'Europe/Helsinki' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"rrule" text,
	"exdates" date[] DEFAULT '{}' NOT NULL,
	"venue_name" text,
	"street_address" text,
	"city" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"geog" "geography" GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
	"url" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(extract, '')), 'B') || setweight(to_tsvector('simple', coalesce(description, '')), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_uid_unique" UNIQUE("uid"),
	CONSTRAINT "events_org_id_slug_unique" UNIQUE("org_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	CONSTRAINT "memberships_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"business_id" text,
	"email" text,
	"phone" text,
	"website" text,
	"street_address" text,
	"postal_code" text,
	"city" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timezone" text DEFAULT 'Europe/Helsinki' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"labels" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "taxonomy_terms_kind_slug_unique" UNIQUE("kind","slug")
);
--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_terms" ADD CONSTRAINT "event_terms_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_terms" ADD CONSTRAINT "event_terms_term_id_taxonomy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."taxonomy_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_occurrences_ends_at_idx" ON "event_occurrences" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "events_geog_idx" ON "events" USING gist ("geog");--> statement-breakpoint
CREATE INDEX "events_search_idx" ON "events" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "events_title_trgm_idx" ON "events" USING gin ("title" gin_trgm_ops);