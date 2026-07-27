ALTER TABLE "applications" ADD COLUMN "application_url" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "application_domain" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "handoff_allowed" boolean;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "handoff_reason" text;