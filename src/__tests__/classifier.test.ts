import { classifyPosting } from "@/lib/scrapers/classifier";

describe("classifyPosting — isNewGrad detection", () => {
  test("detects 'New Grad' in title", () => {
    expect(classifyPosting("Software Engineer, New Grad", null).isNewGrad).toBe(true);
  });

  test("detects 'new graduate' in title", () => {
    expect(classifyPosting("Software Engineer — New Graduate", null).isNewGrad).toBe(true);
  });

  test("detects 'entry level' in title", () => {
    expect(classifyPosting("Entry Level Backend Engineer", null).isNewGrad).toBe(true);
  });

  test("detects 'entry-level' (hyphenated) in title", () => {
    expect(classifyPosting("Entry-Level Backend Engineer", null).isNewGrad).toBe(true);
  });

  test("detects 'early career' in title", () => {
    expect(classifyPosting("Early Career Software Engineer", null).isNewGrad).toBe(true);
  });

  test("detects 'campus hire' in title", () => {
    expect(classifyPosting("Campus Hire — SWE", null).isNewGrad).toBe(true);
  });

  test("detects 'new grad' in description when title is neutral", () => {
    const result = classifyPosting(
      "Software Engineer",
      "We welcome new graduates to apply for this role."
    );
    expect(result.isNewGrad).toBe(true);
  });

  test("detects 'class of 2026' in description", () => {
    const result = classifyPosting(
      "Software Engineer",
      "Class of 2026 graduates are encouraged to apply."
    );
    expect(result.isNewGrad).toBe(true);
  });

  test("detects '0-1 years' pattern in description", () => {
    const result = classifyPosting(
      "Software Engineer",
      "Ideal for candidates with 0-1 years of experience."
    );
    expect(result.isNewGrad).toBe(true);
  });

  test("returns false for senior roles", () => {
    const result = classifyPosting(
      "Senior Software Engineer",
      "We need a senior engineer to lead our platform team."
    );
    expect(result.isNewGrad).toBe(false);
  });

  test("returns false for staff roles", () => {
    expect(classifyPosting("Staff Engineer, Infrastructure", null).isNewGrad).toBe(false);
  });

  test("returns false for principal roles", () => {
    expect(classifyPosting("Principal Software Engineer", null).isNewGrad).toBe(false);
  });

  test("returns false with no matching signal anywhere", () => {
    const result = classifyPosting(
      "Software Engineer",
      "Build distributed systems at scale. Collaborate with cross-functional teams."
    );
    expect(result.isNewGrad).toBe(false);
  });
});

describe("classifyPosting — requiredYearsMin extraction", () => {
  test("extracts years from '5+ years of experience'", () => {
    const result = classifyPosting(
      "Software Engineer",
      "Requires 5+ years of experience."
    );
    expect(result.requiredYearsMin).toBe(5);
  });

  test("extracts minimum when multiple year mentions exist", () => {
    const result = classifyPosting(
      "Software Engineer",
      "3+ years of experience preferred; minimum of 2 years required."
    );
    expect(result.requiredYearsMin).toBe(2);
  });

  test("extracts years from 'at least N years'", () => {
    const result = classifyPosting(
      "Engineer",
      "At least 3 years of professional experience required."
    );
    expect(result.requiredYearsMin).toBe(3);
  });

  test("extracts years from 'minimum of N years'", () => {
    const result = classifyPosting(
      "Engineer",
      "Minimum of 4 years of relevant experience."
    );
    expect(result.requiredYearsMin).toBe(4);
  });

  test("returns null when no years mentioned", () => {
    const result = classifyPosting(
      "Software Engineer",
      "Join our team and help build great products."
    );
    expect(result.requiredYearsMin).toBeNull();
  });

  test("returns null for null description", () => {
    expect(classifyPosting("Senior Software Engineer", null).requiredYearsMin).toBeNull();
  });

  test("returns null for empty description", () => {
    expect(classifyPosting("Software Engineer", "").requiredYearsMin).toBeNull();
  });
});
