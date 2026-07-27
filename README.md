# SWE New-Grad Job Application Automation

This repository is the working scaffold for a personal, human-in-the-loop job application assistant.

## Current status

- The original build prompt is preserved in [`BUILD_PROMPT.md`](./BUILD_PROMPT.md).
- The implementation should be built incrementally: schema and scraper first, dashboard second, LLM-assisted application packets third.
- Automated submission to third-party ATS platforms is explicitly out of scope unless an official submission API is confirmed and the user approves it.
- ATS priorities must be confirmed with the user before implementation decisions are made.

## Planned stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase or Vercel Postgres (justify the choice), Vercel Cron, and an LLM provider for drafting application packets.

## Human assistance currently needed

Claude Code is installed locally but needs an authenticated Claude account before it can scaffold the application. Run:

```bash
claude auth login
```

Then ask Claude Code to read `BUILD_PROMPT.md` and begin by proposing the file/folder structure and database/scraper plan. Do not implement ATS submission automation.
