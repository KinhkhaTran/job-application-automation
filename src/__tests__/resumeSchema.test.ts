import { ParsedResumeSchema } from "@/lib/resume/schema";

const valid = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  location: "London",
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  summary: "Analytical engine enthusiast.",
  skills: ["Mathematics", "Algorithms"],
  education: [
    {
      school: "Self-taught",
      degree: null,
      fieldOfStudy: null,
      startDate: null,
      endDate: null,
      gpa: null,
    },
  ],
  experience: [
    {
      company: "Analytical Engine",
      title: "Programmer",
      location: null,
      startDate: "1842",
      endDate: "1843",
      description: "Wrote the first algorithm.",
    },
  ],
};

describe("ParsedResumeSchema", () => {
  test("accepts a well-formed extraction with nulls", () => {
    expect(ParsedResumeSchema.parse(valid).fullName).toBe("Ada Lovelace");
  });

  test("accepts empty skills/education/experience arrays", () => {
    const r = ParsedResumeSchema.parse({
      ...valid,
      skills: [],
      education: [],
      experience: [],
    });
    expect(r.education).toEqual([]);
  });

  test("rejects when a required key is missing", () => {
    const { email, ...missing } = valid;
    expect(ParsedResumeSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects when an education entry lacks a school", () => {
    const bad = {
      ...valid,
      education: [{ degree: null }],
    };
    expect(ParsedResumeSchema.safeParse(bad).success).toBe(false);
  });

  test("rejects a non-array skills value", () => {
    expect(
      ParsedResumeSchema.safeParse({ ...valid, skills: "TypeScript" }).success
    ).toBe(false);
  });
});
