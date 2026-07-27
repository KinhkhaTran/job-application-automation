import {
  FINGERPRINT_VERSION,
  canonicalizePacket,
  computePacketFingerprint,
  isWellFormedFingerprint,
  type FingerprintInput,
} from "../lib/apply/fingerprint";
import { stagePacket, applyPacketEdits, hasEdits } from "../lib/apply/packet";
import type { PacketContext } from "../lib/apply/packet";

// The fingerprint is the whole basis of the review gate: an approval is only
// valid for the exact content it was recorded against. These tests pin both
// halves of that contract — identical content must produce an identical
// fingerprint (stability), and any change to reviewable content must produce a
// different one (sensitivity).

const BASE: FingerprintInput = {
  postingId: 42,
  company: "Linear",
  title: "Product Engineer (Entry Level)",
  applicationUrl: "https://linear.app/careers/product-engineer",
  resumeVersion: "resume-frontend-v3.pdf",
  coverLetter: "Dear Linear team,\n\nI would love to work on the issue tracker.",
  screeningAnswers: [
    { question: "Are you authorized to work in the US?", answer: "Yes." },
    { question: "Will you require sponsorship?", answer: "No." },
  ],
  needsUserInput: ["coverLetter", "screeningAnswers[1]"],
};

const CTX: PacketContext = {
  postingId: 42,
  company: "Linear",
  title: "Product Engineer (Entry Level)",
  url: "https://linear.app/careers/product-engineer",
  allowlist: ["linear.app"],
};

const META = {
  status: "ready" as const,
  preparedAt: "2026-07-26T10:00:00.000Z",
  submittedDate: null,
};

const DRAFT = {
  resumeVersion: "resume-frontend-v3.pdf",
  coverLetter: "Dear Linear team, I would love to work on the issue tracker.",
  screeningAnswers: [
    { question: "Are you authorized to work in the US?", answer: "Yes." },
  ],
};

describe("computePacketFingerprint — shape", () => {
  it("returns a versioned sha256 hex digest", () => {
    const fp = computePacketFingerprint(BASE);
    expect(fp).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(fp.startsWith(`${FINGERPRINT_VERSION}:`)).toBe(true);
  });

  it("accepts its own output as well-formed", () => {
    expect(isWellFormedFingerprint(computePacketFingerprint(BASE))).toBe(true);
  });

  it("rejects anything that is not a v1 hex fingerprint", () => {
    for (const bad of [
      "",
      "v1:",
      "v1:notahex",
      `v1:${"a".repeat(63)}`,
      `v1:${"a".repeat(65)}`,
      `v1:${"A".repeat(64)}`, // hex must be lowercase
      `v2:${"a".repeat(64)}`,
      "a".repeat(64),
      42,
      null,
      undefined,
      { fingerprint: `v1:${"a".repeat(64)}` },
    ]) {
      expect(isWellFormedFingerprint(bad)).toBe(false);
    }
  });
});

describe("computePacketFingerprint — stability", () => {
  it("is identical for repeated calls on the same content", () => {
    expect(computePacketFingerprint(BASE)).toBe(computePacketFingerprint(BASE));
  });

  it("is identical for an equal-but-distinct input object", () => {
    const clone: FingerprintInput = {
      ...BASE,
      screeningAnswers: BASE.screeningAnswers.map((qa) => ({ ...qa })),
      needsUserInput: [...BASE.needsUserInput],
    };
    expect(computePacketFingerprint(clone)).toBe(computePacketFingerprint(BASE));
  });

  it("does not depend on the key order of the input object", () => {
    // Built literally in reverse declaration order: canonicalizePacket reads an
    // explicit field list, so JSON key order must not leak into the digest.
    const reordered: FingerprintInput = {
      needsUserInput: [...BASE.needsUserInput],
      screeningAnswers: BASE.screeningAnswers.map((qa) => ({ ...qa })),
      coverLetter: BASE.coverLetter,
      resumeVersion: BASE.resumeVersion,
      applicationUrl: BASE.applicationUrl,
      title: BASE.title,
      company: BASE.company,
      postingId: BASE.postingId,
    };
    expect(canonicalizePacket(reordered)).toBe(canonicalizePacket(BASE));
    expect(computePacketFingerprint(reordered)).toBe(computePacketFingerprint(BASE));
  });

  it("does not depend on the order of the needs-user-input list", () => {
    const shuffled: FingerprintInput = {
      ...BASE,
      needsUserInput: [...BASE.needsUserInput].reverse(),
    };
    expect(computePacketFingerprint(shuffled)).toBe(computePacketFingerprint(BASE));
  });

  it("re-staging byte-identical content reproduces the same fingerprint", () => {
    const first = stagePacket(DRAFT, CTX, META);
    const second = stagePacket(
      {
        resumeVersion: DRAFT.resumeVersion,
        coverLetter: DRAFT.coverLetter,
        screeningAnswers: DRAFT.screeningAnswers.map((qa) => ({ ...qa })),
      },
      { ...CTX, allowlist: [...CTX.allowlist] },
      { ...META, preparedAt: "2027-01-01T00:00:00.000Z" }
    );
    // preparedAt is deliberately excluded from the digest.
    expect(second.fingerprint).toBe(first.fingerprint);
  });
});

