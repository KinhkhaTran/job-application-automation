import {
  isValidTransition,
  getValidNextStatuses,
  type PostingStatus,
} from "@/lib/scrapers/statusTransitions";

describe("isValidTransition", () => {
  test("new → reviewing is valid", () => {
    expect(isValidTransition("new", "reviewing")).toBe(true);
  });

  test("new → skipped is valid", () => {
    expect(isValidTransition("new", "skipped")).toBe(true);
  });

  test("new → applied is invalid (must review first)", () => {
    expect(isValidTransition("new", "applied")).toBe(false);
  });

  test("new → offer is invalid", () => {
    expect(isValidTransition("new", "offer")).toBe(false);
  });

  test("reviewing → applied is valid", () => {
    expect(isValidTransition("reviewing", "applied")).toBe(true);
  });

  test("reviewing → skipped is valid", () => {
    expect(isValidTransition("reviewing", "skipped")).toBe(true);
  });

  test("reviewing → new is valid (un-review)", () => {
    expect(isValidTransition("reviewing", "new")).toBe(true);
  });

  test("applied → interviewing is valid", () => {
    expect(isValidTransition("applied", "interviewing")).toBe(true);
  });

  test("applied → rejected is valid", () => {
    expect(isValidTransition("applied", "rejected")).toBe(true);
  });

  test("applied → ghosted is valid", () => {
    expect(isValidTransition("applied", "ghosted")).toBe(true);
  });

  test("applied → new is invalid (can't un-apply)", () => {
    expect(isValidTransition("applied", "new")).toBe(false);
  });

  test("interviewing → offer is valid", () => {
    expect(isValidTransition("interviewing", "offer")).toBe(true);
  });

  test("interviewing → rejected is valid", () => {
    expect(isValidTransition("interviewing", "rejected")).toBe(true);
  });

  test("interviewing → ghosted is valid", () => {
    expect(isValidTransition("interviewing", "ghosted")).toBe(true);
  });

  test("skipped → new allows un-skipping", () => {
    expect(isValidTransition("skipped", "new")).toBe(true);
  });

  test("rejected is a terminal state — no valid transitions", () => {
    const others: PostingStatus[] = [
      "new", "reviewing", "applied", "interviewing", "offer", "skipped", "ghosted",
    ];
    for (const s of others) {
      expect(isValidTransition("rejected", s)).toBe(false);
    }
  });

  test("offer is a terminal state — no valid transitions", () => {
    const others: PostingStatus[] = [
      "new", "reviewing", "applied", "interviewing", "rejected", "skipped", "ghosted",
    ];
    for (const s of others) {
      expect(isValidTransition("offer", s)).toBe(false);
    }
  });

  test("ghosted is a terminal state — no valid transitions", () => {
    const others: PostingStatus[] = [
      "new", "reviewing", "applied", "interviewing", "rejected", "skipped", "offer",
    ];
    for (const s of others) {
      expect(isValidTransition("ghosted", s)).toBe(false);
    }
  });
});

describe("getValidNextStatuses", () => {
  test("returns reviewing and skipped for 'new'", () => {
    const next = getValidNextStatuses("new");
    expect(next).toContain("reviewing");
    expect(next).toContain("skipped");
    expect(next).not.toContain("applied");
  });

  test("returns empty array for 'rejected'", () => {
    expect(getValidNextStatuses("rejected")).toHaveLength(0);
  });

  test("returns empty array for 'offer'", () => {
    expect(getValidNextStatuses("offer")).toHaveLength(0);
  });

  test("returns empty array for 'ghosted'", () => {
    expect(getValidNextStatuses("ghosted")).toHaveLength(0);
  });

  test("returns a new array each call (no shared state)", () => {
    const a = getValidNextStatuses("new");
    const b = getValidNextStatuses("new");
    expect(a).toEqual(b);
    a.push("offer" as PostingStatus);
    expect(b).not.toContain("offer");
  });
});
