import { listJobs } from "@/lib/data/store";
import { PipelineBoard } from "@/components/PipelineBoard";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const jobs = await listJobs();

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Move applications through each stage. Transitions are validated."
      />
      <PipelineBoard jobs={jobs} />
    </>
  );
}
