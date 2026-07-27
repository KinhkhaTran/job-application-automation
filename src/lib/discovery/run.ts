import { runScraper } from "../scrapers/orchestrator";
import { RateLimiter } from "../scrapers/rateLimiter";
import { AshbyAdapter } from "../scrapers/adapters/ashby";
import { GreenhouseAdapter } from "../scrapers/adapters/greenhouse";
import { LeverAdapter } from "../scrapers/adapters/lever";
import { isValidBoardId } from "../scrapers/adapters/http";
import type { AtsAdapter, CompanyTarget } from "../scrapers/types";
import type {
  DiscoveredPosting,
  DiscoveryAts,
  DiscoveryEvent,
  DiscoveryRunResult,
  DiscoverySource,
  SourceRunSummary,
} from "./types";
import { DISCOVERY_ATS_VALUES } from "./types";

// Read-only job-listing discovery over explicitly configured public ATS
// board endpoints. Reuses the scraper orchestrator, so every source gets:
//   - a robots.txt check against the actual endpoint being fetched
//   - per-domain rate limiting
//   - dedup hashing, new-grad classification, experience-year flagging
// Sources run sequentially to stay gentle on shared ATS API domains.

interface DiscoveryAdapter extends AtsAdapter {
  endpointUrl(target: CompanyTarget): string;
}

const ADAPTERS: Record<DiscoveryAts, () => DiscoveryAdapter> = {
  greenhouse: () => new GreenhouseAdapter(),
  lever: () => new LeverAdapter(),
  ashby: () => new AshbyAdapter(),
};

export interface DiscoveryOptions {
  /** Fetch and check robots.txt for each endpoint. Default: true. */
  checkRobots?: boolean;
  /** Minimum ms between requests to the same domain. Default: 1500. */
  minIntervalMs?: number;
  onEvent?: (event: DiscoveryEvent) => void;
}

export function validateSource(source: DiscoverySource): string | null {
  if (!Number.isInteger(source.companyId) || source.companyId <= 0) {
    return "companyId must be a positive integer";
  }
  if (!source.companyName || typeof source.companyName !== "string") {
    return "companyName is required";
  }
  if (!DISCOVERY_ATS_VALUES.includes(source.ats)) {
    return `ats must be one of: ${DISCOVERY_ATS_VALUES.join(", ")}`;
  }
  if (typeof source.boardId !== "string" || !isValidBoardId(source.boardId)) {
    return "boardId must be a short alphanumeric board handle";
  }
  return null;
}

export async function runDiscovery(
  sources: DiscoverySource[],
  options: DiscoveryOptions = {}
): Promise<DiscoveryRunResult> {
  const { checkRobots = true, minIntervalMs = 1500, onEvent } = options;
  const rateLimiter = new RateLimiter(minIntervalMs);

  const summaries: SourceRunSummary[] = [];
  const postings: DiscoveredPosting[] = [];
  const seenHashes = new Set<string>();
  const seenUrls = new Set<string>();

  for (const source of sources) {
    const invalid = validateSource(source);
    if (invalid) {
      onEvent?.({ type: "source:invalid", companyName: String(source.companyName), reason: invalid });
      summaries.push({
        companyId: source.companyId,
        companyName: String(source.companyName),
        ats: source.ats,
        endpoint: "",
        postingsFound: 0,
        postingsKept: 0,
        duplicatesSkipped: 0,
        skippedByRobots: false,
        errorMessage: `invalid source config: ${invalid}`,
      });
      continue;
    }

    const adapter = ADAPTERS[source.ats]();
    // careersUrl is set to the API endpoint so the orchestrator's robots
    // check and rate limiting apply to the host we actually fetch from.
    const target: CompanyTarget = {
      companyId: source.companyId,
      companyName: source.companyName,
      atsBoardId: source.boardId,
      careersUrl: adapter.endpointUrl({
        companyId: source.companyId,
        companyName: source.companyName,
        atsBoardId: source.boardId,
        careersUrl: source.careersUrl,
      }),
    };

    onEvent?.({ type: "source:start", companyName: source.companyName, ats: source.ats, endpoint: target.careersUrl });

    const result = await runScraper(adapter, target, { checkRobots, rateLimiter });

    let kept = 0;
    let duplicates = 0;
    for (const p of result.postings) {
      if (seenHashes.has(p.dedupHash) || seenUrls.has(p.url)) {
        duplicates += 1;
        continue;
      }
      seenHashes.add(p.dedupHash);
      seenUrls.add(p.url);
      postings.push({ ...p, companyId: source.companyId, companyName: source.companyName });
      kept += 1;
    }

    const summary: SourceRunSummary = {
      companyId: source.companyId,
      companyName: source.companyName,
      ats: source.ats,
      endpoint: target.careersUrl,
      postingsFound: result.postings.length,
      postingsKept: kept,
      duplicatesSkipped: duplicates,
      skippedByRobots: result.skippedByRobots,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    };
    summaries.push(summary);
    onEvent?.({ type: "source:done", summary });
  }

  return {
    sources: summaries,
    postings,
    totals: {
      sources: summaries.length,
      postingsFound: summaries.reduce((n, s) => n + s.postingsFound, 0),
      postingsKept: postings.length,
      duplicatesSkipped: summaries.reduce((n, s) => n + s.duplicatesSkipped, 0),
      sourcesWithErrors: summaries.filter((s) => s.errorMessage).length,
      sourcesSkippedByRobots: summaries.filter((s) => s.skippedByRobots).length,
    },
  };
}
