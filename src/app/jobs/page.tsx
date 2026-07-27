import { listJobs } from "@/lib/data/store";
import { JobsTable } from "@/components/JobsTable";
import { ScanButton } from "@/components/ScanButton";
import { AddJobButton } from "@/components/AddJobButton";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await listJobs();
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} postings aggregated from your tracked companies.`}
        action={
          <div className="flex items-center gap-3">
            <AddJobButton />
            <ScanButton />
          </div>
        }
      />
      <JobsTable jobs={jobs} now={now} />
    </>
  );
}
