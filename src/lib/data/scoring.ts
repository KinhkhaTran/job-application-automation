// Heuristic 0–100 fit score for a new-grad SWE search.
// Deterministic so the same posting always scores the same.
export function scoreJob(input: {
  title: string;
  isNewGrad: boolean;
  requiredYearsMin: number | null;
}): number {
  let score = 45;

  if (input.isNewGrad) score += 35;

  const years = input.requiredYearsMin;
  if (years === null) {
    score += 5;
  } else if (years <= 1) {
    score += 20;
  } else if (years <= 2) {
    score += 8;
  } else if (years >= 5) {
    score -= 35;
  } else {
    score -= 15;
  }

  const t = input.title.toLowerCase();
  if (/\b(senior|sr\.?|staff|principal|lead|manager)\b/.test(t)) score -= 30;
  if (/\b(software|engineer|developer|swe)\b/.test(t)) score += 8;
  if (/\b(intern|internship)\b/.test(t)) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function matchTier(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
