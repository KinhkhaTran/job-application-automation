import { NextResponse } from "next/server";
import { DISCOVERY_SOURCES } from "../../../../../config/discovery";
import { runDiscovery } from "@/lib/discovery/run";
import { persistDiscovery } from "@/lib/discovery/persist";
import { fetchSimplifyListings, persistSimplify } from "@/lib/discovery/simplify";
import { enrichSimplifyDescriptions } from "@/lib/discovery/enrich";
import { hasDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Production feed refresh. Vercel Cron invokes this route daily. It reads the
 * official public ATS APIs (config/discovery.ts) AND the SimplifyJobs New-Grad
 * community feed, then writes normalized results to Supabase. It only reads
 * public listings — it never logs in, creates accounts, fills forms, or
 * submits applications.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL || !hasDb) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 503 }
    );
  }
  if (DISCOVERY_SOURCES.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No discovery sources configured" },
      { status: 503 }
    );
  }

  const startedAt = new Date();
  try {
    const result = await runDiscovery(DISCOVERY_SOURCES, {
      checkRobots: true,
      minIntervalMs: 1500,
    });
    const persisted = await persistDiscovery(result, DISCOVERY_SOURCES, startedAt);

    // SimplifyJobs feed — the high-volume community new-grad source. Isolated
    // so a feed hiccup never fails the official-ATS refresh above.
    let simplify: Awaited<ReturnType<typeof persistSimplify>> | { error: string };
    try {
      const listings = await fetchSimplifyListings();
      simplify = await persistSimplify(listings, startedAt);
    } catch (e) {
      simplify = { error: e instanceof Error ? e.message : "SimplifyJobs refresh failed" };
    }

    // Backfill descriptions for a bounded batch of Simplify postings via the
    // public ATS APIs. Bounded so the run stays within the function budget;
    // the daily cadence chips away at the backlog. Isolated from the rest.
    let enriched: Awaited<ReturnType<typeof enrichSimplifyDescriptions>> | { error: string };
    try {
      enriched = await enrichSimplifyDescriptions({ limit: 200, minIntervalMs: 400 });
    } catch (e) {
      enriched = { error: e instanceof Error ? e.message : "Description enrichment failed" };
    }

    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totals: result.totals,
      persisted,
      simplify,
      enriched,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Feed refresh failed" },
      { status: 500 }
    );
  }
}
