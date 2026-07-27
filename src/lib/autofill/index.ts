// Autofill orchestration.
//
// Reuses the exact human-review gate (openApplication) that the manual "Open
// posting" flow uses: autofill only runs against a URL that carries a current
// human approval and is still allowlisted. It then fills the form locally and
// hands control back to the user, who submits it themselves.

import { openApplication } from "@/lib/data/store";
import { profileFromResume, buildAutofillFields } from "./fieldMap";
import { runAutofill, type AutofillReport } from "./runner";

export interface AutofillResult {
  ok: boolean;
  report?: AutofillReport;
  error?: string;
  /** Set when the review gate refused (mirrors openApplication codes). */
  code?: string;
}

export async function autofillApplication(
  postingId: number,
  fingerprint: string
): Promise<AutofillResult> {
  // Same gate as the manual open: approval + allowlist re-check. No network.
  const gate = await openApplication(postingId, fingerprint);
  if (!gate.ok || !gate.url) {
    return { ok: false, error: gate.error, code: gate.code };
  }

  const fields = buildAutofillFields(profileFromResume());
  const resumePath = process.env.AUTOFILL_RESUME_PATH || null;

  try {
    const report = await runAutofill({ url: gate.url, fields, resumePath });
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Autofill failed" };
  }
}
