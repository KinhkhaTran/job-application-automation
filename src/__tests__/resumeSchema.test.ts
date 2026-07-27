import { ParsedResumeSchema } from "@/lib/resume/schema";

const valid = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "",
  location: "London",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  summary: "Analytical engine enthusiast.",
  skills: ["Mathematics", "Algorithms"],
  education: [
    {
      school: "Self-taught",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      gpa: "",
    },
  ],
  experience: [
    {
      company: "Analytical Engine",
      title: "Programmer",
      location: "",
      startDate: "1842",
      endDate: "1843",
      description: "Wrote the first algorithm.",
    },
  ],
};

describe("ParsedResumeSchema", () => {
  test("accepts a well-formed extraction", () => {
    expect(ParsedResumeSchema.parse(valid).fullName).toBe("Ada Lovelace");
  });

  test("coerces null scalars to empty strings (LLMs emit null despite the prompt)", () => {
    const r = ParsedResumeSchema.parse({ ...valid, phone: null, location: null });
    expect(r.phone).toBe("");
    expect(r.location).toBe("");
  });

  test("coerces a null inside a nested entry to empty string", () => {
    const r = ParsedResumeSchema.parse({
      ...valid,
      education: [{ school: "MIT", degree: null }],
    });
    expect(r.education[0].degree).toBe("");
    expect(r.education[0].school).toBe("MIT");
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

  test("still requires the array keys to be present", () => {
    const { skills, ...missing } = valid;
    expect(ParsedResumeSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects a non-array skills value", () => {
    expect(
      ParsedResumeSchema.safeParse({ ...valid, skills: "TypeScript" }).success
    ).toBe(false);
  });
});
