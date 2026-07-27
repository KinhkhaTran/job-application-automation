import { NextResponse } from "next/server";
import { DISCOVERY_SOURCES } from "../../../../../config/discovery";
import { runDiscovery } from "@/lib/discovery/run";
import { persistDiscovery } from "@/lib/discovery/persist";
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
 * Production feed refresh. Vercel Cron invokes this route every six hours.
 * It only reads public ATS APIs and writes normalized results to Supabase.
 * It never logs in, creates accounts, fills forms, or submits applications.
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
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totals: result.totals,
      persisted,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Feed refresh failed" },
      { status: 500 }
    );
  }
}
