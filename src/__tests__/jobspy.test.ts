import {
  coercePosting,
  companyCareersUrl,
  salaryBlurb,
  fetchJobspyPostings,
  type JobspyPosting,
} from "@/lib/discovery/jobspy";
import { classifyPosting } from "@/lib/scrapers/classifier";

const valid = {
  site: "indeed",
  title: "Software Engineer, New Grad",
  company: "Acme",
  companyUrl: "https://acme.example.com",
  location: "Remote",
  jobUrl: "https://indeed.com/viewjob?jk=abc",
  description: "0-1 years experience. New grads welcome.",
  datePosted: "2026-07-25",
  isRemote: true,
  minAmount: 120000,
  maxAmount: 150000,
  currency: "USD",
  interval: "yearly",
  searchTerm: "software engineer new grad",
};

describe("coercePosting (external-data validation)", () => {
  test("passes a well-formed record through", () => {
    expect(coercePosting(valid)).toMatchObject({
      title: "Software Engineer, New Grad",
      company: "Acme",
      jobUrl: "https://indeed.com/viewjob?jk=abc",
      minAmount: 120000,
    });
  });

  test("empty strings become null", () => {
    const p = coercePosting({ ...valid, company: "", location: "   " });
    expect(p?.company).toBeNull();
    expect(p?.location).toBeNull();
  });

  test("non-finite / non-number amounts become null", () => {
    const p = coercePosting({ ...valid, minAmount: NaN, maxAmount: "150k" });
    expect(p?.minAmount).toBeNull();
    expect(p?.maxAmount).toBeNull();
  });

  test("non-boolean isRemote becomes null", () => {
    const p = coercePosting({ ...valid, isRemote: "yes" });
    expect(p?.isRemote).toBeNull();
  });

  test("rejects non-objects", () => {
    expect(coercePosting(null)).toBeNull();
    expect(coercePosting("nope")).toBeNull();
    expect(coercePosting(42)).toBeNull();
  });
});

describe("companyCareersUrl", () => {
  test("prefers companyUrl", () => {
    expect(companyCareersUrl(coercePosting(valid) as JobspyPosting)).toBe(
      "https://acme.example.com"
    );
  });

  test("falls back to the job URL origin", () => {
    const p = coercePosting({ ...valid, companyUrl: "" }) as JobspyPosting;
    expect(companyCareersUrl(p)).toBe("https://indeed.com");
  });
});

describe("salaryBlurb", () => {
  test("formats a range with currency and interval", () => {
    expect(salaryBlurb(coercePosting(valid) as JobspyPosting)).toBe(
      "USD120000–150000/yearly"
    );
  });

  test("returns null when no amounts are present", () => {
    const p = coercePosting({ ...valid, minAmount: null, maxAmount: null }) as JobspyPosting;
    expect(salaryBlurb(p)).toBeNull();
  });
});

describe("classification of a JobSpy posting", () => {
  test("new-grad title + 0-1 years is flagged", () => {
    const p = coercePosting(valid) as JobspyPosting;
    const { isNewGrad, requiredYearsMin } = classifyPosting(p.title!, p.description);
    expect(isNewGrad).toBe(true);
    // "0-1 years experience" flags new-grad; the extractor still reads the "1".
    expect(requiredYearsMin).toBe(1);
  });

  test("senior posting extracts the years requirement", () => {
    const { isNewGrad, requiredYearsMin } = classifyPosting(
      "Senior Software Engineer",
      "Requires a minimum of 5 years experience."
    );
    expect(isNewGrad).toBe(false);
    expect(requiredYearsMin).toBe(5);
  });
});

describe("fetchJobspyPostings", () => {
  const OLD_ENV = process.env;
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      JOBSPY_FUNCTION_URL: "https://example.test/api/jobspy",
      JOBSPY_SECRET: "s3cret",
    };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  test("sends the config + bearer auth and filters invalid postings", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        postings: [valid, { garbage: true }, { ...valid, jobUrl: "" }],
      }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const out = await fetchJobspyPostings(
      [{ search: "swe", location: "US", resultsWanted: 10, hoursOld: 72 }],
      ["indeed", "google"],
      "USA"
    );

    // Only the fully-valid record survives coercion.
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Software Engineer, New Grad");

    const [calledUrl, init] = (fetchMock as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe("https://example.test/api/jobspy");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    const body = JSON.parse(init.body);
    expect(body.sites).toEqual(["indeed", "google"]);
    expect(body.countryIndeed).toBe("USA");
  });

  test("throws on a non-OK response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "boom",
    })) as unknown as typeof fetch;

    await expect(
      fetchJobspyPostings(
        [{ search: "swe", location: "US", resultsWanted: 10, hoursOld: 72 }],
        ["indeed"],
        "USA"
      )
    ).rejects.toThrow(/500/);
  });

  test("throws when no secret is configured", async () => {
    delete process.env.JOBSPY_SECRET;
    delete process.env.CRON_SECRET;
    await expect(
      fetchJobspyPostings(
        [{ search: "swe", location: "US", resultsWanted: 10, hoursOld: 72 }],
        ["indeed"],
        "USA"
      )
    ).rejects.toThrow(/secret/i);
  });
});
