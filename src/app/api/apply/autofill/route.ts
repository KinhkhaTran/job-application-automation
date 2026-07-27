import { NextResponse } from "next/server";
import { autofillApplication } from "@/lib/autofill";
import { parseOpenRequest, toRawRequest } from "@/lib/apply/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local, human-in-the-loop autofill.
//
// Gated behind the same approval check as the manual "Open posting" handoff.
// On an approved packet it launches a VISIBLE browser on this machine, fills
// the application form from the user's profile, and stops — the user reviews
// and presses Submit themselves. This only makes sense locally, so it refuses
// to run in a serverless/production deployment where no display exists.
export async function POST(req: Request) {
  if (process.env.VERCEL && !process.env.ENABLE_LOCAL_AUTOFILL) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Autofill drives a browser on your own machine and only runs locally. " +
          "Run the app with `npm run dev` and use Autofill there.",
      },
      { status: 400 }
    );
  }

  const parsed = parseOpenRequest(await toRawRequest(req));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: parsed.code, error: parsed.error },
      { status: parsed.status }
    );
  }

  const result = await autofillApplication(
    parsed.value.postingId,
    parsed.value.fingerprint
  );
  const status = result.ok ? 200 : result.code ? 403 : 500;
  return NextResponse.json(result, { status });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method-not-allowed",
      error: "Use POST with a JSON body to run local autofill for an approved packet.",
    },
    { status: 405, headers: { allow: "POST" } }
  );
}
