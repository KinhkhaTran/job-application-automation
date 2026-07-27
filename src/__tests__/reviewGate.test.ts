import { evaluateApproval, evaluateOpen } from "../lib/apply/review";
import {
  approvalState,
  isApproved,
  invalidateStaleApproval,
  type ApprovalRecord,
} from "../lib/apply/approval";
import { stagePacket, applyPacketEdits, type PacketContext } from "../lib/apply/packet";
import type { ApplicationPacket } from "../lib/data/types";

// The human-review gate. Two rules are enforced here and nowhere else:
//
//   1. The application URL is handed back only for a packet a human explicitly
//      approved, and only while that approval still matches the packet.
//   2. Approving is not submitting. Nothing in this path performs any network
//      access — evaluateOpen returns a string for the user to open themselves.

const ALLOWLIST = ["linear.app"];
const NOW = Date.parse("2026-07-26T12:00:00.000Z");

const CTX: PacketContext = {
  postingId: 42,
  company: "Linear",
  title: "Product Engineer (Entry Level)",
  url: "https://linear.app/careers/product-engineer",
  allowlist: ALLOWLIST,
};

const DRAFT = {
  resumeVersion: "resume-frontend-v3.pdf",
  coverLetter: "Dear Linear team, I would like to apply.",
  screeningAnswers: [
    { question: "Are you authorized to work in the US?", answer: "Yes." },
  ],
};

function staged(overrides: Partial<PacketContext> = {}): ApplicationPacket {
  return stagePacket({ ...DRAFT }, { ...CTX, ...overrides }, {
    status: "ready",
    preparedAt: "2026-07-26T10:00:00.000Z",
    submittedDate: null,
  });
}

/** Run a packet through an explicit human approval and return the approved packet. */
function approve(packet: ApplicationPacket, allowlist = ALLOWLIST): ApplicationPacket {
  const decision = evaluateApproval({
    packet,
    fingerprint: packet.fingerprint,
    url: packet.handoff!.url,
    allowlist,
    now: NOW,
  });
  if (!decision.ok) throw new Error(`expected approval to succeed: ${decision.error}`);
  return { ...packet, approval: decision.approval };
}

