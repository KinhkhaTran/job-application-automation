// Shared HTTP helper for ATS board adapters. Every outbound request goes
// through here so the user agent, timeout, and response-size guard are
// applied uniformly and are easy to observe/adjust in one place.

export const ADAPTER_USER_AGENT = "job-automation-bot (personal job search; human-in-the-loop)";

const TIMEOUT_MS = 15_000;
// Board payloads are JSON lists of postings; anything larger than this is
// almost certainly not what we expect.
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

export async function fetchJson(url: string): Promise<unknown> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": ADAPTER_USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} from ${url}`);
  }

  const text = await resp.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Response from ${url} exceeds ${MAX_RESPONSE_BYTES} bytes`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Response from ${url} is not valid JSON`);
  }
}

// ── validation helpers for untrusted external payloads ─────────────────────

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Coerce an external id (string or number) to a non-empty string. */
export function asExternalId(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return asString(v);
}

/** Parse an external date (ISO string or epoch millis) to ISO-8601, or null. */
export function asIsoDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** True when the URL parses and uses http(s). */
export function isHttpUrl(v: string | null): v is string {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Board handles are path segments in ATS URLs — keep them strictly boring. */
export function isValidBoardId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id);
}
