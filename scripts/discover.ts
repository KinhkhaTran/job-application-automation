// Repeatable job-listing discovery CLI.
//
//   npm run discover                 # fetch configured sources, print JSON to stdout
//   npm run discover -- --pretty     # human-indented JSON
//   npm run discover -- --persist    # also upsert results via Drizzle (needs DATABASE_URL)
//   npm run discover -- --no-robots  # skip robots.txt checks (offline testing only)
//
// Reads sources from config/discovery.ts (empty by default — discovery is
// opt-in). Logs go to stderr; stdout is exclusively the JSON result, so the
// output can be piped: `npm run discover -- --pretty > run.json`.
//
// This tool only READS public job-board APIs. It never logs in, creates
// accounts, fills forms, or submits applications anywhere.

import { DISCOVERY_SOURCES } from "../config/discovery";
import { runDiscovery } from "../src/lib/discovery/run";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const persist = argv.includes("--persist");
  const pretty = argv.includes("--pretty");
  const checkRobots = !argv.includes("--no-robots");

  if (DISCOVERY_SOURCES.length === 0) {
    console.error(
      "No discovery sources configured. Add entries to config/discovery.ts first."
    );
    return 1;
  }

  const startedAt = new Date();
  const result = await runDiscovery(DISCOVERY_SOURCES, {
    checkRobots,
    onEvent: (event) => {
      if (event.type === "source:start") {
        console.error(`→ ${event.companyName} [${event.ats}] ${event.endpoint}`);
      } else if (event.type === "source:done") {
        const s = event.summary;
        const status = s.errorMessage
          ? `ERROR: ${s.errorMessage}`
          : s.skippedByRobots
            ? "skipped (robots.txt disallows)"
            : `${s.postingsKept} kept / ${s.postingsFound} found (${s.duplicatesSkipped} duplicates)`;
        console.error(`  ${s.companyName}: ${status}`);
      } else {
        console.error(`  ${event.companyName}: skipped — ${event.reason}`);
      }
    },
  });

  let persistSummary: unknown = null;
  if (persist) {
    if (!process.env.DATABASE_URL) {
      console.error("--persist requires DATABASE_URL to be set; skipping persistence.");
    } else {
      const { persistDiscovery } = await import("../src/lib/discovery/persist");
      persistSummary = await persistDiscovery(result, DISCOVERY_SOURCES, startedAt);
      console.error(
        `Persisted: ${JSON.stringify(persistSummary)}`
      );
    }
  }

  const output = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    ...result,
    persisted: persistSummary,
  };
  process.stdout.write(JSON.stringify(output, null, pretty ? 2 : 0) + "\n");

  return result.totals.sourcesWithErrors > 0 ? 2 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  });
