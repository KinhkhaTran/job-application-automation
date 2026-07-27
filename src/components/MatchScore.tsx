import { matchTier } from "@/lib/data/scoring";
import { cn } from "@/lib/data/format";

const TIER = {
  high: "text-emerald-700 border-emerald-200 bg-emerald-50",
  medium: "text-amber-700 border-amber-200 bg-amber-50",
  low: "text-zinc-500 border-hair bg-zinc-900",
};

export function MatchScore({ score }: { score: number }) {
  const tier = matchTier(score);
  return (
    <span
      className={cn(
        "num inline-flex min-w-[3.25rem] items-center justify-center gap-0.5 rounded-md border px-2 py-1 text-xs font-semibold",
        TIER[tier]
      )}
      title={`Fit score: ${score}/100`}
    >
      {score}
      <span className="text-[10px] opacity-50">%</span>
    </span>
  );
}
