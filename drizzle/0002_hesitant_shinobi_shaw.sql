ALTER TABLE "applications" ADD COLUMN "packet_fingerprint" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "provenance" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "approved_fingerprint" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "approved_url" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "approved_at" timestamp;