// The human-review gate.
//
// Two decisions live here, both pure functions over a staged packet:
//
//   evaluateApproval — may this exact packet be recorded as human-approved?
//   evaluateOpen     — may the application URL be handed back to the user?
//
// "Open" returns a URL and nothing else. Nothing in this codebase fetches,
// fills, or submits that URL: the user opens it in their own browser and
// applies themselves. Approval is not submission.

import { evaluateHandoff } from "./handoff";
import { approvalState, type ApprovalRecord, type ReviewablePacket } from "./approval";

export type RefusalCode =
  | "not-found"
  | "no-packet"
  | "packet-not-ready"
  | "already-submitted"
  | "no-url"
  | "fingerprint-mismatch"
  | "url-mismatch"
  | "not-allowlisted"
  | "not-approved"
  | "approval-stale";

export interface Refusal {
  ok: false;
  code: RefusalCode;
  error: string;
}

export interface ApprovalOk {
  ok: true;
  approval: ApprovalRecord;
}

export interface OpenOk {
  ok: true;
  /** The exact allowlisted URL to open manually. Never fetched by the server. */
  url: string;
  domain: string | null;
  approvedAt: string;
  /** Restated on every handoff so the boundary is never ambiguous. */
  notice: string;
}

const NOT_SUBMISSION_NOTICE =
  "Open this URL in your own browser and submit the application yourself. " +
  "Approval records your review; it does not submit anything.";

function refuse(code: RefusalCode, error: string): Refusal {
  return { ok: false, code, error };
}

/** Checks shared by approval and handoff: a ready packet with an allowlisted URL. */
function checkPacket(
  packet: ReviewablePacket | null | undefined,
  allowlist: string[]
): Refusal | { ok: true; url: string; domain: string | null } {
  if (!packet) {
    return refuse("no-packet", "No application packet is staged for this posting.");
  }
  if (packet.status === "submitted") {
    return refuse(
      "already-submitted",
      "This application is already marked as submitted."
    );
  }
  if (packet.status !== "ready") {
    return refuse(
      "packet-not-ready",
      `Packet status is "${packet.status}"; only a "ready" packet can be reviewed.`
    );
  }
  if (!packet.handoff || !packet.handoff.url) {
    return refuse("no-url", "The packet has no application URL to review.");
  }

  // Re-evaluate the allowlist here rather than trusting the stored decision:
  // the allowlist config may have changed since the packet was staged.
  const decision = evaluateHandoff(packet.handoff.url, allowlist);
  if (!decision.allowed) {
    return refuse("not-allowlisted", `Refused: ${decision.reason}`);
  }
  return { ok: true, url: decision.url, domain: decision.domain };
}

export interface ApprovalInput {
  packet: ReviewablePacket | null | undefined;
  /** Fingerprint the reviewer saw. Must equal the packet's current fingerprint. */
  fingerprint: string;
  /** URL the reviewer saw. Must equal the packet's current application URL. */
  url: string;
  allowlist: string[];
  now: number;
}

/**
 * Decide whether to record an explicit human approval. The caller must echo
 * back the exact fingerprint and URL that were displayed, so approving a
 * packet that changed underneath the reviewer is impossible.
 */
export function evaluateApproval(input: ApprovalInput): ApprovalOk | Refusal {
  const base = checkPacket(input.packet, input.allowlist);
  if (!base.ok) return base;
  const packet = input.packet!;

  if (input.fingerprint !== packet.fingerprint) {
    return refuse(
      "fingerprint-mismatch",
      "The packet changed since it was displayed. Re-read the current packet and approve again."
    );
  }
  // The normalized URL must match exactly — not by host, not by prefix.
  if (input.url !== packet.handoff!.url) {
    return refuse(
      "url-mismatch",
      "The approved URL does not match the packet's current application URL."
    );
  }

  return {
    ok: true,
    approval: {
      fingerprint: packet.fingerprint,
      url: packet.handoff!.url,
      approvedAt: new Date(input.now).toISOString(),
      approvedBy: "human-review",
    },
  };
}

export interface OpenInput {
  packet: ReviewablePacket | null | undefined;
  /** Fingerprint the client is displaying; guards against a stale UI. */
  fingerprint: string;
  allowlist: string[];
}

/**
 * Decide whether to return the application URL for manual opening. Refuses
 * unless a current, matching human approval exists. Returns a URL only — this
 * function performs no network access of any kind.
 */
export function evaluateOpen(input: OpenInput): OpenOk | Refusal {
  const base = checkPacket(input.packet, input.allowlist);
  if (!base.ok) return base;
  const packet = input.packet!;

  if (input.fingerprint !== packet.fingerprint) {
    return refuse(
      "fingerprint-mismatch",
      "The packet changed since it was displayed. Reload the packet before opening it."
    );
  }

  const state = approvalState(packet);
  if (state === "unapproved") {
    return refuse(
      "not-approved",
      "This packet has not been approved yet. Review it and approve before opening the posting."
    );
  }
  if (state === "stale") {
    return refuse(
      "approval-stale",
      "The previous approval no longer matches this packet. Review the current packet and approve again."
    );
  }

  return {
    ok: true,
    url: packet.handoff!.url,
    domain: packet.handoff!.domain,
    approvedAt: packet.approval!.approvedAt,
    notice: NOT_SUBMISSION_NOTICE,
  };
}
