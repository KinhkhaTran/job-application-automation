import {
  coerceListing,
  locationLabel,
  companyCareersUrl,
} from "@/lib/discovery/simplify";

const base = {
  source: "Simplify",
  category: "Software",
  company_name: "NVIDIA",
  id: "abc-123",
  title: "Software Engineer, New Grad",
  active: true,
  is_visible: true,
  date_posted: 1_700_000_000,
  url: "https://nvidia.wd5.myworkdayjobs.com/careers/job/JR123",
  locations: ["Santa Clara, CA", "Remote"],
  company_url: "https://simplify.jobs/c/NVIDIA",
  sponsorship: "Other",
  degrees: [],
};

describe("coerceListing", () => {
  test("accepts a valid active + visible listing", () => {
    const l = coerceListing(base);
    expect(l).not.toBeNull();
    expect(l?.companyName).toBe("NVIDIA");
    expect(l?.title).toBe("Software Engineer, New Grad");
    expect(l?.url).toBe(base.url);
    expect(l?.locations).toEqual(["Santa Clara, CA", "Remote"]);
  });

  test("drops inactive listings", () => {
    expect(coerceListing({ ...base, active: false })).toBeNull();
  });

  test("drops hidden listings", () => {
    expect(coerceListing({ ...base, is_visible: false })).toBeNull();
  });

  test("drops listings missing required fields", () => {
    expect(coerceListing({ ...base, company_name: "" })).toBeNull();
    expect(coerceListing({ ...base, title: null })).toBeNull();
    expect(coerceListing({ ...base, id: undefined })).toBeNull();
  });

  test("rejects non-http(s) urls", () => {
    expect(coerceListing({ ...base, url: "ftp://example.com/x" })).toBeNull();
    expect(coerceListing({ ...base, url: "not a url" })).toBeNull();
  });

  test("tolerates a missing/invalid locations array", () => {
    const l = coerceListing({ ...base, locations: "Santa Clara" });
    expect(l?.locations).toEqual([]);
  });

  test("rejects non-object input", () => {
    expect(coerceListing(null)).toBeNull();
    expect(coerceListing("nope")).toBeNull();
    expect(coerceListing(42)).toBeNull();
  });
});

describe("locationLabel", () => {
  test("joins multiple locations", () => {
    const l = coerceListing(base)!;
    expect(locationLabel(l)).toBe("Santa Clara, CA; Remote");
  });

  test("returns null when there are no locations", () => {
    const l = coerceListing({ ...base, locations: [] })!;
    expect(locationLabel(l)).toBeNull();
  });
});

describe("companyCareersUrl", () => {
  test("prefers the Simplify company page", () => {
    const l = coerceListing(base)!;
    expect(companyCareersUrl(l)).toBe("https://simplify.jobs/c/NVIDIA");
  });

  test("falls back to the posting origin", () => {
    const l = coerceListing({ ...base, company_url: null })!;
    expect(companyCareersUrl(l)).toBe("https://nvidia.wd5.myworkdayjobs.com");
  });
});
