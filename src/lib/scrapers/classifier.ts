export interface ClassifierResult {
  isNewGrad: boolean;
  requiredYearsMin: number | null;
}

const NEW_GRAD_TITLE_PATTERNS = [
  /\bnew[\s-]?grad(uate)?\b/i,
  /\bentry[\s-]level\b/i,
  /\buniversity\s+grad(uate)?\b/i,
  /\brecent[\s-]?grad(uate)?\b/i,
  /\bearly[\s-]career\b/i,
  /\bcampus\s+(hire|recruit)\b/i,
];

const NEW_GRAD_DESC_PATTERNS = [
  /\bnew[\s-]?grad(uate)?s?\b/i,
  /\bentry[\s-]level\b/i,
  /\bjust\s+graduated\b/i,
  /\brecently\s+graduated\b/i,
  /\bgraduating\s+in\s+20[2-9]\d\b/i,
  /\bclass\s+of\s+20[2-9]\d\b/i,
  /\bcohort\s+of\s+20[2-9]\d\b/i,
  // "0-1 years" or "0 to 1 year" — effectively no experience required
  /\b0\s*(?:to|-)\s*[12]\s+years?\b/i,
];

// All have the /g flag; reset lastIndex before each use.
const YEARS_PATTERNS = [
  /\b(\d+)\+?\s+years?\s+(?:of\s+)?(?:professional\s+)?(?:relevant\s+)?experience\b/gi,
  /\bminimum\s+(?:of\s+)?(\d+)\s+years?\b/gi,
  /\bat\s+least\s+(\d+)\s+years?\b/gi,
];

export function classifyPosting(
  title: string,
  description: string | null
): ClassifierResult {
  const desc = description ?? "";

  const isNewGradByTitle = NEW_GRAD_TITLE_PATTERNS.some((p) => p.test(title));
  const isNewGradByDesc =
    !isNewGradByTitle && NEW_GRAD_DESC_PATTERNS.some((p) => p.test(desc));
  const isNewGrad = isNewGradByTitle || isNewGradByDesc;

  const yearsFound: number[] = [];
  for (const pattern of YEARS_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(desc)) !== null) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) yearsFound.push(n);
    }
  }

  const requiredYearsMin =
    yearsFound.length > 0 ? Math.min(...yearsFound) : null;

  return { isNewGrad, requiredYearsMin };
}
