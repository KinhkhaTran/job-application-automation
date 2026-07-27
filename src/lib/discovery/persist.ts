import { eq } from "drizzle-orm";
import { db, hasDb, companies, postings, scrapeLogs } from "../db";
import { computeDedupHash } from "../scrapers/dedup";
import type { DiscoveryRunResult, DiscoverySource } from "./types";

export interface PersistSummary {
  companiesCreated: number;
  postingsInserted: number;
  postingsAlreadyKnown: number;
}

/**
 * Persist a discovery run through the existing Drizzle schema. Companies are
 * upserted by unique name; postings are deduplicated in the database by the
 * dedup-hash unique index (recomputed against the DB company id, which may
 * differ from the local config id). Each source run is recorded in
 * scrape_logs for observability.
 *
 * Requires DATABASE_URL — callers should check `hasDb` first.
 */
export async function persistDiscovery(
  result: DiscoveryRunResult,
  sources: DiscoverySource[],
  now: Date
): Promise<PersistSummary> {
  if (!hasDb) {
    throw new Error("persistDiscovery called without DATABASE_URL configured");
  }

  const summary: PersistSummary = {
    companiesCreated: 0,
    postingsInserted: 0,
    postingsAlreadyKnown: 0,
  };

  // Resolve (or create) a DB company id per configured source.
  const dbCompanyIds = new Map<number, number>(); // config companyId -> DB id
  for (const source of sources) {
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name, source.companyName))
      .limit(1);
    if (existing.length > 0) {
      dbCompanyIds.set(source.companyId, existing[0].id);
      continue;
    }
    const inserted = await db
      .insert(companies)
      .values({
        name: source.companyName,
        careersUrl: source.careersUrl,
        atsType: source.ats,
        atsBoardId: source.boardId,
      })
      .returning({ id: companies.id });
    dbCompanyIds.set(source.companyId, inserted[0].id);
    summary.companiesCreated += 1;
  }

  for (const posting of result.postings) {
    const dbCompanyId = dbCompanyIds.get(posting.companyId);
    if (dbCompanyId === undefined) continue;

    const inserted = await db
      .insert(postings)
      .values({
        companyId: dbCompanyId,
        title: posting.title,
        url: posting.url,
        location: posting.location,
        description: posting.description,
        postedDate: posting.postedAt ? new Date(posting.postedAt) : null,
        foundDate: now,
        dedupHash: computeDedupHash(dbCompanyId, posting.url),
        isNewGrad: posting.isNewGrad,
        requiredYearsMin: posting.requiredYearsMin,
        source: posting.source,
        rawData: JSON.stringify(posting.rawData),
      })
      .onConflictDoNothing({ target: postings.dedupHash })
      .returning({ id: postings.id });

    if (inserted.length > 0) summary.postingsInserted += 1;
    else summary.postingsAlreadyKnown += 1;
  }

  for (const source of result.sources) {
    const dbCompanyId = dbCompanyIds.get(source.companyId) ?? null;
    await db.insert(scrapeLogs).values({
      companyId: dbCompanyId,
      source: source.ats,
      startedAt: now,
      finishedAt: new Date(),
      postingsFound: source.postingsFound,
      postingsNew: source.postingsKept,
      errorMessage: source.errorMessage ?? null,
    });
  }

  return summary;
}
