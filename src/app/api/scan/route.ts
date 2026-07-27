import { NextResponse } from "next/server";
import { runScan } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The aggregation "cloud script": runs the scraper orchestrator over the
// configured company targets and merges new postings into the store. On
// Vercel this is what a Cron Job would invoke on a schedule.
export async function POST() {
  try {
    const { found, added } = await runScan(Date.now());
    return NextResponse.json({ ok: true, found, added });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Scan failed" },
      { status: 500 }
    );
  }
}
