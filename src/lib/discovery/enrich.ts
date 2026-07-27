import { and, eq, isNull } from "drizzle-orm";
import { db, hasDb, postings } from "@/lib/db";
import { RateLimiter } from "@/lib/scrapers/rateLimiter";
import { fetchJson, isRecord, asString } from "@/lib/scrapers/adapters/http";

// ── Description enrichment ─────────────────────────────────────────────────────
// The SimplifyJobs feed carries no job descriptions. When a posting's URL points
// at a public, documented ATS API we already read from (Greenhouse, Lever,
// Ashby), we fetch the description from that same read-only endpoint and store
// it as clean plain text. This never logs in, submits, or touches anything the
// public job-board APIs don't already expose.

/** Supported ATS whose public per-posting content we can read. */
type EnrichAts = "greenhouse" | "lever" | "ashby";

interface EnrichTarget {
  ats: EnrichAts;
  /** Board/site/org handle. */
  handle: string;
  /** Per-posting id within the board. */
  externalId: string;
}

// ── HTML → plain text ─────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&bull;": "•",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m] ?? m);
}

/**
 * Convert (possibly entity-escaped) ATS HTML into readable plain text. Greenhouse
 * returns its `content` HTML entity-escaped, so entities are decoded FIRST, then
 * block tags become line breaks and remaining tags are stripped.
 */
export function htmlToText(input: string): string {
  // Decode once to turn `&lt;p&gt;` into real tags, then a second pass handles
  // entities that live inside the text itself.
  let s = decodeEntities(input);
  s = s
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*li\s*>/gi, "")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

// ── URL → { ats, handle, externalId } ─────────────────────────────────────────

export function detectTarget(rawUrl: string): EnrichTarget | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  // Greenhouse: boards.greenhouse.io/{board}/jobs/{id}
  //             job-boards.greenhouse.io/{board}/jobs/{id}
  //             boards.greenhouse.io/embed/job_app?for={board}&token={id}
  if (host.endsWith("greenhouse.io")) {
    const forBoard = u.searchParams.get("for");
    const token = u.searchParams.get("token");
    if (forBoard && token) {
      return { ats: "greenhouse", handle: forBoard, externalId: token };
    }
    const jobsIdx = parts.indexOf("jobs");
    if (jobsIdx > 0 && parts[jobsIdx + 1]) {
      return { ats: "greenhouse", handle: parts[0], externalId: parts[jobsIdx + 1] };
    }
    return null;
  }

  // Lever: jobs.lever.co/{site}/{id}
  if (host.endsWith("lever.co")) {
    if (parts.length >= 2) {
      return { ats: "lever", handle: parts[0], externalId: parts[1] };
    }
    return null;
  }

  // Ashby: jobs.ashbyhq.com/{org}/{jobId}[/application]
  if (host.endsWith("ashbyhq.com")) {
    if (parts.length >= 2) {
      return { ats: "ashby", handle: parts[0], externalId: parts[1] };
    }
    return null;
  }

  return null;
}

// ── Per-ATS description fetchers ───────────────────────────────────────────────

async function greenhouseDescription(t: EnrichTarget): Promise<string | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    t.handle
  )}/jobs/${encodeURIComponent(t.externalId)}`;
  const payload = await fetchJson(url);
  if (!isRecord(payload)) return null;
  const content = asString(payload.content);
  return content ? htmlToText(content) : null;
}

async function leverDescription(t: EnrichTarget): Promise<string | null> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(
    t.handle
  )}/${encodeURIComponent(t.externalId)}`;
  const payload = await fetchJson(url);
  if (!isRecord(payload)) return null;
  const plain = asString(payload.descriptionPlain);
  if (plain) return plain.trim();
  const html = asString(payload.description);
  return html ? htmlToText(html) : null;
}

// Ashby has no per-posting public endpoint, so the whole org board is fetched
// once and cached; every posting for that org is served from the cache.
const ashbyBoardCache = new Map<string, Map<string, string>>();

async function ashbyBoard(org: string): Promise<Map<string, string>> {
  const cached = ashbyBoardCache.get(org);
  if (cached) return cached;
  const byId = new Map<string, string>();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
    org
  )}?includeCompensation=false`;
  const payload = await fetchJson(url);
  if (isRecord(payload) && Array.isArray(payload.jobs)) {
    for (const job of payload.jobs) {
      if (!isRecord(job)) continue;
      const id = asString(job.id);
      if (!id) continue;
      const plain = asString(job.descriptionPlain);
      const html = asString(job.descriptionHtml);
      const text = plain?.trim() || (html ? htmlToText(html) : null);
      if (text) byId.set(id, text);
    }
  }
  ashbyBoardCache.set(org, byId);
  return byId;
}

async function ashbyDescription(t: EnrichTarget): Promise<string | null> {
  const board = await ashbyBoard(t.handle);
  return board.get(t.externalId) ?? null;
}

async function fetchDescription(t: EnrichTarget): Promise<string | null> {
  switch (t.ats) {
    case "greenhouse":
      return greenhouseDescription(t);
    case "lever":
      return leverDescription(t);
    case "ashby":
      return ashbyDescription(t);
  }
}

/** Host used for rate-limiting each ATS's API. */
const ATS_HOST: Record<EnrichAts, string> = {
  greenhouse: "https://boards-api.greenhouse.io",
  lever: "https://api.lever.co",
  ashby: "https://api.ashbyhq.com",
};

export interface EnrichSummary {
  candidates: number;
  attempted: number;
  enriched: number;
  emptyContent: number;
  unsupported: number;
  errors: number;
  byAts: Record<string, number>;
}

export interface EnrichOptions {
  /** Max postings to enrich in this run (protects function time budgets). */
  limit?: number;
  /** Min ms between requests to the same ATS host. Default 400. */
  minIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Backfill descriptions for Simplify postings that don't have one yet, using
 * the public ATS APIs. Read-only. Requires DATABASE_URL.
 */
export async function enrichSimplifyDescriptions(
  opts: EnrichOptions = {}
): Promise<EnrichSummary> {
  if (!hasDb) throw new Error("enrichSimplifyDescriptions requires DATABASE_URL");
  const { limit = 500, minIntervalMs = 400, onProgress } = opts;

  const rows = await db
    .select({ id: postings.id, url: postings.url })
    .from(postings)
    .where(and(eq(postings.source, "simplify"), isNull(postings.description)))
    .limit(limit);

  const summary: EnrichSummary = {
    candidates: rows.length,
    attempted: 0,
    enriched: 0,
    emptyContent: 0,
    unsupported: 0,
    errors: 0,
    byAts: {},
  };

  const limiter = new RateLimiter(minIntervalMs);
  let done = 0;

  for (const row of rows) {
    const target = detectTarget(row.url);
    if (!target) {
      summary.unsupported += 1;
      done += 1;
      onProgress?.(done, rows.length);
      continue;
    }
    summary.attempted += 1;
    try {
      await limiter.throttle(ATS_HOST[target.ats]);
      const description = await fetchDescription(target);
      if (description) {
        await db
          .update(postings)
          .set({ description, updatedAt: new Date() })
          .where(eq(postings.id, row.id));
        summary.enriched += 1;
        summary.byAts[target.ats] = (summary.byAts[target.ats] ?? 0) + 1;
      } else {
        summary.emptyContent += 1;
      }
    } catch {
      summary.errors += 1;
    }
    done += 1;
    onProgress?.(done, rows.length);
  }

  return summary;
}