describe("computePacketFingerprint — sensitivity", () => {
  const baseline = computePacketFingerprint(BASE);

  const mutations: [string, Partial<FingerprintInput>][] = [
    ["a different posting id", { postingId: 43 }],
    ["a different company", { company: "Linear Inc." }],
    ["a different title", { title: "Product Engineer" }],
    [
      "a different application URL",
      { applicationUrl: "https://linear.app/careers/product-engineer-2" },
    ],
    ["a different résumé version", { resumeVersion: "resume-backend-v3.pdf" }],
    ["an edited cover letter", { coverLetter: `${BASE.coverLetter} Thanks!` }],
    ["one extra space in the cover letter", { coverLetter: `${BASE.coverLetter} ` }],
    [
      "an edited screening answer",
      {
        screeningAnswers: [
          { question: "Are you authorized to work in the US?", answer: "Yes." },
          { question: "Will you require sponsorship?", answer: "Yes." },
        ],
      },
    ],
    [
      "a reworded screening question",
      {
        screeningAnswers: [
          { question: "Authorized to work in the US?", answer: "Yes." },
          { question: "Will you require sponsorship?", answer: "No." },
        ],
      },
    ],
    [
      "reordered screening answers",
      { screeningAnswers: [...BASE.screeningAnswers].reverse() },
    ],
    ["a removed screening answer", { screeningAnswers: [BASE.screeningAnswers[0]] }],
    ["a newly flagged field", { needsUserInput: [...BASE.needsUserInput, "resumeVersion"] }],
    ["a resolved flagged field", { needsUserInput: ["coverLetter"] }],
  ];

  it.each(mutations)("changes for %s", (_label, patch) => {
    expect(computePacketFingerprint({ ...BASE, ...patch })).not.toBe(baseline);
  });
});

describe("stagePacket and applyPacketEdits", () => {
  it("never returns a pre-approved packet", () => {
    expect(stagePacket(DRAFT, CTX, META).approval).toBeNull();
  });

  it("fingerprints the normalized URL, not the raw one", () => {
    const raw = stagePacket(DRAFT, CTX, META);
    const tracked = stagePacket(DRAFT, {
      ...CTX,
      url: `${CTX.url}?utm_source=newsletter&gclid=abc#apply`,
    }, META);
    expect(tracked.handoff?.url).toBe(raw.handoff?.url);
    expect(tracked.fingerprint).toBe(raw.fingerprint);
  });

  it("changes the fingerprint and drops the approval on an edit", () => {
    const staged = stagePacket(DRAFT, CTX, META);
    const approved = {
      ...staged,
      approval: {
        fingerprint: staged.fingerprint,
        url: staged.handoff!.url,
        approvedAt: "2026-07-26T11:00:00.000Z",
        approvedBy: "human-review" as const,
      },
    };

    const edited = applyPacketEdits(
      approved,
      { coverLetter: "A completely rewritten cover letter." },
      CTX,
      Date.parse("2026-07-27T09:00:00.000Z")
    );

    expect(edited.fingerprint).not.toBe(staged.fingerprint);
    expect(edited.approval).toBeNull();
    expect(edited.coverLetter).toBe("A completely rewritten cover letter.");
    // Untouched fields survive the edit.
    expect(edited.resumeVersion).toBe(staged.resumeVersion);
  });

  it("keeps the fingerprint when an edit sets a field to its current value", () => {
    const staged = stagePacket(DRAFT, CTX, META);
    const edited = applyPacketEdits(
      staged,
      { coverLetter: DRAFT.coverLetter },
      CTX,
      Date.parse("2026-07-27T09:00:00.000Z")
    );
    expect(edited.fingerprint).toBe(staged.fingerprint);
    // …but the approval is still dropped, so it must be re-approved anyway.
    expect(edited.approval).toBeNull();
  });

  it("recognizes which edit payloads actually change something", () => {
    expect(hasEdits({})).toBe(false);
    expect(hasEdits({ coverLetter: "" })).toBe(true);
    expect(hasEdits({ resumeVersion: "resume-v1.pdf" })).toBe(true);
    expect(hasEdits({ screeningAnswers: [] })).toBe(true);
  });
});
