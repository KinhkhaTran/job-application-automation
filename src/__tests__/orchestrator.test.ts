jest.mock("@/lib/scrapers/robots", () => ({
  isUrlAllowed: jest.fn(),
}));

import { runScraper } from "@/lib/scrapers/orchestrator";
import { isUrlAllowed } from "@/lib/scrapers/robots";
import type { AtsAdapter, CompanyTarget, RawPosting } from "@/lib/scrapers/types";

const mockedIsUrlAllowed = jest.mocked(isUrlAllowed);

// Local fixture postings — a small hand-built set exercising the classifier
// (new-grad / entry-level / senior) and experience-year extraction. Kept in the
// test so the app source ships no mock adapter.
const FIXTURE_POSTINGS: RawPosting[] = [
  {
    externalId: "fixture-001",
    title: "Software Engineer, New Grad",
    url: "https://careers.example.com/jobs/1",
    location: "San Francisco, CA",
    description:
      "Exciting opportunity for a new grad SWE. We welcome candidates with 0-1 years of experience.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "fixture",
    rawData: { id: "fixture-001" },
  },
  {
    externalId: "fixture-002",
    title: "Senior Software Engineer",
    url: "https://careers.example.com/jobs/2",
    location: "Remote",
    description:
      "Seeking a senior engineer with 5+ years of professional experience.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "fixture",
    rawData: { id: "fixture-002" },
  },
  {
    externalId: "fixture-003",
    title: "Entry Level Backend Engineer",
    url: "https://careers.example.com/jobs/3",
    location: "New York, NY",
    description:
      "Entry level position for recent graduates. Class of 2026 grads encouraged to apply.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "fixture",
    rawData: { id: "fixture-003" },
  },
];

class FixtureAdapter implements AtsAdapter {
  readonly name = "fixture";
  async fetchPostings(_target: CompanyTarget): Promise<RawPosting[]> {
    return [...FIXTURE_POSTINGS];
  }
}

const TEST_TARGET: CompanyTarget = {
  companyId: 42,
  companyName: "Test Co",
  atsBoardId: "testco",
  careersUrl: "https://testco.example.com/careers",
};

describe("runScraper", () => {
  let adapter: FixtureAdapter;

  beforeEach(() => {
    adapter = new FixtureAdapter();
    mockedIsUrlAllowed.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("classifies new-grad posting correctly", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: true });

    expect(result.skippedByRobots).toBe(false);
    expect(result.errorMessage).toBeUndefined();
    expect(result.postings.length).toBe(FIXTURE_POSTINGS.length);

    const newGradPosting = result.postings.find((p) => p.title.includes("New Grad"));
    expect(newGradPosting).toBeDefined();
    expect(newGradPosting?.isNewGrad).toBe(true);
  });

  test("classifies senior posting as non-new-grad", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    const seniorPosting = result.postings.find((p) => p.title.includes("Senior"));
    expect(seniorPosting).toBeDefined();
    expect(seniorPosting?.isNewGrad).toBe(false);
  });

  test("classifies entry-level posting as new-grad", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    const entryPosting = result.postings.find((p) => p.title.includes("Entry Level"));
    expect(entryPosting).toBeDefined();
    expect(entryPosting?.isNewGrad).toBe(true);
  });

  test("attaches a 64-char SHA-256 dedupHash to each posting", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    for (const p of result.postings) {
      expect(p.dedupHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("dedup hashes are deterministic across runs", async () => {
    const run1 = await runScraper(adapter, TEST_TARGET, { checkRobots: false });
    const run2 = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    const hashes1 = run1.postings.map((p) => p.dedupHash).sort();
    const hashes2 = run2.postings.map((p) => p.dedupHash).sort();
    expect(hashes1).toEqual(hashes2);
  });

  test("dedup hash differs for the same URL under different company IDs", async () => {
    const targetA = { ...TEST_TARGET, companyId: 1 };
    const targetB = { ...TEST_TARGET, companyId: 2 };

    const runA = await runScraper(adapter, targetA, { checkRobots: false });
    const runB = await runScraper(adapter, targetB, { checkRobots: false });

    const hashesA = runA.postings.map((p) => p.dedupHash);
    const hashesB = runB.postings.map((p) => p.dedupHash);

    for (let i = 0; i < hashesA.length; i++) {
      expect(hashesA[i]).not.toBe(hashesB[i]);
    }
  });

  test("extracts requiredYearsMin for the senior posting", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    const seniorPosting = result.postings.find((p) => p.title.includes("Senior"));
    expect(seniorPosting?.requiredYearsMin).toBe(5);
  });

  test("returns skippedByRobots=true when isUrlAllowed returns false", async () => {
    mockedIsUrlAllowed.mockResolvedValueOnce(false);

    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: true });

    expect(result.skippedByRobots).toBe(true);
    expect(result.postings).toHaveLength(0);
  });

  test("skips robots check when checkRobots=false", async () => {
    mockedIsUrlAllowed.mockResolvedValueOnce(false);

    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    expect(result.skippedByRobots).toBe(false);
    expect(result.postings.length).toBeGreaterThan(0);
  });

  test("captures adapter errors in errorMessage", async () => {
    const failAdapter: AtsAdapter = {
      name: "fail",
      async fetchPostings(_target) {
        throw new Error("Network timeout");
      },
    };

    const result = await runScraper(failAdapter, TEST_TARGET, { checkRobots: false });

    expect(result.errorMessage).toBe("Network timeout");
    expect(result.postings).toHaveLength(0);
  });

  test("result includes companyId and companyName", async () => {
    const result = await runScraper(adapter, TEST_TARGET, { checkRobots: false });

    expect(result.companyId).toBe(TEST_TARGET.companyId);
    expect(result.companyName).toBe(TEST_TARGET.companyName);
    expect(result.source).toBe("fixture");
  });
});
