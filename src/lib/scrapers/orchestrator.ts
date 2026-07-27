import { classifyPosting } from "./classifier";
import { computeDedupHash } from "./dedup";
import { isUrlAllowed } from "./robots";
import type { RateLimiter } from "./rateLimiter";
import type { AtsAdapter, CompanyTarget, RawPosting } from "./types";

export interface ClassifiedPosting extends RawPosting {
  dedupHash: string;
  isNewGrad: boolean;
  requiredYearsMin: number | null;
}

export interface RunResult {
  companyId: number;
  companyName: string;
  source: string;
  postings: ClassifiedPosting[];
  skippedByRobots: boolean;
  errorMessage?: string;
}

export interface OrchestratorOptions {
  /** Fetch and check robots.txt before scraping. Default: true. */
  checkRobots?: boolean;
  rateLimiter?: RateLimiter;
}

export async function runScraper(
  adapter: AtsAdapter,
  target: CompanyTarget,
  options: OrchestratorOptions = {}
): Promise<RunResult> {
  const { checkRobots = true, rateLimiter } = options;

  if (checkRobots) {
    const allowed = await isUrlAllowed(target.careersUrl);
    if (!allowed) {
      return {
        companyId: target.companyId,
        companyName: target.companyName,
        source: adapter.name,
        postings: [],
        skippedByRobots: true,
      };
    }
  }

  if (rateLimiter) {
    await rateLimiter.throttle(target.careersUrl);
  }

  try {
    const raw = await adapter.fetchPostings(target);
    const postings: ClassifiedPosting[] = raw.map((p) => ({
      ...p,
      dedupHash: computeDedupHash(target.companyId, p.url),
      ...classifyPosting(p.title, p.description),
    }));

    return {
      companyId: target.companyId,
      companyName: target.companyName,
      source: adapter.name,
      postings,
      skippedByRobots: false,
    };
  } catch (err) {
    return {
      companyId: target.companyId,
      companyName: target.companyName,
      source: adapter.name,
      postings: [],
      skippedByRobots: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
