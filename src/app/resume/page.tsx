import Link from "next/link";
import { redirect } from "next/navigation";
import { RESUME } from "@/lib/data/resume";
import { ResumeView } from "@/components/ResumeView";
import { ImportedResumeCard } from "@/components/ImportedResumeCard";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/PageHeader";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getFullProfile } from "@/lib/profile/store";
import { resumeDataFromProfile, primaryResume } from "@/lib/profile/resumeData";

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  // Sample mode (no Supabase configured): show the bundled example résumé.
  if (!hasSupabaseEnv()) {
    return (
      <>
        <PageHeader
          title="Résumé"
          subtitle="Sample résumé — configure Supabase and complete onboarding to show your imported résumé."
          action={<PrintButton />}
        />
        <ResumeView resume={RESUME} />
      </>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const full = await getFullProfile(user.id);

  // Signed in but nothing saved yet — point the user at onboarding/profile
  // rather than showing sample data that isn't theirs.
  if (!full) {
    return (
      <>
        <PageHeader
          title="Résumé"
          subtitle="Import a résumé to populate this page."
        />
        <div className="card mx-auto max-w-3xl p-8 text-center">
          <p className="text-sm text-zinc-400">
            You haven&apos;t imported a résumé yet.
          </p>
          <Link href="/profile" className="btn-primary mt-4 inline-flex">
            Complete your profile
          </Link>
        </div>
      </>
    );
  }

  const resume = resumeDataFromProfile(full);
  const file = primaryResume(full);

  return (
    <>
      <PageHeader
        title="Résumé"
        subtitle="Built from the résumé you imported — this is what gets attached to application packets."
        action={<PrintButton />}
      />
      {file && <ImportedResumeCard resume={file} />}
      <ResumeView resume={resume} />
    </>
  );
}
