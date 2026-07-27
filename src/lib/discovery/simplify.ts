import { eq, inArray } from "drizzle-orm";
import { db, hasDb, companies, postings, scrapeLogs } from "../db";
import { computeDedupHash } from "../scrapers/dedup";
import { classifyPosting } from "../scrapers/classifier";

// ── SimplifyJobs / New-Grad-Positions ingest ──────────────────────────────────
// Pulls the community-maintained new-grad listings that the SimplifyJobs repo
// publishes as a single structured JSON file. It is a public data feed meant
// for consumption (the same file powers the repo's own README table), so we
// fetch the raw file directly instead of cloning. Read-only: nothing is ever
// submitted — every posting links out to the employer's own application page,
// which the user opens themselves.
//
// Repo:  https://github.com/SimplifyJobs/New-Grad-Positions
// Feed:  .github/scripts/listings.json on the `dev` branch.

export const SIMPLIFY_FEED_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json";

const USER_AGENT =
  "job-automation-bot (personal job search; human-in-the-loop)";
const TIMEOUT_MS = 20_000;
// The listings file is a few MB; guard against anything wildly larger.
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;

/** One listing as published in the SimplifyJobs feed. */
export interface SimplifyListing {
  id: string;
  companyName: string;
  title: string;
  url: string;
  locations: string[];
  category: string | null;
  sponsorship: string | null;
  companyUrl: string | null;
  datePosted: number | null;
}