describe("unapproved packets are refused", () => {
  it("refuses to hand back the URL of a freshly staged packet", () => {
    const packet = staged();
    expect(packet.approval).toBeNull();
    expect(approvalState(packet)).toBe("unapproved");

    const result = evaluateOpen({
      packet,
      fingerprint: packet.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("not-approved");
    expect(result).not.toHaveProperty("url");
  });

  it("refuses when there is no packet at all", () => {
    for (const packet of [null, undefined]) {
      const result = evaluateOpen({
        packet,
        fingerprint: `v1:${"a".repeat(64)}`,
        allowlist: ALLOWLIST,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("no-packet");
    }
  });

  it("refuses a packet that is not ready for review", () => {
    const draft: ApplicationPacket = { ...staged(), status: "draft" };
    const result = evaluateOpen({
      packet: draft,
      fingerprint: draft.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("packet-not-ready");
  });

  it("refuses a packet already marked as submitted", () => {
    const submitted: ApplicationPacket = { ...approve(staged()), status: "submitted" };
    const result = evaluateOpen({
      packet: submitted,
      fingerprint: submitted.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("already-submitted");
  });

  it("refuses to open a packet whose displayed fingerprint is out of date", () => {
    const packet = approve(staged());
    const result = evaluateOpen({
      packet,
      fingerprint: `v1:${"b".repeat(64)}`,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("fingerprint-mismatch");
  });
});

describe("explicit human approval", () => {
  it("records the approval against the exact fingerprint and URL", () => {
    const packet = staged();
    const decision = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      allowlist: ALLOWLIST,
      now: NOW,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) throw new Error("unreachable");
    expect(decision.approval).toEqual({
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      approvedAt: "2026-07-26T12:00:00.000Z",
      approvedBy: "human-review",
    });
  });

  it("unlocks the manual handoff, which returns a URL and a not-submitted notice", () => {
    const packet = approve(staged());
    expect(isApproved(packet)).toBe(true);

    const result = evaluateOpen({
      packet,
      fingerprint: packet.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.url).toBe("https://linear.app/careers/product-engineer");
    expect(result.domain).toBe("linear.app");
    expect(result.approvedAt).toBe("2026-07-26T12:00:00.000Z");
    // The boundary is restated on every handoff.
    expect(result.notice).toMatch(/does not submit/i);
    expect(result.notice).toMatch(/your own browser/i);
  });

  it("refuses an approval that echoes a fingerprint the reviewer never saw", () => {
    const packet = staged();
    const decision = evaluateApproval({
      packet,
      fingerprint: `v1:${"c".repeat(64)}`,
      url: packet.handoff!.url,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error("unreachable");
    expect(decision.code).toBe("fingerprint-mismatch");
  });

  it("refuses an approval for a different URL on the same allowlisted host", () => {
    const packet = staged();
    const decision = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: "https://linear.app/careers/some-other-role",
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error("unreachable");
    expect(decision.code).toBe("url-mismatch");
  });
});

describe("approval goes stale when the packet changes", () => {
  it("is stale after a human edits the packet", () => {
    const approved = approve(staged());
    const edited = applyPacketEdits(
      approved,
      { coverLetter: "Rewritten by hand before applying." },
      CTX,
      Date.parse("2026-07-27T09:00:00.000Z")
    );

    // applyPacketEdits already drops the approval; this reconstructs the
    // worst case where a stale approval survived into the record anyway.
    const withStaleApproval: ApplicationPacket = {
      ...edited,
      approval: approved.approval,
    };
    expect(approvalState(withStaleApproval)).toBe("stale");
    expect(isApproved(withStaleApproval)).toBe(false);

    const result = evaluateOpen({
      packet: withStaleApproval,
      fingerprint: withStaleApproval.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("approval-stale");
  });

  it("is unapproved after a regeneration, even when the content is unchanged", () => {
    approve(staged());
    // Regenerating re-stages the packet, which always clears the approval.
    const regenerated = staged();
    expect(regenerated.approval).toBeNull();

    const result = evaluateOpen({
      packet: regenerated,
      fingerprint: regenerated.fingerprint,
      allowlist: ALLOWLIST,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("not-approved");
  });

  it("is stale when the approved URL no longer matches the packet URL", () => {
    const approved = approve(staged());
    const moved: ApplicationPacket = {
      ...approved,
      handoff: { ...approved.handoff!, url: "https://linear.app/careers/moved" },
    };
    expect(approvalState(moved)).toBe("stale");
  });

  it("drops a stale approval on read, and keeps a valid one", () => {
    const approved = approve(staged());
    expect(invalidateStaleApproval(approved).approval).toEqual(approved.approval);

    const stale: ApplicationPacket = {
      ...approved,
      fingerprint: `v1:${"d".repeat(64)}`,
    };
    expect(invalidateStaleApproval(stale).approval).toBeNull();
  });

  it("re-approving the edited packet works and binds to the new fingerprint", () => {
    const approved = approve(staged());
    const edited = applyPacketEdits(
      approved,
      { coverLetter: "Rewritten by hand before applying." },
      CTX,
      Date.parse("2026-07-27T09:00:00.000Z")
    );
    const reapproved = approve(edited);

    expect(reapproved.approval!.fingerprint).toBe(edited.fingerprint);
    expect(reapproved.approval!.fingerprint).not.toBe(approved.approval!.fingerprint);
    expect(isApproved(reapproved)).toBe(true);
  });
});

describe("allowlist refusal", () => {
  const OFF_LIST = "https://careers.evil-example.net/apply/1";

  it("refuses to approve a packet whose URL is not allowlisted", () => {
    const packet = staged({ url: OFF_LIST });
    expect(packet.handoff!.allowed).toBe(false);

    const decision = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error("unreachable");
    expect(decision.code).toBe("not-allowlisted");
    expect(decision.error).toContain("not on the apply allowlist");
  });

  it("refuses a lookalike suffix host", () => {
    const packet = staged({ url: "https://notlinear.app/careers/1" });
    const decision = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error("unreachable");
    expect(decision.code).toBe("not-allowlisted");
  });

  it("re-checks the allowlist at open time, so a removed domain revokes access", () => {
    const approved = approve(staged());
    // The allowlist config changed after the approval was recorded.
    const result = evaluateOpen({
      packet: approved,
      fingerprint: approved.fingerprint,
      allowlist: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("not-allowlisted");
  });

  it("refuses plain-http and private hosts even with a matching approval", () => {
    for (const url of [
      "http://linear.app/careers/1",
      "https://localhost:3000/careers/1",
      "https://192.168.1.20/careers/1",
    ]) {
      const packet = staged({ url });
      const withApproval: ApplicationPacket = {
        ...packet,
        approval: {
          fingerprint: packet.fingerprint,
          url: packet.handoff!.url,
          approvedAt: "2026-07-26T12:00:00.000Z",
          approvedBy: "human-review",
        },
      };
      const result = evaluateOpen({
        packet: withApproval,
        fingerprint: withApproval.fingerprint,
        allowlist: ALLOWLIST,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("not-allowlisted");
    }
  });
});

describe("credential-free URL handling through the review gate", () => {
  const CREDENTIALED = "https://applicant:hunter2@linear.app/careers/product-engineer";

  it("never stores, fingerprints, or explains a URL's embedded credentials", () => {
    const packet = staged({ url: CREDENTIALED });
    const serialized = JSON.stringify(packet);

    expect(packet.handoff!.url).toBe("https://linear.app/careers/product-engineer");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("applicant:");
    expect(packet.handoff!.reason).not.toContain("hunter2");
  });

  it("can only ever approve the credential-stripped form of the URL", () => {
    const packet = staged({ url: CREDENTIALED });
    // Staging flags the scraped URL so the reviewer sees why it was rewritten.
    expect(packet.handoff!.allowed).toBe(false);
    expect(packet.handoff!.reason).toContain("credentials");

    // Approving the credentialed URL is impossible: it is not what the packet
    // holds, so it fails the exact-URL match.
    const asScraped = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: CREDENTIALED,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(asScraped.ok).toBe(false);
    if (asScraped.ok) throw new Error("unreachable");
    expect(asScraped.code).toBe("url-mismatch");

    // The stripped URL is a plain allowlisted https URL, so it can be approved
    // — and the recorded approval carries no credentials.
    const stripped = evaluateApproval({
      packet,
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) throw new Error("unreachable");
    expect(stripped.approval.url).toBe("https://linear.app/careers/product-engineer");
    expect(stripped.approval.url).not.toContain("hunter2");
  });

  it("refuses at the gate when a credentialed URL reaches it directly", () => {
    const packet = staged();
    const tampered: ApplicationPacket = {
      ...packet,
      handoff: { ...packet.handoff!, url: CREDENTIALED },
    };
    const decision = evaluateApproval({
      packet: tampered,
      fingerprint: tampered.fingerprint,
      url: CREDENTIALED,
      allowlist: ALLOWLIST,
      now: NOW,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error("unreachable");
    expect(decision.code).toBe("not-allowlisted");
    expect(decision.error).toContain("credentials");
    expect(decision.error).not.toContain("hunter2");
  });

  it("marks the application URL as needing user input when it is not allowlisted", () => {
    const packet = staged({ url: CREDENTIALED });
    const urlField = packet.provenance.find((p) => p.field === "applicationUrl");
    expect(urlField?.needsUserInput).toBe(true);
    expect(urlField?.note).toContain("not on the apply allowlist");
  });
});
