import type { JobspySearch } from "../src/lib/discovery/jobspy";

// Sources for the JobSpy scraper (api/jobspy/index.py). These are public job
// boards scraped via the open-source JobSpy library. LinkedIn is intentionally
// EXCLUDED: it blocks aggressively and its ToS is the most restrictive. Keep
// this list to boards that tolerate modest read-only scraping from one IP.
export const JOBSPY_SITES = [
  "indeed",
  "google",
  "zip_recruiter",
  "glassdoor",
] as const;

// Indeed needs a country; the others infer it from `location`.
export const JOBSPY_COUNTRY_INDEED = "USA";

// The searches to run each refresh. Tuned for a new-grad SWE search; edit these
// terms/locations to match your target roles. `hoursOld` keeps each run to
// recent postings so we stay gentle on the boards and avoid re-fetching stale
// listings the dedup index would drop anyway.
export const JOBSPY_SEARCHES: JobspySearch[] = [
  {
    search: "software engineer new grad",
    location: "United States",
    resultsWanted: 40,
    hoursOld: 72,
  },
  {
    search: "entry level software engineer",
    location: "United States",
    resultsWanted: 40,
    hoursOld: 72,
  },
  {
    search: "new grad software engineer",
    location: "San Francisco, CA",
    resultsWanted: 25,
    hoursOld: 72,
  },
];
