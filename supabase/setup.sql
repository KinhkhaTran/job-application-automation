-- One-time Supabase setup for auth + onboarding + résumé storage.
-- Run this in the Supabase SQL editor (Dashboard → SQL) OR set a real
-- DATABASE_URL and run `npm run db:migrate` (which applies drizzle/0002_*.sql;
-- this file additionally provisions the Storage bucket + RLS policies).
--
-- Public tables are written by the app via postgres.js (service connection) and
-- scoped by user_id in application code, so they do not need RLS. The private
-- `resumes` Storage bucket DOES use RLS so a user can only touch their own
-- folder (path prefix = their auth uid).

-- ── Tables (mirrors drizzle/0002) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "full_name" text,
  "email" text,
  "phone" text,
  "location" text,
  "linkedin_url" text,
  "github_url" text,
  "portfolio_url" text,
  "authorized_to_work" boolean,
  "requires_sponsorship" boolean,
  "willing_to_relocate" boolean,
  "desired_salary" text,
  "available_start_date" text,
  "skills" text[],
  "summary" text,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "education" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "school" text NOT NULL,
  "degree" text,
  "field_of_study" text,
  "start_date" text,
  "end_date" text,
  "gpa" text,
  "details" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "work_experience" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "company" text NOT NULL,
  "title" text,
  "location" text,
  "start_date" text,
  "end_date" text,
  "is_current" boolean DEFAULT false NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "resumes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "raw_text" text,
  "is_primary" boolean DEFAULT true NOT NULL,
  "parsed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "education_user_idx" ON "education" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "resumes_user_idx" ON "resumes" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "work_experience_user_idx" ON "work_experience" USING btree ("user_id");

-- ── Private Storage bucket for résumé files ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: a signed-in user may only read/write objects whose first path segment
-- equals their auth uid (we store files at `${uid}/${uuid}-${filename}`).
DROP POLICY IF EXISTS "resumes_insert_own" ON storage.objects;
CREATE POLICY "resumes_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "resumes_select_own" ON storage.objects;
CREATE POLICY "resumes_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "resumes_update_own" ON storage.objects;
CREATE POLICY "resumes_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "resumes_delete_own" ON storage.objects;
CREATE POLICY "resumes_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
