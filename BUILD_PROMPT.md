# Build Prompt: SWE New-Grad Job Application Automation Platform

## Project Overview

Build a full-stack web application, deployed on Vercel, that helps automate the process of finding and applying to Software Engineering new-grad job postings. The system should have a scheduled background job that scrapes/aggregates listings and (optionally) auto-fills applications, plus a dashboard where I can review, approve, and track everything.

## Tech Stack

- Framework: Next.js (App Router), deployed on Vercel
- Database: Vercel Postgres or Supabase (pick one and justify it) — needs to store job listings, application status, and logs
- Background jobs: Vercel Cron Jobs (or Vercel Cron + a queue like Upstash QStash if runs need to exceed the serverless timeout)
- Auth: Simple single-user auth (this is a personal tool, not multi-tenant) — NextAuth with a single allow-listed email, or just a password-gated dashboard
- Styling: Tailwind CSS + shadcn/ui components

## Core Features

### 1. Job Aggregation (the "cloud script")

A scheduled serverless function (cron, e.g. every 6 hours) that pulls new-grad SWE listings from:

- Public job APIs where available (Greenhouse, Lever, Ashby job board APIs — these are usually open and scrapeable per-company)
- A curated list of company career pages I specify (start with a config file of ~20 companies)
- Deduplicate against what's already in the database (by URL or company+title+posted-date hash)
- Store: company, title, location, posting URL, source, date found, and a scraped job description
- Tag postings automatically as "new grad" vs not, using keyword matching on title/description (e.g. "new grad," "entry level," "university grad," graduation year mentions), and flag ones that mention required years of experience so I can filter those out

### 2. Application Handling — IMPORTANT SCOPE NOTE

**Do NOT attempt to fully auto-submit applications on third-party sites.** Most ATS platforms (Workday, Greenhouse, etc.) actively detect and block bot submissions, and many company ToS prohibit automated applications — getting flagged can hurt real candidacy. Instead, build a human-in-the-loop flow:

- For each new matching posting, pre-fill an "application packet" (resume version, tailored cover letter draft, answers to common screening questions) using an LLM call, and stage it
- Dashboard shows a queue of "ready to review" applications where I click through to the actual posting and submit manually, then mark it as "Applied" in the dashboard
- Only fully automate application steps for ATS platforms that officially expose a submission API (rare) — flag any such case for me to confirm before wiring it up

### 3. Dashboard

- Pipeline view: kanban-style board — New → Reviewing → Applied → Interviewing → Rejected/Ghosted → Offer
- Job feed: filterable/sortable table of all scraped postings (company, role, location, date, match score)
- Resume/cover letter versions: track which version I sent to which application
- Stats: applications sent per week, response rate, by-company breakdown
- Notification: email or push (via Resend or similar) when high-match new postings appear

### 4. Data Model (starting point — adjust as needed)

- companies (name, careers_url, ats_type)
- postings (company_id, title, url, location, description, posted_date, found_date, is_new_grad, status)
- applications (posting_id, resume_version, cover_letter, submitted_date, status, notes)
- application_history (status change log per application)

## Non-Functional Requirements

- Respect robots.txt and rate-limit scraping per domain
- All secrets (API keys, DB credentials) via Vercel environment variables, never hardcoded
- Include a README with setup steps and how to add new companies to track

## Deliverable Format

Please scaffold this as a working repo: propose the file/folder structure first, then build incrementally — starting with the database schema and cron scraper for 2-3 test companies, then the dashboard UI, then the LLM-assisted application drafting. **Ask me before making assumptions about which ATS platforms to prioritize.**
