import type { AtsAdapter, CompanyTarget, RawPosting } from "../types";
import {
  asExternalId,
  asIsoDate,
  asString,
  fetchJson,
  isHttpUrl,
  isRecord,
  isValidBoardId,
} from "./http";

// Ashby Job Posting API — public, documented, read-only:
// https://developers.ashbyhq.com/docs/public-job-posting-api
// This adapter only LISTS postings. It never posts, authenticates, or
// interacts with application forms.

export function ashbyEndpoint(boardId: string): string {
  if (!isValidBoardId(boardId)) {
    throw new Error(`Invalid Ashby board id: ${JSON.stringify(boardId)}`);
  }
  return `https://api.ashbyhq.com/posting-api/job-board/${boardId}?includeCompensation=false`;
}

export class AshbyAdapter implements AtsAdapter {
  readonly name = "ashby";

  endpointUrl(target: CompanyTarget): string {
    return ashbyEndpoint(target.atsBoardId);
  }

  async fetchPostings(target: CompanyTarget): Promise<RawPosting[]> {
    const payload = await fetchJson(this.endpointUrl(target));
    if (!isRecord(payload) || !Array.isArray(payload.jobs)) {
      throw new Error(
        `Ashby board "${target.atsBoardId}": unexpected payload shape (missing jobs array)`
      );
    }

    const postings: RawPosting[] = [];
    for (const job of payload.jobs) {
      if (!isRecord(job)) continue;
      const externalId = asExternalId(job.id);
      const title = asString(job.title);
      const url = asString(job.jobUrl) ?? asString(job.applyUrl);
      if (!externalId || !title || !isHttpUrl(url)) continue;

      postings.push({
        externalId,
        title,
        url,
        location: asString(job.location),
        description: asString(job.descriptionPlain) ?? asString(job.descriptionHtml),
        postedAt: asIsoDate(job.publishedAt),
        source: this.name,
        rawData: job,
      });
    }
    return postings;
  }
}
