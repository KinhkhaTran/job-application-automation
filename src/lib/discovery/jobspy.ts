import { eq } from "drizzle-orm";
import { db, hasDb, companies, postings, scrapeLogs } from "../db";
import { computeDedupHash } from "../scrapers/dedup";
import { classifyPosting } from "../scrapers/classifier";

// ── JobSpy ingest ────────────────────────────────────────────────────────────
// Pulls public job-board listings from the stateless Python function at
// api/jobspy/index.py, normalizes and classifies them with the SAME logic the
// official-ATS discovery uses (classifier + SHA-256 dedup hash), then persists
// through the existing Drizzle schema. Read-only: nothing is ever submitted.

/** One configured search the JobSpy function runs. */
export interface JobspySearch {
  /** Query text, e.g. "software engineer new grad". */
  search: string;
  /** Human location string, e.g. "United States" or "San Francisco, CA". */
  location: string;
  /** Postings to request per site. */
  resultsWanted: number;
  /** Only postings newer than this many hours. */
  hoursOld: number;
  /** Optional distinct query for Google's job search. Defaults to `search`. */
  googleSearchTerm?: string;
}

/** A raw posting as returned by the Python JobSpy function. */
export interface JobspyPosting {
  site: string | null;
  title: string | null;
  company: string | null;
  companyUrl: string | null;
  location: string | null;
  jobUrl: string | null;
  description: string | null;
  datePosted: string | null;
  isRemote: boolean | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string | null;
  interval: string | null;
  searchTerm: string | null;
}

export interface JobspyIngestSummary {
  postingsFound: number;
  postingsInserted: number;
  postingsAlreadyKnown: number;
  companiesCreated: number;
  invalidSkipped: number;
}

/** Resolve the deployed URL of the Python JobSpy function. */
export function jobspyFunctionUrl(): string | null {
  const explicit = process.env.JOBSPY_FUNCTION_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = process.env.VERCEL_URL;
  if (host) return `https://${host}/api/jobspy`;
  return null;
}

/** Narrow an unknown record from the function into a JobspyPosting. */
export function coercePosting(raw: unknown): JobspyPosting | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    site: str(r.site),
    title: str(r.title),
    company: str(r.company),
    companyUrl: str(r.companyUrl),
    location: str(r.location),
    jobUrl: str(r.jobUrl),
    description: str(r.description),
    datePosted: str(r.datePosted),
    isRemote: typeof r.isRemote === "boolean" ? r.isRemote : null,
    minAmount: num(r.minAmount),
    maxAmount: num(r.maxAmount),
    currency: str(r.currency),
    interval: str(r.interval),
    searchTerm: str(r.searchTerm),
  };
}

/** Call the Python JobSpy function and return validated postings. */
export async function fetchJobspyPostings(
  searches: JobspySearch[],
  sites: readonly string[],
  countryIndeed: string
): Promise<JobspyPosting[]> {
  const url = jobspyFunctionUrl();
  if (!url) {
    throw new Error(
      "JobSpy function URL is not resolvable (set JOBSPY_FUNCTION_URL or run on Vercel)."
    );
  }
  const secret = process.env.JOBSPY_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("JOBSPY_SECRET (or CRON_SECRET) must be set to call the JobSpy function.");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ searches, sites, countryIndeed }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`JobSpy function returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object" || !("postings" in data)) {
    throw new Error("JobSpy function returned an unexpected payload.");
  }
  const rawPostings = (data as { postings: unknown }).postings;
  if (!Array.isArray(rawPostings)) return [];
  return rawPostings
    .map(coercePosting)
    .filter(
      (p): p is JobspyPosting =>
        p !== null && !!p.title && !!p.company && !!p.jobUrl
    );
}

/** Registrable-ish careers URL for a company row, derived from its posting. */
export function companyCareersUrl(p: JobspyPosting): string {
  if (p.companyUrl) return p.companyUrl;
  if (p.jobUrl) {
    try {
      return new URL(p.jobUrl).origin;
    } catch {
      /* fall through */
    }
  }
  return p.jobUrl ?? "";
}

export function salaryBlurb(p: JobspyPosting): string | null {
  if (p.minAmount == null && p.maxAmount == null) return null;
  const cur = p.currency ?? "";
  const parts = [p.minAmount, p.maxAmount].filter((n) => n != null).join("–");
  const interval = p.interval ? `/${p.interval}` : "";
  return `${cur}${parts}${interval}`.trim() || null;
}

/**
 * Persist JobSpy postings through the Drizzle schema. Companies are upserted by
 * name on the fly (JobSpy postings each carry their own company). Postings are
 * deduplicated by the dedup-hash unique index, recomputed against the DB
 * company id so JobSpy and official-ATS postings dedup on the same scheme.
 *
 * Requires DATABASE_URL — callers should check `hasDb` first.
 */
export async function persistJobspy(
  found: JobspyPosting[],
  now: Date
): Promise<JobspyIngestSummary> {
  if (!hasDb) {
    throw new Error("persistJobspy called without DATABASE_URL configured");
  }

  const summary: JobspyIngestSummary = {
    postingsFound: found.length,
    postingsInserted: 0,
    postingsAlreadyKnown: 0,
    companiesCreated: 0,
    invalidSkipped: 0,
  };

  const companyIdByName = new Map<string, number>();

  async function resolveCompany(p: JobspyPosting): Promise<number> {
    const name = p.company as string;
    const cached = companyIdByName.get(name);
    if (cached !== undefined) return cached;

    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name, name))
      .limit(1);
    if (existing.length > 0) {
      companyIdByName.set(name, existing[0].id);
      return existing[0].id;
    }
    const inserted = await db
      .insert(companies)
      .values({
        name,
        careersUrl: companyCareersUrl(p),
        atsType: "custom",
      })
      .returning({ id: companies.id });
    summary.companiesCreated += 1;
    companyIdByName.set(name, inserted[0].id);
    return inserted[0].id;
  }

  for (const p of found) {
    // Validate the external data before touching the DB.
    if (!p.title || !p.company || !p.jobUrl) {
      summary.invalidSkipped += 1;
      continue;
    }
    try {
      new URL(p.jobUrl);
    } catch {
      summary.invalidSkipped += 1;
      continue;
    }

    const companyId = await resolveCompany(p);
    const { isNewGrad, requiredYearsMin } = classifyPosting(p.title, p.description);
    const postedDate = p.datePosted ? new Date(p.datePosted) : null;

    const inserted = await db
      .insert(postings)
      .values({
        companyId,
        title: p.title,
        url: p.jobUrl,
        location: p.location,
        description: p.description,
        postedDate: postedDate && !isNaN(postedDate.getTime()) ? postedDate : null,
        foundDate: now,
        dedupHash: computeDedupHash(companyId, p.jobUrl),
        isNewGrad,
        requiredYearsMin,
        source: `jobspy:${p.site ?? "unknown"}`,
        rawData: JSON.stringify({
          site: p.site,
          searchTerm: p.searchTerm,
          isRemote: p.isRemote,
          salary: salaryBlurb(p),
        }),
      })
      .onConflictDoNothing({ target: postings.dedupHash })
      .returning({ id: postings.id });

    if (inserted.length > 0) summary.postingsInserted += 1;
    else summary.postingsAlreadyKnown += 1;
  }

  await db.insert(scrapeLogs).values({
    companyId: null,
    source: "jobspy",
    startedAt: now,
    finishedAt: new Date(),
    postingsFound: summary.postingsFound,
    postingsNew: summary.postingsInserted,
    errorMessage: null,
  });

  return summary;
}
