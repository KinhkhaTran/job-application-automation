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

export default function OverviewPage() {
  const now = Date.now();
  const jobs = listJobs();
  const stats = getStats(now);

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
            <h2 className="text-sm font-semibold text-zinc-100">Top matches to review</h2>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200"
            >
              All jobs <ArrowUpRight width={12} height={12} />
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
            <h2 className="text-sm font-semibold text-zinc-100">Recent activity</h2>
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
