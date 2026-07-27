import { redirect } from "next/navigation";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getFullProfile } from "@/lib/profile/store";
import {
  emptyOnboardingForm,
  onboardingFormFromProfile,
} from "@/lib/profile/form";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

export const metadata = { title: "Set up your profile — Job Autopilot" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!hasSupabaseEnv()) return <ConfigNotice />;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const full = await getFullProfile(user.id);
  const initial = full
    ? onboardingFormFromProfile(full)
    : emptyOnboardingForm(user.email ?? "");

  return (
    <div className="min-h-screen px-6 py-12">
      <header className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-lg font-semibold text-zinc-100">
          Set up your application profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a résumé to auto-fill, then review the common-application details
          we&apos;ll reuse when preparing your packets.
        </p>
      </header>
      <OnboardingForm mode="onboarding" initial={initial} />
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-sm font-semibold text-zinc-100">
        Supabase isn&apos;t configured
      </h1>
      <p className="mt-2 text-xs text-zinc-500">
        Set <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code className="text-zinc-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
        <code className="text-zinc-300">DATABASE_URL</code>, and{" "}
        <code className="text-zinc-300">ANTHROPIC_API_KEY</code> to enable
        accounts, onboarding, and résumé parsing.
      </p>
    </div>
  );
}
