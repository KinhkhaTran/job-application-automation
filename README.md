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

The database commands are available after setting the database URL in `.env.local`:

```bash
npm run db:generate
npm run db:migrate
```

The project uses Next.js App Router, TypeScript, Drizzle/Postgres, Tailwind CSS, Vercel Cron, and an LLM provider planned for later application-packet drafting. The database provider choice remains a documented follow-up decision.

## Claude Code

Claude Code was used to create the first implementation increment. It is authenticated in the development environment and can continue from `CLAUDE.md`.
