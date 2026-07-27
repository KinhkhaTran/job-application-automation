import type { ReactNode } from "react";
import { cn } from "@/lib/data/format";

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "card animate-fade-in p-5",
        accent && "border-brand-400/30 bg-gradient-to-br from-brand-500/10 to-transparent"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <div className="mt-3 num text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
