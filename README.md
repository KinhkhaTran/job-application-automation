# SWE New-Grad Job Application Automation

This repository is the working scaffold for a personal, human-in-the-loop job application assistant.

## Current status

**First aggregation increment is implemented and pushed.** It includes:

- Next.js App Router + TypeScript scaffold
- Drizzle/Postgres schema for companies, postings, applications, history, and scrape logs
- Configurable three-company test target list using a safe mock adapter
- Adapter interface ready for future Greenhouse, Lever, or Ashby integrations
- Robots.txt checks, per-domain rate limiting, deduplication, new-grad classification, and experience-year flagging
- Status-transition validation
- 67 Jest tests covering the scraper foundations

The original build prompt is preserved in [`BUILD_PROMPT.md`](./BUILD_PROMPT.md).

## Important product constraints

- Automated submission to third-party ATS platforms is explicitly out of scope unless an official submission API is confirmed and the user approves it.
- ATS priorities must be confirmed with the user before implementation decisions are made.
- Scrapers must respect robots.txt, terms of service, and per-domain rate limits.
- Secrets belong in environment variables and must never be committed.

## Planned next increments

1. Dashboard and application pipeline UI
2. Single-user authentication
3. LLM-assisted application packet drafting
4. Vercel Cron deployment wiring and notifications

## Local development

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run build
```

## Database (Supabase or any PostgreSQL)

The app connects through a standard `DATABASE_URL` using [postgres.js](https://github.com/porsager/postgres) — no provider-specific driver. For Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Dashboard → **Connect** → copy a connection string (see `.env.example` for all three formats):
   - **Transaction pooler** (port 6543) for serverless/Vercel — prepared statements are already disabled in the client, so this works out of the box.
   - **Direct connection** (port 5432) for running migrations.
3. Put it in `.env.local` as `DATABASE_URL=...` (never commit it).
4. Apply migrations from `drizzle/`:

```bash
npm run db:generate   # regenerate migrations after schema changes
npm run db:migrate    # apply migrations (use the direct connection string)
```

Without `DATABASE_URL`, the dashboard runs entirely on in-memory sample data — tests and builds need no database.

## Job-listing discovery (`npm run discover`)

Read-only discovery over **explicitly configured** public ATS job-board APIs (Greenhouse, Lever, Ashby — the platforms with official public listing APIs). It ships with an empty source list; add companies to `config/discovery.ts` to opt in, then:

```bash
npm run discover                # fetch all configured sources, JSON on stdout
npm run discover -- --pretty    # indented JSON (logs go to stderr)
npm run discover -- --persist   # also upsert into Postgres (needs DATABASE_URL)
```

Every source run checks robots.txt against the actual endpoint fetched, is rate-limited per domain, validates the external payload, deduplicates across sources, and classifies new-grad fit and required experience years. Per-source errors are isolated and reported in the JSON summary (and in `scrape_logs` when persisting).

## Application review and handoff — safety boundaries

Applying stays **fully manual**. When a packet is prepared, the posting URL is normalized (credentials stripped, tracking parameters removed) and checked against an allowlist (configured careers domains + public ATS apply hosts, HTTPS only, no private hosts).

### Review flow

1. Open a job’s **Review application** panel.
2. Read the exact application URL, match score and reasons, résumé version, cover-letter draft, and every screening answer.
3. Resolve every item marked **Needs your input**. Generated cover letters are always flagged for a human read; judgement questions such as compensation, relocation, referrals, or notice period must be confirmed by you.
4. Click **Approve this packet** only after reviewing the current content. Approval is recorded for that one posting and that exact packet fingerprint.
5. Only after approval, click **Open application**. The server rechecks the fingerprint and allowlist, then returns the URL for you to open in your own browser.
6. Complete the employer’s form yourself, review every field and legal attestation, and submit manually. Mark the posting as submitted afterward.

Editing or regenerating the résumé, cover letter, screening answers, or URL invalidates the previous approval. Approval is **not** submission and never fills, clicks, or sends anything to a third-party ATS. There is no bulk approval path.

Hard boundaries, by design:

- No automated login, account creation, or CAPTCHA interaction anywhere.
- No credential handling: passwords are never read, stored, logged, or sent.
- No automated application submission to Workday, Greenhouse, Lever, Ashby, or any other ATS.
- Discovery only calls official public read-only job-board APIs for sources you explicitly configure.

The project uses Next.js App Router, TypeScript, Drizzle/Postgres, Tailwind CSS, Vercel Cron, and an LLM provider planned for later application-packet drafting. The database provider choice remains a documented follow-up decision.

## Claude Code

Claude Code was used to create the first implementation increment. It is authenticated in the development environment and can continue from `CLAUDE.md`.
