import Link from "next/link";
import { listJobs, getStats } from "@/lib/data/store";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MatchScore } from "@/components/MatchScore";
import { ApplyButton } from "@/components/ApplyButton";
import { ScanButton } from "@/components/ScanButton";
import { PageHeader } from "@/components/PageHeader";
import { Briefcase, Sparkles, Check, ArrowUpRight } from "@/components/icons";
import { relativeTime } from "@/lib/data/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const now = Date.now();
  const jobs = await listJobs();
  const stats = await getStats(now);

  const topMatches = jobs
    .filter((j) => j.status === "new" || j.status === "reviewing")
    .slice(0, 5);

  const recent = [...jobs]
    .filter((j) => j.application?.submittedDate || j.status !== "new")
    .sort(
      (a, b) =>
        new Date(b.application?.submittedDate ?? b.foundDate).getTime() -
        new Date(a.application?.submittedDate ?? a.foundDate).getTime()
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Your new-grad SWE search at a glance."
        action={<ScanButton />}
      />

      {/* Build-status readout — the whole search condensed to one log line. */}
      <div className="card mb-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 font-mono text-xs">
        <span className="flex items-center gap-2 text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-signal" />
          searching
        </span>
        <Readout label="tracked" value={stats.totalPostings} />
        <Readout label="new-grad" value={stats.newGrad} />
        <Readout label="staged" value={stats.readyToApply} accent />
        <Readout label="submitted" value={stats.applied + stats.interviewing + stats.offers} />
        <span className="ml-auto text-zinc-500">
          <span className="text-emerald-600">+{stats.appliedThisWeek}</span> this week
        </span>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Postings tracked"
          value={stats.totalPostings}
          hint={`${stats.newGrad} tagged new-grad`}
          icon={<Briefcase width={16} height={16} />}
        />
        <StatCard
          label="Ready to review"
          value={stats.readyToApply}
          hint="packets prepared"
          accent
          icon={<Sparkles width={16} height={16} />}
        />
        <StatCard
          label="Applied"
          value={stats.applied + stats.interviewing + stats.offers}
          hint={`${stats.appliedThisWeek} this week`}
          icon={<Check width={16} height={16} />}
        />
        <StatCard
          label="Interviews · Offers"
          value={`${stats.interviewing} · ${stats.offers}`}
          hint="in progress"
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Top matches */}
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <h2 className="eyebrow text-zinc-300">Top matches to review</h2>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 font-mono text-xs text-brand-400 hover:text-brand-300"
            >
              all jobs <ArrowUpRight width={12} height={12} />
            </Link>
          </div>
          <div className="divide-y divide-hair">
            {topMatches.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                Nothing to review — run a scan to pull new postings.
              </p>
            )}
            {topMatches.map((job) => (
              <div key={job.id} className="flex items-center gap-3 px-5 py-3.5">
                <MatchScore score={job.matchScore} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{job.title}</p>
                  <p className="text-xs text-zinc-500">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ""}
                  </p>
                </div>
                <ApplyButton job={job} variant={job.matchScore >= 75 ? "primary" : "ghost"} />
              </div>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section className="card lg:col-span-2">
          <div className="border-b border-hair px-5 py-4">
            <h2 className="eyebrow text-zinc-300">Recent activity</h2>
          </div>
          <ul className="divide-y divide-hair">
            {recent.map((job) => (
              <li key={job.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{job.title}</p>
                  <p className="text-xs text-zinc-500">
                    {job.company} ·{" "}
                    {relativeTime(job.application?.submittedDate ?? job.foundDate, now)}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Readout({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-zinc-600">{label}</span>
      <span className={accent ? "font-semibold text-brand-400" : "font-semibold text-zinc-200"}>
        {value}
      </span>
    </span>
  );
}
