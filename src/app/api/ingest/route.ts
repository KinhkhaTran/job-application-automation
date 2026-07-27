import { NextResponse } from "next/server";
import { ingestJob } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ingest a single public job URL the user pastes in. This fetches and parses a
// public posting page (see lib/discovery/ingestUrl) — it never logs in, fills,
// or submits anything.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const url = (body as { url?: unknown })?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "Provide an https job URL." },
      { status: 400 }
    );
  }

  const result = await ingestJob(url, Date.now());
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
