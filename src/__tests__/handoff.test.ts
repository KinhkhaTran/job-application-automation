import { evaluateHandoff, normalizeApplicationUrl } from "../lib/apply/handoff";

const ALLOWLIST = ["stripe.com", "linear.app"];

describe("normalizeApplicationUrl", () => {
  it("strips credentials, fragments, and tracking params", () => {
    const normalized = normalizeApplicationUrl(
      "https://user:secret@stripe.com/jobs/1?utm_source=x&gclid=abc&ref=hn#apply"
    );
    expect(normalized).toBe("https://stripe.com/jobs/1?ref=hn");
    expect(normalized).not.toContain("secret");
  });

  it("lowercases the host", () => {
    expect(normalizeApplicationUrl("https://Stripe.COM/jobs")).toBe(
      "https://stripe.com/jobs"
    );
  });

  it("returns null for unparseable input", () => {
    expect(normalizeApplicationUrl("not a url")).toBeNull();
  });
});

describe("evaluateHandoff — allowed", () => {
  it("allows an https URL on an allowlisted domain", () => {
    const d = evaluateHandoff("https://stripe.com/jobs/123", ALLOWLIST);
    expect(d.allowed).toBe(true);
    expect(d.domain).toBe("stripe.com");
    expect(d.url).toBe("https://stripe.com/jobs/123");
  });

  it("allows subdomains of allowlisted domains", () => {
    const d = evaluateHandoff("https://careers.stripe.com/jobs/1", ALLOWLIST);
    expect(d.allowed).toBe(true);
  });

  it("always allows public ATS apply hosts", () => {
    for (const url of [
      "https://boards.greenhouse.io/exampleco/jobs/1",
      "https://jobs.lever.co/exampleco/abc",
      "https://jobs.ashbyhq.com/exampleco/abc",
    ]) {
      expect(evaluateHandoff(url, []).allowed).toBe(true);
    }
  });
});

describe("evaluateHandoff — no allowlist (all public https URLs allowed)", () => {
  it("allows any public https domain, allowlist argument ignored", () => {
    for (const url of [
      "https://evil.example.net/jobs/1",
      "https://notstripe.com/jobs/1",
      "https://www.amazon.jobs/jobs/10481932/apply",
      "https://careers.some-random-company.io/openings/42",
    ]) {
      expect(evaluateHandoff(url, ALLOWLIST).allowed).toBe(true);
      expect(evaluateHandoff(url, []).allowed).toBe(true);
    }
  });
});

describe("evaluateHandoff — blocked", () => {
  it("blocks plain-http URLs", () => {
    const d = evaluateHandoff("http://stripe.com/jobs/1", ALLOWLIST);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("https");
  });

  it("blocks non-http(s) schemes", () => {
    expect(evaluateHandoff("javascript:alert(1)", ALLOWLIST).allowed).toBe(false);
    expect(evaluateHandoff("file:///etc/passwd", ALLOWLIST).allowed).toBe(false);
  });

  it("blocks URLs with embedded credentials and never echoes them", () => {
    const d = evaluateHandoff("https://user:hunter2@stripe.com/jobs/1", ALLOWLIST);
    expect(d.allowed).toBe(false);
    expect(d.url).not.toContain("hunter2");
    expect(d.reason).not.toContain("hunter2");
  });

  it("blocks private and local hosts", () => {
    for (const url of [
      "https://localhost/apply",
      "https://127.0.0.1/apply",
      "https://10.0.0.5/apply",
      "https://192.168.1.10/apply",
      "https://172.16.0.1/apply",
      "https://intranet.local/apply",
    ]) {
      expect(evaluateHandoff(url, ALLOWLIST).allowed).toBe(false);
    }
  });

  it("blocks unparseable URLs", () => {
    const d = evaluateHandoff("::::", ALLOWLIST);
    expect(d.allowed).toBe(false);
    expect(d.domain).toBeNull();
  });
});
