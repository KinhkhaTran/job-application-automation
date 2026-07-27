// Canonical shape for a raw job posting from any ATS adapter.
export interface RawPosting {
  /** External ID from the ATS (used in dedup hash together with source). */
  externalId: string;
  title: string;
  url: string;
  location: string | null;
  description: string | null;
  /** ISO-8601 string or null if the ATS does not expose it. */
  postedAt: string | null;
  /** Original adapter identifier, e.g. "greenhouse", "lever", "mock". */
  source: string;
  /** Verbatim API response preserved for debugging. */
  rawData: Record<string, unknown>;
}

// Per-company config that adapters receive.
export interface CompanyTarget {
  companyId: number;
  companyName: string;
  /** The ATS board identifier, e.g. "stripe" for boards.greenhouse.io/stripe */
  atsBoardId: string;
  careersUrl: string;
}

// Result returned after a single adapter run.
export interface ScrapeResult {
  companyId: number;
  source: string;
  postings: RawPosting[];
  errorMessage?: string;
}

// Every ATS adapter must implement this interface.
export interface AtsAdapter {
  /** Adapter name, used as the `source` field on postings. */
  readonly name: string;
  /** Fetch all open postings for the given company target. */
  fetchPostings(target: CompanyTarget): Promise<RawPosting[]>;
}

// Minimal rate-limiter config attached to adapters that respect it.
export interface RateLimitConfig {
  /** Minimum milliseconds between requests to the same domain. */
  minIntervalMs: number;
  /** Max concurrent in-flight requests per domain. */
  maxConcurrent: number;
}
