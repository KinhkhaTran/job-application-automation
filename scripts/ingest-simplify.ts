// One-off / repeatable SimplifyJobs New-Grad feed ingest.
//
//   DATABASE_URL=... npx tsx scripts/ingest-simplify.ts
//
// Fetches the public SimplifyJobs listings feed and persists active new-grad
// roles into the configured Postgres database. Read-only against the feed;
// nothing is ever submitted anywhere.

import { fetchSimplifyListings, persistSimplify } from "../src/lib/discovery/simplify";
import { hasDb } from "../src/lib/db";

async function main(): Promise<number> {
  if (!hasDb) {
    console.error("DATABASE_URL is not set — nothing to ingest into.");
    return 1;
  }
  console.error("Fetching SimplifyJobs feed…");
  const listings = await fetchSimplifyListings();
  console.error(`Fetched ${listings.length} active listings. Persisting…`);
  const summary = await persistSimplify(listings, new Date());
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
