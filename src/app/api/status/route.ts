import { NextResponse } from "next/server";
import { setStatus } from "@/lib/data/store";
import type { PostingStatus } from "@/lib/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: PostingStatus[] = [
  "new",
  "reviewing",
  "applied",
  "interviewing",
  "rejected",
  "ghosted",
  "offer",
  "skipped",
];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    postingId?: unknown;
    to?: unknown;
  };
  const id = Number(body.postingId);
  const to = body.to as PostingStatus;
  if (!Number.isFinite(id) || !VALID.includes(to)) {
    return NextResponse.json(
      { ok: false, error: "postingId (number) and valid `to` status required" },
      { status: 400 }
    );
  }

  const result = setStatus(id, to, Date.now());
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
