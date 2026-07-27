import { computeDedupHash } from "@/lib/scrapers/dedup";

describe("computeDedupHash", () => {
  test("produces consistent output for the same inputs", () => {
    const hash1 = computeDedupHash(1, "https://example.com/jobs/1");
    const hash2 = computeDedupHash(1, "https://example.com/jobs/1");
    expect(hash1).toBe(hash2);
  });

  test("produces different hashes for different company IDs", () => {
    const hash1 = computeDedupHash(1, "https://example.com/jobs/1");
    const hash2 = computeDedupHash(2, "https://example.com/jobs/1");
    expect(hash1).not.toBe(hash2);
  });

  test("produces different hashes for different URLs", () => {
    const hash1 = computeDedupHash(1, "https://example.com/jobs/1");
    const hash2 = computeDedupHash(1, "https://example.com/jobs/2");
    expect(hash1).not.toBe(hash2);
  });

  test("returns a 64-character lowercase hex string (SHA-256)", () => {
    const hash = computeDedupHash(1, "https://example.com/jobs/1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("handles URL with query params without collision", () => {
    const hash1 = computeDedupHash(1, "https://example.com/jobs?id=1");
    const hash2 = computeDedupHash(1, "https://example.com/jobs?id=2");
    expect(hash1).not.toBe(hash2);
  });
});
