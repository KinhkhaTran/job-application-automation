# Project Instructions for Claude Code

Read `BUILD_PROMPT.md` before making changes.

## Product constraints

- This is a personal, single-user tool.
- Keep application handling human-in-the-loop.
- Never implement automated submission to Workday, Greenhouse, Lever, Ashby, or other third-party ATS sites unless an official submission API is verified and the user explicitly approves it.
- Respect robots.txt, terms of service, and per-domain rate limits.
- Keep all credentials in environment variables; never commit secrets.
- Ask the user before choosing which ATS platforms to prioritize.

## Implementation sequence

1. Propose the file/folder structure and architecture in the response before substantial implementation.
2. Build the database schema and a cron scraper for 2–3 test companies.
3. Build the dashboard UI and application pipeline.
4. Add LLM-assisted application packet drafting.
5. Add tests, README setup instructions, and deployment documentation.

## Engineering expectations

- Use TypeScript with strict mode.
- Add validation for external data and API inputs.
- Make scraper adapters isolated, rate-limited, observable, and easy to extend.
- Add tests for deduplication, new-grad classification, experience-year flagging, and status transitions.
- Run the relevant tests and type checks after changes.
