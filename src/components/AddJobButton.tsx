"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Sparkles, X } from "./icons";

/**
 * Paste a single job URL and ingest it into the dashboard. This calls
 * /api/ingest, which fetches the public posting page and normalizes it —
 * nothing is logged into, filled, or submitted.
 */
export function AddJobButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Ingest failed");
      const job = data.job as { company: string; title: string };
      setMsg(
        `${data.created ? "Added" : "Refreshed"}: ${job.company} — ${job.title}`
      );
      setUrl("");
      router.refresh();
      setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost">
        <Sparkles width={14} height={14} />
        Add job by URL
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && url.trim() && submit()}
          placeholder="https://www.amazon.jobs/jobs/…"
          className="w-72 rounded-xl border border-hair bg-canvas px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-brand-400/50"
        />
        <button
          onClick={submit}
          disabled={loading || !url.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Spinner width={14} height={14} /> : "Ingest"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost" aria-label="Close">
          <X width={14} height={14} />
        </button>
      </div>
      {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
