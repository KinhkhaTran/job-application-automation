import { COMPANY_TARGETS } from "../../../config/companies";
import { DISCOVERY_SOURCES } from "../../../config/discovery";

/** Hostname of a URL with any leading "www." removed, or null. */
export function registrableHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * The apply allowlist derived from explicit configuration: the careers-page
 * domains of tracked companies and configured discovery sources. Subdomains
 * of these hosts match too (see evaluateHandoff).
 */
export function configuredAllowlist(extraUrls: string[] = []): string[] {
  const hosts = new Set<string>();
  for (const t of COMPANY_TARGETS) {
    const h = registrableHost(t.careersUrl);
    if (h) hosts.add(h);
  }
  for (const s of DISCOVERY_SOURCES) {
    const h = registrableHost(s.careersUrl);
    if (h) hosts.add(h);
  }
  for (const u of extraUrls) {
    const h = registrableHost(u);
    if (h) hosts.add(h);
  }
  return Array.from(hosts);
}
