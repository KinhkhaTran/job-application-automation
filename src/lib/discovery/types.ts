import type { ClassifiedPosting } from "../scrapers/orchestrator";

/** ATS platforms with official, public, read-only job-board APIs. */
export type DiscoveryAts = "greenhouse" | "lever" | "ashby";

export const DISCOVERY_ATS_VALUES: DiscoveryAts[] = ["greenhouse", "lever", "ashby"];

/**
 * An explicitly configured public source to discover job listings from.
 * Discovery is opt-in per company: nothing is fetched unless it is listed
 * in config/discovery.ts.
 */
export interface DiscoverySource {
  /** Stable local id for this company (used in dedup hashing without a DB). */
  companyId: number;
  companyName: string;
  ats: DiscoveryAts;
  /** Board handle, e.g. "vercel" for boards.greenhouse.io/vercel. */
  boardId: string;
  /** Human-facing careers page, kept for reference/allowlisting only. */
  careersUrl: string;
}

/** A discovered posting annotated with its source company. */
export interface DiscoveredPosting extends ClassifiedPosting {
  companyId: number;
  companyName: string;
}

export interface SourceRunSummary {
  companyId: number;
  companyName: string;
  ats: DiscoveryAts;
  endpoint: string;
  postingsFound: number;
  postingsKept: number;
  duplicatesSkipped: number;
  skippedByRobots: boolean;
  errorMessage?: string;
}

export interface DiscoveryRunResult {
  sources: SourceRunSummary[];
  postings: DiscoveredPosting[];
  totals: {
    sources: number;
    postingsFound: number;
    postingsKept: number;
    duplicatesSkipped: number;
    sourcesWithErrors: number;
    sourcesSkippedByRobots: number;
  };
}

/** Observability hook — the CLI logs these to stderr. */
export type DiscoveryEvent =
  | { type: "source:start"; companyName: string; ats: DiscoveryAts; endpoint: string }
  | { type: "source:done"; summary: SourceRunSummary }
  | { type: "source:invalid"; companyName: string; reason: string };
