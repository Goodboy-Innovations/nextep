-- Extensions used by the schema: geo queries (events.geog) and fuzzy search (trigram index).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
