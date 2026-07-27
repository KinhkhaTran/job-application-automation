const USER_AGENT = "job-automation-bot";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface RobotsRules {
  disallowed: string[];
  crawlDelayMs: number | null;
}

interface CacheEntry {
  rules: RobotsRules;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function isUrlAllowed(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }

  const rules = await fetchRules(parsed.origin);
  const path = parsed.pathname;

  for (const blocked of rules.disallowed) {
    if (path.startsWith(blocked)) return false;
  }
  return true;
}

async function fetchRules(origin: string): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules;
  }

  try {
    const resp = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      const rules: RobotsRules = { disallowed: [], crawlDelayMs: null };
      cache.set(origin, { rules, fetchedAt: Date.now() });
      return rules;
    }

    const text = await resp.text();
    const rules = parseRobotsTxt(text);
    cache.set(origin, { rules, fetchedAt: Date.now() });
    return rules;
  } catch {
    // Network error — fail open, do not cache so next run retries
    return { disallowed: [], crawlDelayMs: null };
  }
}

export function parseRobotsTxt(text: string): RobotsRules {
  const disallowed: string[] = [];
  let crawlDelayMs: number | null = null;
  let applies = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      applies = value === "*" || value.toLowerCase() === USER_AGENT;
    } else if (applies) {
      if (directive === "disallow" && value) {
        disallowed.push(value);
      } else if (directive === "crawl-delay") {
        const n = parseFloat(value);
        if (!isNaN(n)) crawlDelayMs = n * 1000;
      }
    }
  }

  return { disallowed, crawlDelayMs };
}

/** Clear the in-process robots.txt cache (for testing). */
export function clearRobotsCache(): void {
  cache.clear();
}
