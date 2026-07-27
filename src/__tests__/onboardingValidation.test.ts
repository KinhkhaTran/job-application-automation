import { OnboardingInputSchema } from "@/lib/profile/schema";

const base = {
  fullName: "Grace Hopper",
  email: "grace@example.com",
  authorizedToWork: true,
  requiresSponsorship: false,
};

describe("OnboardingInputSchema", () => {
  test("accepts the minimal required fields and defaults arrays", () => {
    const r = OnboardingInputSchema.parse(base);
    expect(r.skills).toEqual([]);
    expect(r.education).toEqual([]);
    expect(r.experience).toEqual([]);
    expect(r.willingToRelocate).toBe(false);
  });

  test("requires a full name", () => {
    const r = OnboardingInputSchema.safeParse({ ...base, fullName: "" });
    expect(r.success).toBe(false);
  });

  test("requires a valid email", () => {
    expect(
      OnboardingInputSchema.safeParse({ ...base, email: "not-an-email" }).success
    ).toBe(false);
  });

  test("requires the work-authorization booleans", () => {
    const { authorizedToWork, ...missing } = base;
    expect(OnboardingInputSchema.safeParse(missing).success).toBe(false);
  });

  test("treats blank optional URLs as undefined", () => {
    const r = OnboardingInputSchema.parse({ ...base, linkedinUrl: "" });
    expect(r.linkedinUrl).toBeUndefined();
  });

  test("rejects a malformed URL", () => {
    expect(
      OnboardingInputSchema.safeParse({ ...base, githubUrl: "http://" }).success
    ).toBe(false);
  });

  test("validates nested education/experience entries", () => {
    const r = OnboardingInputSchema.safeParse({
      ...base,
      education: [{ degree: "B.S." }], // missing school
    });
    expect(r.success).toBe(false);
  });

  test("accepts a complete payload with résumé metadata", () => {
    const r = OnboardingInputSchema.parse({
      ...base,
      skills: ["COBOL"],
      education: [{ school: "Yale", degree: "PhD" }],
      experience: [{ company: "US Navy", title: "Rear Admiral", isCurrent: true }],
      resume: {
        fileName: "grace.pdf",
        storagePath: "uid/abc-grace.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12345,
        rawText: null,
      },
    });
    expect(r.experience[0].isCurrent).toBe(true);
    expect(r.resume?.fileName).toBe("grace.pdf");
  });
});
