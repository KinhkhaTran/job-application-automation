// Manual-review application handoff.
//
// This module decides whether a posting's application URL is safe to hand to
// the user to open IN THEIR OWN BROWSER, and normalizes it for storage.
// That is the entire scope: it never automates login, account creation,
// CAPTCHA solving, form filling, credential submission, or application
// submission, and it never handles passwords or other credentials.

export interface HandoffDecision {
  allowed: boolean;
  /** Normalized URL (credentials always stripped, tracking params removed). */
  url: string;
  /** Hostname of the URL, or null when it does not parse. */
  domain: string | null;
  /** Human-readable explanation of the decision. */
  reason: string;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

function stripTracking(url: URL): void {
  const toDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (/^utm_/i.test(key) || key === "gclid" || key === "fbclid") {
      toDelete.push(key);
    }
  });
  for (const key of toDelete) url.searchParams.delete(key);
}

/**
 * Normalize an application URL for storage: strip any embedded credentials,
 * fragments, and tracking params; lowercase the host. Returns null when the
 * input does not parse as a URL at all.
 */
export function normalizeApplicationUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  // Never keep credentials embedded in a URL — not in storage, not in logs.
  url.username = "";
  url.password = "";
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  stripTracking(url);
  return url.toString();
}

/**
 * Evaluate whether an application URL may be handed to the user for manual
 * review. Any public https URL is accepted — there is no domain allowlist.
 * The remaining checks are safety-only: https-only, no embedded credentials,
 * and no private/local hosts. `allowedDomains` is retained for call-site
 * compatibility and is ignored.
 */
export function evaluateHandoff(
  rawUrl: string,
  _allowedDomains: string[] = []
): HandoffDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      url: rawUrl,
      domain: null,
      reason: "URL does not parse",
    };
  }

  const normalized = normalizeApplicationUrl(rawUrl)!;
  const domain = url.hostname.toLowerCase();

  if (url.protocol !== "https:") {
    return {
      allowed: false,
      url: normalized,
      domain,
      reason: `Only https URLs are handed off (got ${url.protocol.replace(":", "")})`,
    };
  }

  if (url.username || url.password) {
    // The credentials are already stripped from `normalized` and are never
    // echoed back in the reason.
    return {
      allowed: false,
      url: normalized,
      domain,
      reason: "URL embeds credentials; refusing to store or open it",
    };
  }

  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(domain))) {
    return {
      allowed: false,
      url: normalized,
      domain,
      reason: "Host resolves to a private or local address",
    };
  }

  return {
    allowed: true,
    url: normalized,
    domain,
    reason: "URL accepted; open and submit manually in your browser",
  };
}
