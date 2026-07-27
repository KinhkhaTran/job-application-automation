// Heuristic 0–100 fit score for a new-grad SWE search.
// Deterministic so the same posting always scores the same.

export interface ScoreInput {
  title: string;
  isNewGrad: boolean;
  requiredYearsMin: number | null;
}

export interface ScoreReason {
  label: string;
  /** Points this signal contributed, before clamping. */
  delta: number;
}

export interface ScoreBreakdown {
  score: number;
  reasons: ScoreReason[];
}

const BASE = 45;

/**
 * The score plus the signals that produced it, so the review UI can explain
 * itself instead of showing a bare number.
 */
export function scoreJobDetailed(input: ScoreInput): ScoreBreakdown {
  const reasons: ScoreReason[] = [{ label: "Baseline SWE posting", delta: BASE }];

  if (input.isNewGrad) {
    reasons.push({ label: "Classified as new-grad / entry level", delta: 35 });
  } else {
    reasons.push({ label: "Not classified as new-grad", delta: 0 });
  }

  const years = input.requiredYearsMin;
  if (years === null) {
    reasons.push({ label: "No required-experience years found", delta: 5 });
  } else if (years <= 1) {
    reasons.push({ label: `Requires only ${years} year(s) of experience`, delta: 20 });
  } else if (years <= 2) {
    reasons.push({ label: `Requires ${years} years of experience`, delta: 8 });
  } else if (years >= 5) {
    reasons.push({ label: `Requires ${years}+ years of experience`, delta: -35 });
  } else {
    reasons.push({ label: `Requires ${years} years of experience`, delta: -15 });
  }

  const t = input.title.toLowerCase();
  if (/\b(senior|sr\.?|staff|principal|lead|manager)\b/.test(t)) {
    reasons.push({ label: "Title indicates a senior/lead role", delta: -30 });
  }
  if (/\b(software|engineer|developer|swe)\b/.test(t)) {
    reasons.push({ label: "Title matches software engineering", delta: 8 });
  }
  if (/\b(intern|internship)\b/.test(t)) {
    reasons.push({ label: "Title indicates an internship", delta: -20 });
  }

  const raw = reasons.reduce((sum, r) => sum + r.delta, 0);
  return { score: Math.max(0, Math.min(100, Math.round(raw))), reasons };
}

export function scoreJob(input: ScoreInput): number {
  return scoreJobDetailed(input).score;
}

export function matchTier(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
