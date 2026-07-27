import { NextResponse } from "next/server";
import { fetchSimplifyListings, persistSimplify } from "@/lib/discovery/simplify";
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
 * Standalone SimplifyJobs New-Grad feed refresh. Not wired into vercel.json
 * crons (the daily /api/cron/discover run already pulls this feed, and the
 * Hobby plan caps cron jobs) — it exists so the feed can be refreshed on
 * demand. Read-only: it only fetches the public listings file and normalizes
 * it into Supabase; nothing is ever submitted.
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

  const startedAt = new Date();
  try {
    const listings = await fetchSimplifyListings();
    const persisted = await persistSimplify(listings, startedAt);
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      persisted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "SimplifyJobs refresh failed",
      },
      { status: 500 }
    );
  }
}
