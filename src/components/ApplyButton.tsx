"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Sparkles, Spinner, ArrowUpRight, Check } from "./icons";
import type { JobView } from "@/lib/data/types";
import { cn } from "@/lib/data/format";

type Props = {
  job: JobView;
  variant?: "primary" | "ghost";
  className?: string;
};

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
        <span className="chip border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
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

      {error && !open && <p className="mt-1 text-xs text-rose-400">{error}</p>}

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
              <span className="text-xs text-amber-400">
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
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className="chip border-brand-400/25 bg-brand-500/10 text-brand-200">
                Résumé · {packet.resumeVersion}
              </span>
              <span className="chip border-hair text-zinc-400">
                {job.location ?? "Location N/A"}
              </span>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Cover letter draft
              </h3>
              <pre className="whitespace-pre-wrap rounded-xl border border-hair bg-canvas p-4 font-sans text-sm leading-relaxed text-zinc-300">
                {packet.coverLetter}
              </pre>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Screening answers
              </h3>
              <dl className="space-y-2.5">
                {packet.screeningAnswers.map((qa) => (
                  <div key={qa.question} className="rounded-xl border border-hair bg-canvas p-3">
                    <dt className="text-xs text-zinc-500">{qa.question}</dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">{qa.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
