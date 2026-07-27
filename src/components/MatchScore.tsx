import { matchTier } from "@/lib/data/scoring";
import { cn } from "@/lib/data/format";

const TIER = {
  high: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  low: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
};

export function MatchScore({ score }: { score: number }) {
  const tier = matchTier(score);
  return (
    <span
      className={cn(
        "num inline-flex min-w-[3.25rem] items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold",
        TIER[tier]
      )}
      title={`Fit score: ${score}/100`}
    >
      {score}
      <span className="opacity-50">%</span>
    </span>
  );
}
