import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseResume } from "@/lib/resume/parse";
import { uploadResume } from "@/lib/resume/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Auth-gated résumé intake: stores the uploaded file in Supabase Storage and
 * returns Claude-extracted structured fields for the user to review. Nothing is
 * submitted anywhere — the parsed data only prefills the onboarding form.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file provided" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File too large (max 8 MB)" },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  const mimeType = file.type || "application/octet-stream";
  const supported =
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    ["application/pdf", "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mimeType);
  if (!supported) {
    return NextResponse.json(
      { ok: false, error: "Unsupported file type. Upload a PDF, DOCX, or TXT." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const storagePath = await uploadResume(user.id, file.name, bytes, mimeType);
    const { parsed, rawText } = await parseResume(bytes, mimeType, file.name);
    return NextResponse.json({
      ok: true,
      parsed,
      resume: {
        fileName: file.name,
        storagePath,
        mimeType,
        sizeBytes: file.size,
        rawText,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Résumé parsing failed" },
      { status: 500 }
    );
  }
}
