"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getValidNextStatuses } from "@/lib/scrapers/statusTransitions";
import { STATUS_META } from "./StatusBadge";
import { MatchScore } from "./MatchScore";
import { Spinner, ArrowUpRight } from "./icons";
import type { JobView, PostingStatus } from "@/lib/data/types";
import { cn } from "@/lib/data/format";

const COLUMNS: { status: PostingStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "reviewing", label: "Reviewing" },
  { status: "applied", label: "Applied" },
  { status: "interviewing", label: "Interviewing" },
  { status: "offer", label: "Offer" },
];

const CLOSED: PostingStatus[] = ["rejected", "ghosted", "skipped"];

export function PipelineBoard({ jobs }: { jobs: JobView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function move(job: JobView, to: PostingStatus) {
    setBusy(job.id);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId: job.id, to }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const closed = jobs.filter((j) => CLOSED.includes(j.status));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = jobs.filter((j) => j.status === col.status);
          return (
            <div key={col.status} className="flex flex-col rounded-2xl border border-hair bg-surface/50">
              <div className="flex items-center justify-between border-b border-hair px-3.5 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_META[col.status].dot)} />
                  {col.label}
                </span>
                <span className="num rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                {items.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-zinc-600">Empty</p>
                )}
                {items.map((job) => (
                  <Card key={job.id} job={job} busy={busy === job.id} onMove={move} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {closed.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Closed
          </h3>
          <div className="flex flex-wrap gap-2">
            {closed.map((job) => (
              <span
                key={job.id}
                className="chip border-hair text-zinc-500"
                title={STATUS_META[job.status].label}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[job.status].dot)} />
                {job.company} · {job.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  job,
  busy,
  onMove,
}: {
  job: JobView;
  busy: boolean;
  onMove: (job: JobView, to: PostingStatus) => void;
}) {
  const next = getValidNextStatuses(job.status).filter((s) => !CLOSED.includes(s) || s !== "skipped");
  return (
    <div className="animate-fade-in rounded-xl border border-hair bg-surface2 p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{job.title}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{job.company}</p>
        </div>
        <MatchScore score={job.matchScore} />
      </div>

      {job.application?.resumeVersion && (
        <p className="mt-2 truncate text-[11px] text-zinc-500">
          Résumé · {job.application.resumeVersion}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Spinner width={12} height={12} /> Updating…
          </span>
        ) : (
          next.map((to) => (
            <button
              key={to}
              onClick={() => onMove(job, to)}
              className="rounded-lg border border-hair bg-white/[0.02] px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-brand-400/40 hover:text-brand-200"
            >
              → {STATUS_META[to].label}
            </button>
          ))
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-zinc-600 transition-colors hover:text-brand-300"
          aria-label="Open posting"
        >
          <ArrowUpRight width={14} height={14} />
        </a>
      </div>
    </div>
  );
}
