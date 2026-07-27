import { NextResponse } from "next/server";
import { prepareApplication } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The "cloud script" behind the Apply button. Prepares a staged application
// packet for human review. It NEVER submits to a third-party ATS.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number((body as { postingId?: unknown }).postingId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "postingId (number) required" }, { status: 400 });
  }

  const result = prepareApplication(id, Date.now());
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
