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

// Greenhouse Job Board API — public, documented, read-only:
// https://developers.greenhouse.io/job-board.html
// This adapter only LISTS postings. It never posts, authenticates, or
// interacts with application forms.

export function greenhouseEndpoint(boardId: string): string {
  if (!isValidBoardId(boardId)) {
    throw new Error(`Invalid Greenhouse board id: ${JSON.stringify(boardId)}`);
  }
  return `https://boards-api.greenhouse.io/v1/boards/${boardId}/jobs?content=true`;
}

export class GreenhouseAdapter implements AtsAdapter {
  readonly name = "greenhouse";

  endpointUrl(target: CompanyTarget): string {
    return greenhouseEndpoint(target.atsBoardId);
  }

  async fetchPostings(target: CompanyTarget): Promise<RawPosting[]> {
    const payload = await fetchJson(this.endpointUrl(target));
    if (!isRecord(payload) || !Array.isArray(payload.jobs)) {
      throw new Error(
        `Greenhouse board "${target.atsBoardId}": unexpected payload shape (missing jobs array)`
      );
    }

    const postings: RawPosting[] = [];
    for (const job of payload.jobs) {
      if (!isRecord(job)) continue;
      const externalId = asExternalId(job.id);
      const title = asString(job.title);
      const url = asString(job.absolute_url);
      // Skip entries missing required fields rather than failing the run.
      if (!externalId || !title || !isHttpUrl(url)) continue;

      const location = isRecord(job.location) ? asString(job.location.name) : null;
      postings.push({
        externalId,
        title,
        url,
        location,
        description: asString(job.content),
        postedAt: asIsoDate(job.first_published) ?? asIsoDate(job.updated_at),
        source: this.name,
        rawData: job,
      });
    }
    return postings;
  }
}