export interface SimplifyIngestSummary {
  postingsFound: number;
  postingsInserted: number;
  postingsAlreadyKnown: number;
  companiesCreated: number;
  invalidSkipped: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** True when the URL parses and uses http(s). */
function isHttpUrl(v: string | null): v is string {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Narrow one untrusted record from the feed into a SimplifyListing, keeping
 * only ACTIVE and VISIBLE new-grad roles with a usable application URL.
 */
export function coerceListing(raw: unknown): SimplifyListing | null {
  if (!isRecord(raw)) return null;
  // Only surface roles the repo currently considers live.
  if (raw.active !== true || raw.is_visible !== true) return null;

  const companyName = str(raw.company_name);
  const title = str(raw.title);
  const url = str(raw.url);
  const id = str(raw.id);
  if (!companyName || !title || !isHttpUrl(url) || !id) return null;

  const locations = Array.isArray(raw.locations)
    ? raw.locations.filter((l): l is string => typeof l === "string" && l.trim() !== "")
    : [];

  return {
    id,
    companyName,
    title,
    url,
    locations,
    category: str(raw.category),
    sponsorship: str(raw.sponsorship),
    companyUrl: str(raw.company_url),
    datePosted:
      typeof raw.date_posted === "number" && Number.isFinite(raw.date_posted)
        ? raw.date_posted
        : null,
  };
}

/** Fetch the SimplifyJobs feed and return validated, active listings. */
export async function fetchSimplifyListings(
  feedUrl: string = SIMPLIFY_FEED_URL
): Promise<SimplifyListing[]> {
  const resp = await fetch(feedUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  if (!resp.ok) {
    throw new Error(`SimplifyJobs feed returned HTTP ${resp.status}`);
  }
  const text = await resp.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`SimplifyJobs feed exceeds ${MAX_RESPONSE_BYTES} bytes`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("SimplifyJobs feed is not valid JSON");
  }
  if (!Array.isArray(data)) {
    throw new Error("SimplifyJobs feed is not a JSON array");
  }
  return data
    .map(coerceListing)
    .filter((l): l is SimplifyListing => l !== null);
}

/** "Cupertino, CA; Remote" — a single display string from the locations array. */
export function locationLabel(listing: SimplifyListing): string | null {
  return listing.locations.length > 0 ? listing.locations.join("; ") : null;
}

/**
 * Persist SimplifyJobs listings through the Drizzle schema. Companies are
 * upserted by name; postings are deduplicated by the dedup-hash unique index.
 * Because the feed carries ~thousands of roles, companies and postings are
 * resolved and written in batches rather than one round-trip per row.
 *
 * Every role here comes from a curated new-grad board, so `isNewGrad` is set
 * true; the experience-year classifier still runs on the title to flag any
 * senior mislabels.
 *
 * Requires DATABASE_URL — callers should check `hasDb` first.
 */
export async function persistSimplify(
  found: SimplifyListing[],
  now: Date
): Promise<SimplifyIngestSummary> {
  if (!hasDb) {
    throw new Error("persistSimplify called without DATABASE_URL configured");
  }

  const summary: SimplifyIngestSummary = {
    postingsFound: found.length,
    postingsInserted: 0,
    postingsAlreadyKnown: 0,
    companiesCreated: 0,
    invalidSkipped: 0,
  };

  // ── 1. Resolve every company name to an id in as few queries as possible ──
  const uniqueNames = Array.from(new Set(found.map((l) => l.companyName)));
  const idByName = new Map<string, number>();

  for (const chunk of batches(uniqueNames, 200)) {
    const rows = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(inArray(companies.name, chunk));
    for (const r of rows) idByName.set(r.name, r.id);
  }

  const missing = uniqueNames.filter((n) => !idByName.has(n));
  // A company's careers URL is best-effort: prefer its Simplify company page,
  // else the origin of one of its postings.
  const careersUrlByName = new Map<string, string>();
  for (const l of found) {
    if (careersUrlByName.has(l.companyName)) continue;
    careersUrlByName.set(l.companyName, companyCareersUrl(l));
  }
  for (const chunk of batches(missing, 200)) {
    if (chunk.length === 0) continue;
    const inserted = await db
      .insert(companies)
      .values(
        chunk.map((name) => ({
          name,
          careersUrl: careersUrlByName.get(name) ?? "",
          atsType: "custom" as const,
        }))
      )
      .onConflictDoNothing({ target: companies.name })
      .returning({ id: companies.id, name: companies.name });
    for (const r of inserted) {
      idByName.set(r.name, r.id);
      summary.companiesCreated += 1;
    }
  }
  // Any names that collided on insert (race) still need their id.
  const stillMissing = uniqueNames.filter((n) => !idByName.has(n));
  for (const chunk of batches(stillMissing, 200)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(inArray(companies.name, chunk));
    for (const r of rows) idByName.set(r.name, r.id);
  }

  // ── 2. Build posting rows, de-duplicating by dedup hash within the feed ──
  const seen = new Set<string>();
  const rows: (typeof postings.$inferInsert)[] = [];
  for (const l of found) {
    const companyId = idByName.get(l.companyName);
    if (companyId === undefined) {
      summary.invalidSkipped += 1;
      continue;
    }
    const dedupHash = computeDedupHash(companyId, l.url);
    if (seen.has(dedupHash)) continue;
    seen.add(dedupHash);

    const { requiredYearsMin } = classifyPosting(l.title, null);
    const postedDate = l.datePosted ? new Date(l.datePosted * 1000) : null;

    rows.push({
      companyId,
      title: l.title,
      url: l.url,
      location: locationLabel(l),
      description: null,
      postedDate: postedDate && !isNaN(postedDate.getTime()) ? postedDate : null,
      foundDate: now,
      dedupHash,
      isNewGrad: true,
      requiredYearsMin,
      source: "simplify",
      rawData: JSON.stringify({
        simplifyId: l.id,
        category: l.category,
        sponsorship: l.sponsorship,
      }),
    });
  }

  // ── 3. Insert postings in batches; the unique index dedups against the DB ──
  for (const chunk of batches(rows, 500)) {
    if (chunk.length === 0) continue;
    const inserted = await db
      .insert(postings)
      .values(chunk)
      .onConflictDoNothing({ target: postings.dedupHash })
      .returning({ id: postings.id });
    summary.postingsInserted += inserted.length;
  }
  summary.postingsAlreadyKnown =
    summary.postingsFound - summary.postingsInserted - summary.invalidSkipped;

  await db.insert(scrapeLogs).values({
    companyId: null,
    source: "simplify",
    startedAt: now,
    finishedAt: new Date(),
    postingsFound: summary.postingsFound,
    postingsNew: summary.postingsInserted,
    errorMessage: null,
  });

  return summary;
}

/** Best-effort careers URL for a company row derived from one of its listings. */
export function companyCareersUrl(listing: SimplifyListing): string {
  if (listing.companyUrl) return listing.companyUrl;
  try {
    return new URL(listing.url).origin;
  } catch {
    return listing.url;
  }
}

/** Split an array into fixed-size chunks. */
function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
