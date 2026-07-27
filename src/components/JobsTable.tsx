"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { MatchScore } from "./MatchScore";
import { ApplyButton } from "./ApplyButton";
import { Search, ChevronRight, ArrowUpRight, MapPin } from "./icons";
import type { JobView } from "@/lib/data/types";
import { cn, relativeTime } from "@/lib/data/format";

type Filter = "all" | "newgrad" | "ready" | "applied";
type Sort = "match" | "recent";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "newgrad", label: "New grad" },
  { key: "ready", label: "Ready to review" },
  { key: "applied", label: "Applied" },
];

export function JobsTable({ jobs, now }: { jobs: JobView[]; now: number }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("match");
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    let out = jobs.filter((j) => {
      const hay = `${j.company} ${j.title} ${j.location ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (filter === "newgrad") return j.isNewGrad;
      if (filter === "ready") return j.status === "reviewing" && j.application?.status === "ready";
      if (filter === "applied")
        return ["applied", "interviewing", "offer", "rejected", "ghosted"].includes(j.status);
      return true;
    });
    out = [...out].sort((a, b) =>
      sort === "match"
        ? b.matchScore - a.matchScore
        : new Date(b.foundDate).getTime() - new Date(a.foundDate).getTime()
    );
    return out;
  }, [jobs, q, filter, sort]);

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hair p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, role, location…"
            className="w-full rounded-lg border border-hair bg-canvas py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-brand-400/50"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-hair bg-canvas p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors",
                filter === f.key
                  ? "bg-slate-900/[0.08] text-brand-300"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-hair bg-canvas px-3 py-2 font-mono text-xs text-zinc-300 outline-none focus:border-brand-400/50"
        >
          <option value="match">Sort: Best match</option>
          <option value="recent">Sort: Most recent</option>
        </select>
      </div>

      {/* Rows */}
      <div className="divide-y divide-hair">
        {rows.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-zinc-500">
            No postings match your filters.
          </div>
        )}
        {rows.map((job) => {
          const isOpen = expanded === job.id;
          return (
            <div key={job.id} className="group">
              <div className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-900/[0.02]">
                <button
                  onClick={() => setExpanded(isOpen ? null : job.id)}
                  className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:text-zinc-300"
                  aria-label="Toggle details"
                >
                  <ChevronRight
                    width={16}
                    height={16}
                    className={cn("transition-transform", isOpen && "rotate-90")}
                  />
                </button>

                <MatchScore score={job.matchScore} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {job.title}
                    </span>
                    {job.isNewGrad && (
                      <span className="chip shrink-0 border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] text-brand-500">
                        New grad
                      </span>
                    )}
                    {job.requiredYearsMin !== null && job.requiredYearsMin >= 3 && (
                      <span className="chip shrink-0 border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                        {job.requiredYearsMin}+ yrs
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-400">{job.company}</span>
                    {job.location && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin width={11} height={11} /> {job.location}
                        </span>
                      </>
                    )}
                    <span className="text-zinc-700">·</span>
                    <span>{relativeTime(job.foundDate, now)}</span>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <StatusBadge status={job.status} />
                </div>

                <div className="shrink-0">
                  <ApplyButton job={job} variant={job.matchScore >= 75 ? "primary" : "ghost"} />
                </div>
              </div>

              {isOpen && (
                <div className="animate-fade-in border-t border-hair bg-canvas/50 px-14 py-4">
                  {job.description ? (
                    <p className="max-h-72 max-w-3xl overflow-auto whitespace-pre-line text-sm leading-relaxed text-zinc-400">
                      {job.description}
                    </p>
                  ) : (
                    <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">
                      This source doesn&apos;t include the description — open the
                      employer&apos;s posting below to read the full role.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                    <span>
                      Source: <span className="text-zinc-300">{job.source}</span>
                    </span>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200"
                    >
                      View original posting <ArrowUpRight width={12} height={12} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
