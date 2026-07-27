import type { PostingStatus } from "@/lib/data/types";
import { cn } from "@/lib/data/format";

// Statuses read like a build pipeline: queued → staged → submitted → passing.
// `live` states pulse their signal dot; the rest hold steady.
const STYLES: Record<
  PostingStatus,
  { label: string; cls: string; dot: string; live?: boolean }
> = {
  new: { label: "New", cls: "text-sky-700 bg-sky-50 border-sky-200", dot: "bg-sky-500" },
  reviewing: {
    label: "Reviewing",
    cls: "text-brand-500 bg-brand-50 border-brand-200",
    dot: "bg-brand-400",
    live: true,
  },
  applied: {
    label: "Applied",
    cls: "text-teal-700 bg-teal-50 border-teal-200",
    dot: "bg-teal-500",
  },
  interviewing: {
    label: "Interviewing",
    cls: "text-violet-700 bg-violet-50 border-violet-200",
    dot: "bg-violet-500",
    live: true,
  },
  offer: {
    label: "Offer",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    cls: "text-rose-700 bg-rose-50 border-rose-200",
    dot: "bg-rose-500",
  },
  ghosted: {
    label: "Ghosted",
    cls: "text-zinc-500 bg-zinc-900 border-hair",
    dot: "bg-zinc-600",
  },
  skipped: {
    label: "Skipped",
    cls: "text-zinc-500 bg-zinc-900 border-hair",
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
