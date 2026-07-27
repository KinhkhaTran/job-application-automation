import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getFullProfile } from "@/lib/profile/store";
import {
  emptyOnboardingForm,
  onboardingFormFromProfile,
} from "@/lib/profile/form";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

export const metadata = { title: "Profile — Job Autopilot" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!hasSupabaseEnv()) {
    return (
      <p className="text-sm text-zinc-500">
        Supabase isn&apos;t configured — profiles are unavailable in sample mode.
      </p>
    );
  }

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
    <div>
      <PageHeader
        kicker="~/profile"
        title="Your profile"
        subtitle="The common-application details reused when preparing packets. Upload a new résumé to re-parse, or edit any field."
      />
      <OnboardingForm mode="edit" initial={initial} />
    </div>
  );
}
