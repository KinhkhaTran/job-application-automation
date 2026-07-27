import type { PostingStatus } from "@/lib/data/types";
import { cn } from "@/lib/data/format";

// Statuses read like a build pipeline: queued → staged → submitted → passing.
// `live` states pulse their signal dot; the rest hold steady.
const STYLES: Record<
  PostingStatus,
  { label: string; cls: string; dot: string; live?: boolean }
> = {
  new: { label: "New", cls: "text-sky-300 bg-sky-400/10 border-sky-400/20", dot: "bg-sky-400" },
  reviewing: {
    label: "Reviewing",
    cls: "text-brand-300 bg-brand-500/10 border-brand-400/25",
    dot: "bg-brand-400",
    live: true,
  },
  applied: {
    label: "Applied",
    cls: "text-teal-300 bg-teal-400/10 border-teal-400/25",
    dot: "bg-teal-400",
  },
  interviewing: {
    label: "Interviewing",
    cls: "text-violet-300 bg-violet-400/10 border-violet-400/20",
    dot: "bg-violet-400",
    live: true,
  },
  offer: {
    label: "Offer",
    cls: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    cls: "text-rose-300 bg-rose-400/10 border-rose-400/20",
    dot: "bg-rose-400",
  },
  ghosted: {
    label: "Ghosted",
    cls: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    dot: "bg-zinc-500",
  },
  skipped: {
    label: "Skipped",
    cls: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
    dot: "bg-zinc-600",
  },
};

export function StatusBadge({ status }: { status: PostingStatus }) {
  const s = STYLES[status];
  return (
    <span className={cn("chip", s.cls)}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", s.dot, s.live && "animate-pulse-signal")}
      />
      {s.label}
    </span>
  );
}

export const STATUS_META = STYLES;
