import { NextResponse } from "next/server";
import { editApplication, prepareApplication } from "@/lib/data/store";
import { parsePrepareRequest, toRawRequest } from "@/lib/apply/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The "cloud script" behind the Apply button. Stages an application packet for
// human review — and never submits to a third-party ATS.
//
// With `edits`, it re-stages the existing packet with the user's changes.
// Either way the packet gets a fresh fingerprint and no approval, so a
// regenerated or edited packet must be reviewed and approved again.
export async function POST(req: Request) {
  const parsed = parsePrepareRequest(await toRawRequest(req));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: parsed.code, error: parsed.error },
      { status: parsed.status }
    );
  }

  const { postingId, edits } = parsed.value;
  const result = edits
    ? await editApplication(postingId, edits, Date.now())
    : await prepareApplication(postingId, Date.now());
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method-not-allowed",
      error: "Use POST with a JSON body to stage an application packet.",
    },
    { status: 405, headers: { allow: "POST" } }
  );
}
