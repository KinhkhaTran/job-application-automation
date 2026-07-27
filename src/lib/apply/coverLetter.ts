import { RESUME } from "@/lib/data/resume";

/**
 * Draft a cover letter for a staged application packet. Pulls the applicant
 * name from the résumé (the single source of truth) so packets stay in sync
 * with the profile. Human stays in the loop — this is a starting draft, never
 * auto-submitted.
 */
export function draftCoverLetter(company: string, role: string): string {
  return `Dear ${company} Hiring Team,

I'm applying for the ${role} role. As a new-grad software engineer, I've shipped full-stack projects end to end — strict-TypeScript React frontends backed by Postgres and tested Node services — and I'm drawn to ${company}'s focus on craft and velocity.

Recently I built a job-application automation platform: a rate-limited scraper with robots.txt compliance, SHA-256 deduplication, and a human-in-the-loop review pipeline, all covered by a Jest suite. I'd bring that same bias toward correctness and polish to your team.

I'd welcome the chance to talk.

Best,
${RESUME.name}`;
}
