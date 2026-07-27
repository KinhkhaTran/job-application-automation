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

## Job-board scraping (JobSpy)

In addition to the official ATS APIs above, an optional feed pulls from public job boards (**Indeed, Google, ZipRecruiter, Glassdoor** — LinkedIn is intentionally excluded for its aggressive blocking and stricter ToS) via the open-source [JobSpy](https://github.com/speedyapply/JobSpy) library (MIT).

- **`api/jobspy/index.py`** — a stateless Vercel Python Function. Given a search config + a shared secret, it runs JobSpy and returns normalized JSON. It never logs in, fills forms, or submits anything, and touches no database. Deps in `requirements.txt`.
- **`src/lib/discovery/jobspy.ts`** — calls that function, then validates, classifies (same new-grad/experience-year logic as ATS discovery), deduplicates (same SHA-256 `company_id + url` hash), and persists via Drizzle. Companies are upserted by name; postings are stored with `source = "jobspy:<board>"`.
- **`src/app/api/cron/jobspy/route.ts`** — the Vercel Cron entry point (daily; see `vercel.json`), authenticated with `CRON_SECRET`.
- **`config/jobspy.ts`** — the searches, enabled sites, and Indeed country. Edit these to match your target roles.

Setup: set `JOBSPY_SECRET` (and `CRON_SECRET`) in the deployment. The function URL is derived from `VERCEL_URL`; override it with `JOBSPY_FUNCTION_URL` for `vercel dev` or a custom host. Because the scraper runs on Vercel's IPs, high volume can be rate-limited by the boards — keep `resultsWanted`/`hoursOld` modest, or add a proxy.

> **ToS note:** unlike the official ATS APIs, these boards' terms restrict automated scraping. This feed is opt-in and scoped to a personal, single-user job search. Enable only the sources you're comfortable with in `config/jobspy.ts`.

## Add a job by URL

Besides scheduled discovery, you can pull in a single posting from the **Jobs** page → **Add job by URL**. Paste any `https` job link and the app fetches the public page and normalizes it (`POST /api/ingest` → `src/lib/discovery/ingestUrl.ts`):

- **amazon.jobs** is read through its public per-job JSON endpoint (`/en/jobs/{id}.json`).
- Everything else is parsed from a JSON-LD `JobPosting` block, falling back to `og:`/`<meta>` tags.

The posting is classified (new-grad / years-of-experience), deduplicated by URL, and shown in the table. This only **reads** a public page — it never logs in, fills, or submits. The dashboard also ships seeded with one real posting (the amazon.jobs *EFA Network Software Engineer I* role) so there is something to look at before your first scan.

## Application review and handoff — safety boundaries

When a packet is prepared, the posting URL is normalized (credentials stripped, tracking parameters removed) and run through safety-only checks: **any public URL is accepted** — there is no domain allowlist — provided it is HTTPS, carries no embedded credentials, and does not resolve to a private/local host.

### Review flow

1. Open a job’s **Review application** panel.
2. Read the exact application URL, match score and reasons, résumé version, cover-letter draft, and every screening answer.
3. Resolve every item marked **Needs your input**. Generated cover letters are always flagged for a human read; judgement questions such as compensation, relocation, referrals, or notice period must be confirmed by you.
4. Click **Approve this packet** only after reviewing the current content. Approval is recorded for that one posting and that exact packet fingerprint.
5. Only after approval, click **Open application**. The server rechecks the fingerprint and allowlist, then returns the URL for you to open in your own browser.
6. Complete the employer’s form yourself, review every field and legal attestation, and submit manually. Mark the posting as submitted afterward.

Editing or regenerating the résumé, cover letter, screening answers, or URL invalidates the previous approval. Approval is **not** submission. There is no bulk approval path.

### Assisted autofill (local only, stops before submit)

Once a packet is **approved**, the review panel offers **Autofill in browser** (`POST /api/apply/autofill`). Reusing the exact same approval gate as the manual open, it launches a **visible browser on your own machine** (via Playwright), navigates to the approved application URL, and fills the fields it can map from your profile (name, email, phone, location, LinkedIn/GitHub/website, and — if configured — your résumé file). It then **stops and hands the window back to you**: it never locates or clicks Submit. You review every field, complete anything left blank, and submit yourself.

Setup (one time):

```bash
npm i -D playwright        # if not already installed
npm run autofill:install   # downloads the Chromium browser
```

Optional env var (see `.env.example`):

- `AUTOFILL_RESUME_PATH` — absolute path to a résumé file to auto-upload to the first file input on the form.

Notes and caveats:

- Autofill only runs **locally** (`npm run dev`). The endpoint refuses to run in a serverless/production deployment, where there is no browser window (override with `ENABLE_LOCAL_AUTOFILL` only if you know what you are doing).
- Sites still requiring sign-in (e.g. amazon.jobs) will show their login page in the launched window — log in there yourself; the assistant does not handle credentials.
- Driving a third-party site with a browser may conflict with that site's Terms of Service. You are responsible for that call; the risk is on your own account. The assistant deliberately never presses Submit.

Hard boundaries, by design:

- No automated login, account creation, or CAPTCHA interaction anywhere.
- No credential handling: passwords are never read, stored, logged, or sent.
- No automated **submission**: autofill fills fields but never clicks Submit — the human always submits.
- Discovery and ingest read only public listings/pages: official ATS APIs (Greenhouse/Lever/Ashby), opt-in public boards via JobSpy (Indeed/Google/ZipRecruiter/Glassdoor — never LinkedIn), and single URLs you paste in. No listing source logs in, submits, or writes to any third party.

The project uses Next.js App Router, TypeScript, Drizzle/Postgres, Tailwind CSS, Vercel Cron, and an LLM provider planned for later application-packet drafting. The database provider choice remains a documented follow-up decision.

## Claude Code

Claude Code was used to create the first implementation increment. It is authenticated in the development environment and can continue from `CLAUDE.md`.
