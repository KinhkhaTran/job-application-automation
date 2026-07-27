import { RESUME } from "@/lib/data/resume";
import { ResumeView } from "@/components/ResumeView";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function ResumePage() {
  return (
    <>
      <PageHeader
        title="Résumé"
        subtitle="The profile attached to your application packets and shown on your site."
        action={<PrintButton />}
      />
      <ResumeView resume={RESUME} />
    </>
  );
}
