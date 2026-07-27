import {
  profileFromResume,
  buildAutofillFields,
  type ApplicantProfile,
} from "@/lib/autofill/fieldMap";
import type { ResumeData } from "@/lib/data/types";

const RESUME: ResumeData = {
  name: "Ada Lovelace",
  headline: "SWE",
  location: "London, UK",
  email: "ada@example.com",
  website: "ada.dev",
  github: "github.com/ada",
  linkedin: "https://linkedin.com/in/ada",
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

describe("profileFromResume", () => {
  it("splits the name and normalizes bare links to https", () => {
    const p = profileFromResume(RESUME);
    expect(p.firstName).toBe("Ada");
    expect(p.lastName).toBe("Lovelace");
    expect(p.fullName).toBe("Ada Lovelace");
    expect(p.website).toBe("https://ada.dev");
    expect(p.github).toBe("https://github.com/ada");
    expect(p.linkedin).toBe("https://linkedin.com/in/ada"); // already https, unchanged
  });

  it("keeps a single-word name's last name empty", () => {
    const p = profileFromResume({ ...RESUME, name: "Cher" });
    expect(p.firstName).toBe("Cher");
    expect(p.lastName).toBe("");
  });
});

describe("buildAutofillFields", () => {
  it("includes only fields with a real value", () => {
    const profile: ApplicantProfile = {
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      location: "London, UK",
      linkedin: "https://linkedin.com/in/ada",
      github: null,
      website: null,
    };
    const keys = buildAutofillFields(profile).map((f) => f.key);
    expect(keys).toContain("firstName");
    expect(keys).toContain("email");
    expect(keys).toContain("location");
    expect(keys).toContain("linkedin");
    expect(keys).not.toContain("phone"); // null
    expect(keys).not.toContain("github"); // null
    expect(keys).not.toContain("website"); // null
  });

  it("gives every field non-empty locator keywords", () => {
    const fields = buildAutofillFields(profileFromResume(RESUME));
    for (const f of fields) {
      expect(f.keywords.length).toBeGreaterThan(0);
      expect(f.value.trim().length).toBeGreaterThan(0);
    }
  });
});
