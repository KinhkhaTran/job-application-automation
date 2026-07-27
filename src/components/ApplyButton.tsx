"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Sparkles, Spinner, ArrowUpRight, Check, X } from "./icons";
import type { JobView } from "@/lib/data/types";
import type { AutofillReport } from "@/lib/autofill/runner";
import { approvalState } from "@/lib/apply/approval";
import { scoreJobDetailed } from "@/lib/data/scoring";
import { cn } from "@/lib/data/format";

type Props = {
  job: JobView;
  variant?: "primary" | "ghost";
  className?: string;
};

/**
 * The manual review gate, in the UI.
 *
 * The reviewer sees the exact URL, the score and why, the cover letter, the
 * screening answers, and every field that still needs their input. "Approve"
 * records that review against a fingerprint of this exact packet; only then
 * does the open button unlock, and all it does is hand back the URL to open in
 * their own browser. Nothing here submits an application.
 */
export function ApplyButton({ job, variant = "primary", className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AutofillReport | null>(null);
  const [marking, setMarking] = useState(false);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<JobView | null>(
    job.application ? job : null
  );
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadyApplied = ["applied", "interviewing", "offer", "rejected", "ghosted"].includes(
    job.status
  );

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function prepare() {
    setLoading(true);
    setError(null);
    setOpenedUrl(null);
    try {
      const data = await post("/api/apply", { postingId: job.id });
      setPrepared(data.job as JobView);
      setOpen(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const packet = prepared?.application;
  const state = packet ? approvalState(packet) : "unapproved";
  const applyUrl = packet?.handoff?.url ?? null;
  const urlAllowed = packet?.handoff?.allowed === true;
  const breakdown = scoreJobDetailed({
    title: job.title,
    isNewGrad: job.isNewGrad,
    requiredYearsMin: job.requiredYearsMin,
  });
  const needsInput = packet?.provenance.filter((p) => p.needsUserInput) ?? [];

  async function approve() {
    if (!packet || !applyUrl) return;
    setApproving(true);
    setError(null);
    try {
      // Echo back the exact fingerprint and URL displayed above: if the packet
      // changed since it was rendered, the server refuses this approval.
      const data = await post("/api/apply/approve", {
        postingId: job.id,
        fingerprint: packet.fingerprint,
        url: applyUrl,
      });
      setPrepared(data.job as JobView);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval was refused");
    } finally {
      setApproving(false);
    }
  }

  async function openPosting() {
    if (!packet) return;
    setOpening(true);
    setError(null);
    try {
      // The server returns a URL and nothing else; opening it is the browser's
      // job, and submitting the application is yours.
      const data = await post("/api/apply/open", {
        postingId: job.id,
        fingerprint: packet.fingerprint,
      });
      setOpenedUrl(data.url as string);
      window.open(data.url as string, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff was refused");
    } finally {
      setOpening(false);
    }
  }

  async function autofill() {
    if (!packet) return;
    setAutofilling(true);
    setError(null);
    setReport(null);
    try {
      // Same approval gate as "Open posting"; the server then drives a browser
      // on this machine, fills the form, and stops before submit.
      const data = await post("/api/apply/autofill", {
        postingId: job.id,
        fingerprint: packet.fingerprint,
      });
      setReport(data.report as AutofillReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autofill was refused");
    } finally {
      setAutofilling(false);
    }
  }

  async function generateCoverLetter() {
    if (!packet) return;
    setGenerating(true);
    setError(null);
    try {
      // Spends model tokens, so it only runs on this explicit click. Drafting
      // re-stages the packet, which drops any approval — the user re-approves.
      const data = await post("/api/apply/cover-letter", {
        postingId: job.id,
        fingerprint: packet.fingerprint,
      });
      setPrepared(data.job as JobView);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cover letter drafting failed");
    } finally {
      setGenerating(false);
    }
  }

  async function markApplied() {
    setMarking(true);
    try {
      await post("/api/status", { postingId: job.id, to: "applied" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMarking(false);
    }
  }

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
        title="Review this application packet"
        subtitle={`${job.company} · ${job.title}`}
        footer={
          <>
            <span className="mr-auto text-xs text-zinc-500">
              Approving records your review. It does not submit anything —{" "}
              <span className="text-zinc-400">you submit manually.</span>
            </span>
            {state === "approved" ? (
              <span className="chip border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                <Check width={13} height={13} /> Reviewed &amp; approved
              </span>
            ) : (
              <button
                onClick={approve}
                disabled={approving || !urlAllowed || !packet}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  urlAllowed
                    ? "Record that you reviewed this exact packet"
                    : "The application URL failed a safety check (https/credentials/host), so it cannot be approved"
                }
              >
                {approving ? <Spinner width={14} height={14} /> : <Check width={14} height={14} />}
                {state === "stale" ? "Re-approve packet" : "I reviewed this — approve"}
              </button>
            )}
            <button
              onClick={openPosting}
              disabled={state !== "approved" || opening}
              className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
              title={
                state === "approved"
                  ? "Open the posting in a new tab and submit it yourself"
                  : "Approve the packet first"
              }
            >
              {opening ? <Spinner width={14} height={14} /> : <ArrowUpRight width={14} height={14} />}
              Open posting
            </button>
            <button
              onClick={autofill}
              disabled={state !== "approved" || autofilling}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              title={
                state === "approved"
                  ? "Open the application in a browser and fill it in — you review and submit"
                  : "Approve the packet first"
              }
            >
              {autofilling ? <Spinner width={14} height={14} /> : <Sparkles width={14} height={14} />}
              Autofill in browser
            </button>
            <button onClick={markApplied} disabled={marking} className="btn-primary">
              {marking ? <Spinner width={14} height={14} /> : <Check width={14} height={14} />}
              Mark as applied
            </button>
          </>
        }
      >
        {packet && (
          <div className="space-y-5">
            {/* What you are approving: the exact destination URL. */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Application URL you are approving
              </h3>
              <p className="break-all rounded-xl border border-hair bg-canvas p-3 font-mono text-xs text-zinc-200">
                {applyUrl ?? "No application URL on this packet."}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  urlAllowed ? "text-zinc-500" : "text-amber-400"
                )}
              >
                {urlAllowed ? (
                  <>Host {packet.handoff?.domain}. {packet.handoff?.reason}</>
                ) : (
                  <>
                    <X width={12} height={12} className="inline" /> Failed a safety check:{" "}
                    {packet.handoff?.reason ?? "no handoff decision"} — approval is blocked.
                  </>
                )}
              </p>
            </section>

            <div className="flex flex-wrap gap-2">
              <span className="chip border-brand-400/25 bg-brand-500/10 text-brand-200">
                Résumé · {packet.resumeVersion || "none selected"}
              </span>
              <span className="chip border-hair text-zinc-400">
                {job.location ?? "Location N/A"}
              </span>
              <span className="chip border-hair text-zinc-400">
                Match {breakdown.score}/100
              </span>
              <span
                className={cn(
                  "chip",
                  state === "approved"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : state === "stale"
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                      : "border-hair text-zinc-400"
                )}
              >
                {state === "approved"
                  ? "Approved"
                  : state === "stale"
                    ? "Approval expired — packet changed"
                    : "Not yet approved"}
              </span>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Why it scored {breakdown.score}
              </h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {breakdown.reasons.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4">
                    <span>{r.label}</span>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        r.delta > 0
                          ? "text-emerald-400"
                          : r.delta < 0
                            ? "text-rose-400"
                            : "text-zinc-500"
                      )}
                    >
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {needsInput.length > 0 && (
              <section className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Needs your input before you apply
                </h3>
                <ul className="space-y-1.5 text-sm text-amber-100/90">
                  {needsInput.map((p) => (
                    <li key={p.field}>
                      <span className="font-medium">{p.label}</span> — {p.note}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Cover letter draft
                </h3>
                {packet.coverLetter.trim() !== "" && (
                  <button
                    onClick={generateCoverLetter}
                    disabled={generating}
                    className="btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    title="Draft a fresh cover letter with AI (drops the current approval)"
                  >
                    {generating ? (
                      <Spinner width={12} height={12} />
                    ) : (
                      <Sparkles width={12} height={12} />
                    )}
                    Regenerate
                  </button>
                )}
              </div>
              {packet.coverLetter.trim() === "" ? (
                <div className="rounded-xl border border-dashed border-hair bg-canvas p-4 text-center">
                  <p className="text-sm text-zinc-400">
                    No cover letter yet. Drafting one uses AI, so it only runs
                    when you ask.
                  </p>
                  <button
                    onClick={generateCoverLetter}
                    disabled={generating}
                    className="btn-primary mx-auto mt-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? (
                      <Spinner width={14} height={14} />
                    ) : (
                      <Sparkles width={14} height={14} />
                    )}
                    {generating ? "Drafting…" : "Generate cover letter"}
                  </button>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap rounded-xl border border-hair bg-canvas p-4 font-sans text-sm leading-relaxed text-zinc-300">
                  {packet.coverLetter}
                </pre>
              )}
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

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Where this content came from
              </h3>
              <ul className="space-y-1 text-xs text-zinc-500">
                {packet.provenance.map((p) => (
                  <li key={p.field}>
                    <span className="text-zinc-400">{p.label}</span> · {p.source} — {p.note}
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[11px] text-zinc-600">
                packet {packet.fingerprint}
              </p>
            </section>

            {report && (
              <section className="rounded-xl border border-brand-400/25 bg-brand-500/5 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-200">
                  Autofill ran in a browser on your machine
                </h3>
                <p className="mb-3 text-xs text-amber-300">{report.notice}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-emerald-300">
                      Filled {report.filled.length}
                    </p>
                    <ul className="space-y-0.5 text-xs text-zinc-400">
                      {report.filled.map((f) => (
                        <li key={f.key}>
                          <Check width={11} height={11} className="inline text-emerald-400" />{" "}
                          {f.label}
                        </li>
                      ))}
                      {report.filled.length === 0 && <li>Nothing matched automatically.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-amber-300">
                      Left for you {report.skipped.length}
                    </p>
                    <ul className="space-y-0.5 text-xs text-zinc-400">
                      {report.skipped.map((s) => (
                        <li key={s.key}>
                          <X width={11} height={11} className="inline text-amber-400" /> {s.label}{" "}
                          <span className="text-zinc-600">({s.reason})</span>
                        </li>
                      ))}
                      {report.skipped.length === 0 && <li>All known fields were placed.</li>}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">Résumé: {report.resume.note}</p>
              </section>
            )}

            {openedUrl && (
              <p className="text-xs text-zinc-400">
                Opened in a new tab. If your browser blocked it, use this link and submit the
                application yourself:{" "}
                <a
                  href={openedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-brand-200 underline"
                >
                  {openedUrl}
                </a>
              </p>
            )}

            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
