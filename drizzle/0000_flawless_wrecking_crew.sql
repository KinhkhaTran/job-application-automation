DO $$ BEGIN
 CREATE TYPE "public"."application_status" AS ENUM('draft', 'ready', 'submitted', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ats_type" AS ENUM('greenhouse', 'lever', 'ashby', 'workday', 'custom', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."posting_status" AS ENUM('new', 'reviewing', 'applied', 'interviewing', 'rejected', 'ghosted', 'offer', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"posting_id" integer NOT NULL,
	"resume_version" text,
	"cover_letter" text,
	"screening_answers" text,
	"status" "application_status" DEFAULT 'draft' NOT NULL,
	"submitted_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"careers_url" text NOT NULL,
	"ats_type" "ats_type" DEFAULT 'unknown' NOT NULL,
	"ats_board_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"location" text,
	"description" text,
	"posted_date" timestamp,
	"found_date" timestamp DEFAULT now() NOT NULL,
	"dedup_hash" text NOT NULL,
	"is_new_grad" boolean DEFAULT false NOT NULL,
	"required_years_min" integer,
	"status" "posting_status" DEFAULT 'new' NOT NULL,
	"source" text NOT NULL,
	"raw_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scrape_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"source" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"postings_found" integer DEFAULT 0 NOT NULL,
	"postings_new" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_history" ADD CONSTRAINT "application_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_posting_id_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."postings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "postings" ADD CONSTRAINT "postings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scrape_logs" ADD CONSTRAINT "scrape_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "postings_dedup_hash_idx" ON "postings" USING btree ("dedup_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "postings_company_idx" ON "postings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "postings_status_idx" ON "postings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "postings_found_date_idx" ON "postings" USING btree ("found_date");