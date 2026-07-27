"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Spinner } from "./icons";

export function ScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function scan() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setMsg(
        data.added > 0
          ? `Found ${data.found} · added ${data.added} new`
          : `Found ${data.found} · nothing new`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      <button onClick={scan} disabled={loading} className="btn-ghost">
        {loading ? <Spinner width={14} height={14} /> : <Play width={14} height={14} />}
        {loading ? "Scanning…" : "Run scan"}
      </button>
    </div>
  );
}
