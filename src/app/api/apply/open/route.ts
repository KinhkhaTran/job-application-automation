import { NextResponse } from "next/server";
import { openApplication } from "@/lib/data/store";
import { parseOpenRequest, toRawRequest } from "@/lib/apply/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hands the application URL back to the user for an approved packet.
//
// This route RETURNS A URL. It does not fetch it, render it, log into it, fill
// it, or submit it — the user opens it in their own browser and applies
// manually. The URL is returned only when the packet carries a current human
// approval and the URL is still allowlisted.
export async function POST(req: Request) {
  const parsed = parseOpenRequest(await toRawRequest(req));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: parsed.code, error: parsed.error },
      { status: parsed.status }
    );
  }

  const result = await openApplication(parsed.value.postingId, parsed.value.fingerprint);
  // 403 on refusal: the request was well-formed, the gate said no.
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method-not-allowed",
      error: "Use POST with a JSON body to fetch the approved application URL.",
    },
    { status: 405, headers: { allow: "POST" } }
  );
}
