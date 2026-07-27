"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Sparkles, Spinner, ArrowUpRight, Check, FileText } from "./icons";
import type { JobView } from "@/lib/data/types";
import { cn } from "@/lib/data/format";

type Props = {
  job: JobView;
  variant?: "primary" | "ghost";
  className?: string;
};

/**
 * A small paper-document mock standing in for the résumé file that will be
 * attached to the application — gives the packet a tangible "this is what gets
 * submitted" preview without shipping the full PDF into the client bundle.
 */
function ResumePaper({ version }: { version: string }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-24 w-[74px] flex-col gap-1.5 rounded-md border border-hair bg-white p-2.5 shadow-card">
        <div className="h-1.5 w-8 rounded-full bg-brand-300" />
        <div className="h-1 w-full rounded-full bg-zinc-800" />
        <div className="h-1 w-11/12 rounded-full bg-zinc-800" />
        <div className="h-1 w-9/12 rounded-full bg-zinc-800" />
        <div className="mt-1 h-1 w-6 rounded-full bg-zinc-700" />
        <div className="h-1 w-full rounded-full bg-zinc-800" />
        <div className="h-1 w-10/12 rounded-full bg-zinc-800" />
      </div>
      <span className="absolute -bottom-2 -right-2 rounded bg-brand-500 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-card">
        PDF
      </span>
      <span className="sr-only">{version}</span>
    </div>
  );
}

export function ApplyButton({ job, variant = "primary", className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<JobView | null>(
    job.application ? job : null
  );
  const [error, setError] = useState<string | null>(null);

  const alreadyApplied = ["applied", "interviewing", "offer", "rejected", "ghosted"].includes(
    job.status
  );

  async function prepare() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId: job.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to prepare packet");
      setPrepared(data.job as JobView);
      setOpen(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function markApplied() {
    setMarking(true);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId: job.id, to: "applied" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMarking(false);
    }
  }

  const packet = prepared?.application;

  return (
    <>
      {alreadyApplied ? (
        <span className="chip border-teal-500/30 bg-teal-50 text-teal-700">
          <Check width={13} height={13} /> Submitted
        </span>
      ) : job.application?.status === "ready" ? (
        <button
          onClick={() => (prepared ? setOpen(true) : prepare())}
          className={cn(variant === "ghost" ? "btn-ghost" : "btn-primary", className)}
        >
          Review packet
          <ArrowUpRight width={14} height={14} />
        </button>
      ) : (
        <button
          onClick={prepare}
          disabled={loading}
          className={cn(variant === "ghost" ? "btn-ghost" : "btn-primary", className)}
        >
          {loading ? <Spinner width={14} height={14} /> : <Sparkles width={14} height={14} />}
          {loading ? "Preparing…" : "Apply"}
        </button>
      )}

      {error && !open && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Application packet ready"
        subtitle={`${job.company} · ${job.title}`}
        footer={
          <>
            <span className="mr-auto text-xs text-zinc-500">
              You submit manually — nothing was sent to the ATS.
            </span>
            {packet?.handoff && !packet.handoff.allowed ? (
              <span className="text-xs text-amber-600">
                Link withheld: {packet.handoff.reason}
              </span>
            ) : (
              <a
                href={packet?.handoff?.url ?? job.url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                Open posting <ArrowUpRight width={14} height={14} />
              </a>
            )}
            <button onClick={markApplied} disabled={marking} className="btn-primary">
              {marking ? <Spinner width={14} height={14} /> : <Check width={14} height={14} />}
              Mark as applied
            </button>
          </>
        }
      >
        {packet && (
          <div className="space-y-6">
            {/* What's being submitted — the résumé document, visualized. */}
            <section>
              <h3 className="eyebrow mb-2">Attached résumé</h3>
              <div className="flex items-center gap-4 rounded-xl border border-hair bg-surface2 p-4">
                <ResumePaper version={packet.resumeVersion} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">
                    {packet.resumeVersion}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Tailored to {job.title} · {job.company}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip border-brand-200 bg-brand-50 text-brand-500">
                      <FileText width={12} height={12} /> PDF ready
                    </span>
                    <span className="chip border-hair text-zinc-500">
                      {job.location ?? "Location N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Cover letter, rendered as a document page. */}
            <section>
              <h3 className="eyebrow mb-2">Cover letter draft</h3>
              <div className="rounded-xl border border-hair bg-white shadow-card">
                <div className="flex items-center gap-2 border-b border-hair px-4 py-2">
                  <Sparkles width={13} height={13} className="text-brand-400" />
                  <span className="text-[11px] font-medium text-zinc-500">
                    Generated for this role — edit before you send
                  </span>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-relaxed text-zinc-300">
                  {packet.coverLetter}
                </pre>
              </div>
            </section>

            {/* Screening answers the app will pre-fill. */}
            <section>
              <h3 className="eyebrow mb-2">
                Screening answers · {packet.screeningAnswers.length}
              </h3>
              <dl className="space-y-2.5">
                {packet.screeningAnswers.map((qa) => (
                  <div
                    key={qa.question}
                    className="flex gap-3 rounded-xl border border-hair bg-surface2 p-3.5"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check width={12} height={12} />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs text-zinc-500">{qa.question}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-zinc-100">
                        {qa.answer}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>

            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
