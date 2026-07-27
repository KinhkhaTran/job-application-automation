import { ingestJobUrl, htmlToText } from "@/lib/discovery/ingestUrl";

function mockFetch(map: Record<string, string>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = map[url];
    if (body === undefined) {
      return { ok: false, status: 404, text: async () => "" } as Response;
    }
    return { ok: true, status: 200, text: async () => body } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("htmlToText", () => {
  it("strips tags, decodes entities, and bullets list items", () => {
    const out = htmlToText("<p>Hello&nbsp;&amp; welcome</p><ul><li>One</li><li>Two</li></ul>");
    expect(out).toContain("Hello & welcome");
    expect(out).toContain("• One");
    expect(out).toContain("• Two");
    expect(out).not.toContain("<");
  });
});

describe("ingestJobUrl — amazon.jobs adapter", () => {
  it("fetches the per-job JSON endpoint and normalizes it", async () => {
    mockFetch({
      "https://www.amazon.jobs/en/jobs/10481932.json": JSON.stringify({
        job: {
          title: "EFA Network Software Engineer I",
          description: "<p>Build fast C code.</p>",
          basic_qualifications: "<ul><li>C programming</li></ul>",
          preferred_qualifications: "<ul><li>Libfabric</li></ul>",
          normalized_location: "Seattle, WA, USA",
          posted_date: "2026-07-01",
          company_name: "Amazon",
        },
      }),
    });

    const posting = await ingestJobUrl("https://www.amazon.jobs/jobs/10481932/apply");
    expect(posting.companyName).toBe("Amazon");
    expect(posting.title).toBe("EFA Network Software Engineer I");
    expect(posting.location).toBe("Seattle, WA, USA");
    expect(posting.description).toContain("Build fast C code.");
    expect(posting.description).toContain("BASIC QUALIFICATIONS");
    expect(posting.description).toContain("• C programming");
    expect(posting.description).toContain("PREFERRED QUALIFICATIONS");
    expect(posting.source).toBe("ingest:amazon.jobs");
    expect(posting.url).toBe("https://www.amazon.jobs/jobs/10481932/apply");
  });
});

describe("ingestJobUrl — generic JSON-LD adapter", () => {
  it("parses a JobPosting JSON-LD block", async () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "JobPosting",
        title: "Backend Engineer, New Grad",
        description: "<p>Work on distributed systems.</p>",
        datePosted: "2026-06-15",
        hiringOrganization: { name: "Acme" },
        jobLocation: { address: { addressLocality: "Austin", addressRegion: "TX" } },
      })}</script></head><body></body></html>`;
    mockFetch({ "https://acme.example.com/careers/backend": html });

    const posting = await ingestJobUrl("https://acme.example.com/careers/backend");
    expect(posting.companyName).toBe("Acme");
    expect(posting.title).toBe("Backend Engineer, New Grad");
    expect(posting.location).toBe("Austin, TX");
    expect(posting.description).toContain("distributed systems");
    expect(posting.isNewGrad).toBe(true); // "New Grad" in the title
    expect(posting.source).toBe("ingest:acme.example.com");
  });

  it("falls back to og/meta tags when no JSON-LD is present", async () => {
    const html = `<html><head>
      <meta property="og:title" content="Platform Engineer" />
      <meta property="og:description" content="5 years of experience required." />
      <meta property="og:site_name" content="Globex" />
    </head><body></body></html>`;
    mockFetch({ "https://jobs.globex.example/p/1": html });

    const posting = await ingestJobUrl("https://jobs.globex.example/p/1");
    expect(posting.title).toBe("Platform Engineer");
    expect(posting.companyName).toBe("Globex");
    expect(posting.requiredYearsMin).toBe(5);
  });
});

describe("ingestJobUrl — validation", () => {
  it("rejects non-https URLs", async () => {
    await expect(ingestJobUrl("http://example.com/job")).rejects.toThrow(/https/);
  });

  it("rejects malformed URLs", async () => {
    await expect(ingestJobUrl("not a url")).rejects.toThrow(/valid URL/);
  });
});
