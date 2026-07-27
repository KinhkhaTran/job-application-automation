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

// Lever Postings API — public, documented, read-only:
// https://github.com/lever/postings-api
// This adapter only LISTS postings. It never posts, authenticates, or
// interacts with application forms.

export function leverEndpoint(boardId: string): string {
  if (!isValidBoardId(boardId)) {
    throw new Error(`Invalid Lever site id: ${JSON.stringify(boardId)}`);
  }
  return `https://api.lever.co/v0/postings/${boardId}?mode=json`;
}

export class LeverAdapter implements AtsAdapter {
  readonly name = "lever";

  endpointUrl(target: CompanyTarget): string {
    return leverEndpoint(target.atsBoardId);
  }

  async fetchPostings(target: CompanyTarget): Promise<RawPosting[]> {
    const payload = await fetchJson(this.endpointUrl(target));
    if (!Array.isArray(payload)) {
      throw new Error(
        `Lever site "${target.atsBoardId}": unexpected payload shape (expected array)`
      );
    }

    const postings: RawPosting[] = [];
    for (const job of payload) {
      if (!isRecord(job)) continue;
      const externalId = asExternalId(job.id);
      const title = asString(job.text);
      const url = asString(job.hostedUrl);
      if (!externalId || !title || !isHttpUrl(url)) continue;

      const location = isRecord(job.categories)
        ? asString(job.categories.location)
        : null;
      postings.push({
        externalId,
        title,
        url,
        location,
        description: asString(job.descriptionPlain) ?? asString(job.description),
        postedAt: asIsoDate(job.createdAt),
        source: this.name,
        rawData: job,
      });
    }
    return postings;
  }
}
