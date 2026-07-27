import { NextResponse } from "next/server";
import { generateApplicationCoverLetter } from "@/lib/data/store";
import { parseOpenRequest, toRawRequest } from "@/lib/apply/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// On-demand cover letter drafting.
//
// This is the only endpoint that spends model tokens, so it runs solely when
// the user asks for a draft from the review gate — never automatically for
// every staged posting. It validates the exact { postingId, fingerprint } the
// user was shown, drafts a tailored letter, and re-stages the packet. Because
// the letter lands as a packet edit, the approval is dropped and the packet is
// re-fingerprinted: the fresh draft must be reviewed and approved again.
export async function POST(req: Request) {
  const parsed = parseOpenRequest(await toRawRequest(req));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: parsed.code, error: parsed.error },
      { status: parsed.status }
    );
  }

  const result = await generateApplicationCoverLetter(
    parsed.value.postingId,
    parsed.value.fingerprint,
    Date.now()
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method-not-allowed",
      error: "Use POST with a JSON body to draft a cover letter for a staged packet.",
    },
    { status: 405, headers: { allow: "POST" } }
  );
}
