import { listJobs } from "@/lib/data/store";
import { JobsTable } from "@/components/JobsTable";
import { ScanButton } from "@/components/ScanButton";
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
        action={<ScanButton />}
      />
      <JobsTable jobs={jobs} now={now} />
    </>
  );
}
