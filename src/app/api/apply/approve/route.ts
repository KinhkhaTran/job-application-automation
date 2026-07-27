import { NextResponse } from "next/server";
import { approveApplication } from "@/lib/data/store";
import { parseApprovalRequest, toRawRequest } from "@/lib/apply/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records that a human reviewed one specific application packet.
//
// Approval is NOT submission. Nothing here contacts the ATS: no login, no form
// fill, no upload, no submit. The only effect is an approval row referencing
// the packet's fingerprint and URL, which later unlocks the manual-open route.
//
// POST with a JSON body only — query parameters are rejected, and there is no
// bulk form, so every approval is one deliberate act per posting.
export async function POST(req: Request) {
  const parsed = parseApprovalRequest(await toRawRequest(req));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: parsed.code, error: parsed.error },
      { status: parsed.status }
    );
  }

  const { postingId, fingerprint, url } = parsed.value;
  const result = await approveApplication(postingId, { fingerprint, url }, Date.now());
  if (!result.ok) {
    // 404 when the posting does not exist; 409 when the gate refused because
    // the packet changed, is not ready, or is no longer allowlisted.
    return NextResponse.json(result, {
      status: result.code === "not-found" ? 404 : 409,
    });
  }
  return NextResponse.json({
    ...result,
    notice: "Approval recorded. You still submit the application yourself.",
  });
}

/** Approval is never reachable by navigation, prefetch, or a link. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method-not-allowed",
      error: "Use POST with a JSON body to approve a reviewed packet.",
    },
    { status: 405, headers: { allow: "POST" } }
  );
}
