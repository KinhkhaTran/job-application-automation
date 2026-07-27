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
        "card animate-fade-in relative overflow-hidden p-5",
        accent && "border-brand-400/30 bg-gradient-to-br from-brand-500/[0.08] to-transparent"
      )}
    >
      {/* Accent readout gets a lit signal bar down its left edge. */}
      {accent && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-400" />}
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && (
          <span className={cn(accent ? "text-brand-400" : "text-zinc-600")}>{icon}</span>
        )}
      </div>
      <div className="mt-3 num text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </div>
      {hint && <div className="mt-1 font-mono text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}
