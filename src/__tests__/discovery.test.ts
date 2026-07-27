import { GreenhouseAdapter } from "../lib/scrapers/adapters/greenhouse";
import { LeverAdapter } from "../lib/scrapers/adapters/lever";
import { AshbyAdapter } from "../lib/scrapers/adapters/ashby";
import { runDiscovery, validateSource } from "../lib/discovery/run";
import type { DiscoverySource } from "../lib/discovery/types";

const TARGET = {
  companyId: 1,
  companyName: "Example Co",
  atsBoardId: "exampleco",
  careersUrl: "https://example.com/careers",
};

function mockFetchJson(payload: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(payload)),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GreenhouseAdapter", () => {
  it("maps valid jobs to RawPosting and skips malformed entries", async () => {
    mockFetchJson({
      jobs: [
        {
          id: 4001,
          title: "Software Engineer, New Grad",
          absolute_url: "https://boards.greenhouse.io/exampleco/jobs/4001",
          location: { name: "SF" },
          content: "New grad role, 0-1 years experience.",
          first_published: "2026-07-01T00:00:00Z",
        },
        { id: 4002 }, // missing title/url → skipped
        "garbage",
      ],
    });
    const postings = await new GreenhouseAdapter().fetchPostings(TARGET);
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({
      externalId: "4001",
      title: "Software Engineer, New Grad",
      url: "https://boards.greenhouse.io/exampleco/jobs/4001",
      location: "SF",
      source: "greenhouse",
      postedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("throws on an unexpected payload shape", async () => {
    mockFetchJson({ nope: true });
    await expect(new GreenhouseAdapter().fetchPostings(TARGET)).rejects.toThrow(
      /unexpected payload/
    );
  });

  it("throws on HTTP errors", async () => {
    mockFetchJson({}, 404);
    await expect(new GreenhouseAdapter().fetchPostings(TARGET)).rejects.toThrow(
      /HTTP 404/
    );
  });

  it("rejects unsafe board ids before making any request", () => {
    expect(() =>
      new GreenhouseAdapter().endpointUrl({ ...TARGET, atsBoardId: "../evil" })
    ).toThrow(/Invalid Greenhouse board id/);
  });
});

describe("LeverAdapter", () => {
  it("maps valid postings and converts epoch dates", async () => {
    mockFetchJson([
      {
        id: "ab-12",
        text: "Backend Engineer, Entry Level",
        hostedUrl: "https://jobs.lever.co/exampleco/ab-12",
        categories: { location: "NYC" },
        descriptionPlain: "Entry level backend role.",
        createdAt: 1751328000000,
      },
      { id: "bad" }, // missing fields → skipped
    ]);
    const postings = await new LeverAdapter().fetchPostings(TARGET);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("lever");
    expect(postings[0].postedAt).toBe(new Date(1751328000000).toISOString());
  });

  it("throws when the payload is not an array", async () => {
    mockFetchJson({ jobs: [] });
    await expect(new LeverAdapter().fetchPostings(TARGET)).rejects.toThrow(
      /expected array/
    );
  });
});

describe("AshbyAdapter", () => {
  it("maps valid jobs", async () => {
    mockFetchJson({
      jobs: [
        {
          id: "uuid-1",
          title: "New Grad SWE",
          jobUrl: "https://jobs.ashbyhq.com/exampleco/uuid-1",
          location: "Remote",
          descriptionPlain: "Recent graduates welcome.",
          publishedAt: "2026-07-10T00:00:00Z",
        },
      ],
    });
    const postings = await new AshbyAdapter().fetchPostings(TARGET);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("ashby");
  });
});

describe("runDiscovery", () => {
  const sources: DiscoverySource[] = [
    {
      companyId: 1,
      companyName: "Example Co",
      ats: "greenhouse",
      boardId: "exampleco",
      careersUrl: "https://example.com/careers",
    },
    {
      companyId: 2,
      companyName: "Example Two",
      ats: "greenhouse",
      boardId: "exampletwo",
      careersUrl: "https://exampletwo.com/careers",
    },
  ];

  it("classifies, dedupes across sources, and reports totals", async () => {
    // Both boards return the same posting URL — the second is a duplicate.
    mockFetchJson({
      jobs: [
        {
          id: 1,
          title: "Software Engineer, New Grad",
          absolute_url: "https://boards.greenhouse.io/exampleco/jobs/1",
          location: { name: "SF" },
          content: "New grad role. Minimum of 1 year experience.",
        },
      ],
    });

    const result = await runDiscovery(sources, { checkRobots: false });
    expect(result.totals.postingsFound).toBe(2);
    expect(result.totals.postingsKept).toBe(1);
    expect(result.totals.duplicatesSkipped).toBe(1);
    expect(result.postings[0]).toMatchObject({
      companyName: "Example Co",
      isNewGrad: true,
      requiredYearsMin: 1,
    });
    expect(result.postings[0].dedupHash).toHaveLength(64);
  });

  it("isolates per-source errors instead of failing the run", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await runDiscovery(sources, { checkRobots: false });
    expect(result.totals.sourcesWithErrors).toBe(2);
    expect(result.postings).toHaveLength(0);
    expect(result.sources[0].errorMessage).toContain("network down");
  });

  it("rejects invalid source configs without fetching", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const bad = { ...sources[0], boardId: "../../etc" };
    const result = await runDiscovery([bad], { checkRobots: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.sources[0].errorMessage).toContain("invalid source config");
  });

  it("validateSource flags unknown ATS values", () => {
    expect(
      validateSource({ ...sources[0], ats: "workday" as never })
    ).toContain("ats must be one of");
  });
});
