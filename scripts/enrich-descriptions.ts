// Backfill job descriptions for SimplifyJobs postings that lack one, by reading
// the public Greenhouse / Lever / Ashby APIs their URLs point at.
//
//   DATABASE_URL=... npx tsx scripts/enrich-descriptions.ts [--limit N]
//
// Read-only against the ATS APIs; only writes postings.description locally.

import { enrichSimplifyDescriptions } from "../src/lib/discovery/enrich";
import { hasDb } from "../src/lib/db";

async function main(): Promise<number> {
  if (!hasDb) {
    console.error("DATABASE_URL is not set.");
    return 1;
  }
  const arg = process.argv.indexOf("--limit");
  const limit = arg >= 0 ? Number(process.argv[arg + 1]) : 1000;

  const summary = await enrichSimplifyDescriptions({
    limit,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) {
        process.stderr.write(`\r  ${done}/${total} processed…`);
      }
    },
  });
  process.stderr.write("\n");
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
