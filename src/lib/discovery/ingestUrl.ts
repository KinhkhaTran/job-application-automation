// Single-URL job ingest.
//
// Given one job URL the user pastes in, fetch it and normalize it into the
// same shape the discovery pipeline produces. This is a READ of a public
// posting page — it never logs in, fills, or submits anything. Two adapters,
// tried in order:
//
//   1. amazon.jobs — its public per-job JSON endpoint (well-structured).
//   2. generic     — JSON-LD JobPosting, then <meta>/<title> as a last resort.
//
// The result is classified (new-grad / years-of-experience) and handed to the
// store to persist. Callers should treat a thrown error as "could not ingest".

import { classifyPosting } from "../scrapers/classifier";

export interface IngestedPosting {
  companyName: string;
  title: string;
  /** The exact URL the user gave us (normalized only for fetching). */
  url: string;
  location: string | null;
  description: string | null;
  postedAt: string | null; // ISO
  source: string; // e.g. "ingest:amazon.jobs"
  isNewGrad: boolean;
  requiredYearsMin: number | null;
}

// A realistic desktop-browser User-Agent. Some career sites (amazon.jobs among
// them) reject non-browser clients with 406/403; this gets past simple checks.
// Sites with real bot protection may still block a server-side fetch — the
// seeded entry and the visible-browser autofill flow cover those cases.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Collapse HTML into readable plain text without pulling in a parser dep. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6])\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchText(url: string, accept?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept:
        accept ??
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

function finalize(
  partial: Omit<IngestedPosting, "isNewGrad" | "requiredYearsMin">
): IngestedPosting {
  const { isNewGrad, requiredYearsMin } = classifyPosting(
    partial.title,
    partial.description
  );
  return { ...partial, isNewGrad, requiredYearsMin };
}

// ── amazon.jobs adapter ────────────────────────────────────────────────────
// amazon.jobs exposes a public JSON document per job at /en/jobs/{id}.json.
// The /apply and localized paths all carry the numeric job id.

function amazonJobId(url: string): string | null {
  const m = url.match(/amazon\.jobs\/[^?]*?\/?jobs\/(\d+)/i);
  return m ? m[1] : null;
}

async function ingestAmazon(url: string): Promise<IngestedPosting | null> {
  const id = amazonJobId(url);
  if (!id) return null;

  const raw = await fetchText(
    `https://www.amazon.jobs/en/jobs/${id}.json`,
    "application/json, text/plain, */*"
  );
  let doc: {
    job?: {
      title?: string;
      description?: string;
      basic_qualifications?: string;
      preferred_qualifications?: string;
      location?: string;
      normalized_location?: string;
      city?: string;
      state?: string;
      posted_date?: string;
      company_name?: string;
    };
  };
  try {
    doc = JSON.parse(raw);
  } catch {
    return null;
  }
  const job = doc.job;
  if (!job?.title) return null;

  const sections = [
    job.description && `${htmlToText(job.description)}`,
    job.basic_qualifications &&
      `\n\nBASIC QUALIFICATIONS\n${htmlToText(job.basic_qualifications)}`,
    job.preferred_qualifications &&
      `\n\nPREFERRED QUALIFICATIONS\n${htmlToText(job.preferred_qualifications)}`,
  ].filter(Boolean);

  const location =
    job.normalized_location ||
    job.location ||
    [job.city, job.state].filter(Boolean).join(", ") ||
    null;

  return finalize({
    companyName: job.company_name || "Amazon",
    title: htmlToText(job.title),
    url,
    location: location ? htmlToText(location) : null,
    description: sections.length ? sections.join("") : null,
    postedAt: job.posted_date ? new Date(job.posted_date).toISOString() : null,
    source: "ingest:amazon.jobs",
  });
}

// ── generic JSON-LD adapter ─────────────────────────────────────────────────

interface JsonLdJobPosting {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string } }
    | Array<{ address?: { addressLocality?: string; addressRegion?: string } }>;
}

function isJobPosting(node: JsonLdJobPosting): boolean {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes("JobPosting") : t === "JobPosting";
}

function extractJsonLd(html: string): JsonLdJobPosting | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const nodes: JsonLdJobPosting[] = Array.isArray(parsed)
      ? (parsed as JsonLdJobPosting[])
      : (parsed as { "@graph"?: JsonLdJobPosting[] })["@graph"] ?? [
          parsed as JsonLdJobPosting,
        ];
    const posting = nodes.find(isJobPosting);
    if (posting) return posting;
  }
  return null;
}

function metaTag(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(re)?.[1] ?? null;
}

function locationFromJsonLd(loc: JsonLdJobPosting["jobLocation"]): string | null {
  const first = Array.isArray(loc) ? loc[0] : loc;
  const addr = first?.address;
  if (!addr) return null;
  return [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ") || null;
}

async function ingestGeneric(url: string): Promise<IngestedPosting> {
  const html = await fetchText(url);
  const ld = extractJsonLd(html);
  const host = new URL(url).hostname.replace(/^www\./, "");

  if (ld?.title) {
    const org =
      typeof ld.hiringOrganization === "string"
        ? ld.hiringOrganization
        : ld.hiringOrganization?.name;
    return finalize({
      companyName: org || host,
      title: htmlToText(ld.title),
      url,
      location: locationFromJsonLd(ld.jobLocation),
      description: ld.description ? htmlToText(ld.description) : null,
      postedAt: ld.datePosted ? new Date(ld.datePosted).toISOString() : null,
      source: `ingest:${host}`,
    });
  }

  const title =
    metaTag(html, "og:title") ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "Untitled posting";
  const description =
    metaTag(html, "og:description") || metaTag(html, "description");

  return finalize({
    companyName: metaTag(html, "og:site_name") || host,
    title: htmlToText(title),
    url,
    location: null,
    description: description ? htmlToText(description) : null,
    postedAt: null,
    source: `ingest:${host}`,
  });
}

/**
 * Fetch a single public job URL and normalize it. amazon.jobs is handled by
 * its JSON endpoint; everything else falls back to JSON-LD then page metadata.
 */
export async function ingestJobUrl(rawUrl: string): Promise<IngestedPosting> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only https job URLs can be ingested.");
  }

  const amazon = await ingestAmazon(url.toString());
  if (amazon) return amazon;

  return ingestGeneric(url.toString());
}
