import { NextResponse } from "next/server";
import {
  JOBSPY_SEARCHES,
  JOBSPY_SITES,
  JOBSPY_COUNTRY_INDEED,
} from "../../../../../config/jobspy";
import { fetchJobspyPostings, persistJobspy } from "@/lib/discovery/jobspy";
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
 * JobSpy feed refresh. Vercel Cron invokes this route on a schedule. It calls
 * the stateless Python JobSpy function (api/jobspy/index.py), which scrapes
 * public job boards (Indeed, Google, ZipRecruiter, Glassdoor — never LinkedIn),
 * then classifies/deduplicates/persists the results here in TypeScript. It only
 * reads public listings; it never logs in, fills forms, or submits anything.
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
  if (JOBSPY_SEARCHES.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No JobSpy searches configured" },
      { status: 503 }
    );
  }

  const startedAt = new Date();
  try {
    const found = await fetchJobspyPostings(
      JOBSPY_SEARCHES,
      JOBSPY_SITES,
      JOBSPY_COUNTRY_INDEED
    );
    const persisted = await persistJobspy(found, startedAt);
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      persisted,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "JobSpy refresh failed" },
      { status: 500 }
    );
  }
}
