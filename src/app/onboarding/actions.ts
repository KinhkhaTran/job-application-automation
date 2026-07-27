"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingInputSchema } from "@/lib/profile/schema";
import { saveProfile } from "@/lib/profile/store";

export interface SaveState {
  ok: boolean;
  error?: string;
}

/**
 * Persists the onboarding/profile form. The client serializes the whole form
 * as a JSON `payload` field (the form has nested arrays that don't map cleanly
 * to flat FormData). Validates with Zod, writes the profile, flags onboarding
 * complete in both the DB and the Supabase user metadata (the latter is what
 * middleware reads), then redirects home.
 */
export async function saveOnboarding(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, error: "Missing form data" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid form data" };
  }

  const parsed = OnboardingInputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form fields.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    await saveProfile(user.id, parsed.data, Date.now());
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }

  redirect("/");
}
