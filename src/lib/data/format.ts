// Date helpers that don't depend on the current time being available at
// module load (safe for SSR). "now" is passed in where relative output matters.

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeTime(iso: string | null, now: number): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = now - then;
  const day = 86_400_000;
  const hour = 3_600_000;
  if (diff < hour) return "just now";
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Concatenate class names, dropping falsy values. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
