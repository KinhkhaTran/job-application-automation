// The approval record and its validity check.
//
// This module is intentionally dependency-free (no crypto, no database, no
// Next.js) so both server route handlers and client components can reason
// about whether a packet is currently approved.
//
// Approval means one thing only: a human read this exact packet and said "I
// will apply with this". It is NOT a submission, and it never triggers one.

import type { HandoffDecision } from "./handoff";

export interface ApprovalRecord {
  /** The packet fingerprint that was approved. */
  fingerprint: string;
  /** The exact application URL that was approved. */
  url: string;
  approvedAt: string; // ISO
  /** Only ever a human; there is no automated approver. */
  approvedBy: "human-review";
}

/**
 * - `unapproved` — nobody has approved this packet yet.
 * - `stale` — an approval exists but no longer matches the packet (it was
 *   regenerated or edited, or the URL changed). Treated exactly like
 *   unapproved for gating; shown differently in the UI.
 * - `approved` — the approval matches the current fingerprint and URL.
 */
export type ApprovalState = "unapproved" | "stale" | "approved";

/** The subset of an application packet this gate needs. */
export interface ReviewablePacket {
  status: string;
  /** Fingerprint of the packet's current reviewable content. */
  fingerprint: string;
  handoff?: HandoffDecision;
  approval: ApprovalRecord | null;
}

export function approvalState(packet: ReviewablePacket): ApprovalState {
  const approval = packet.approval;
  if (!approval) return "unapproved";
  if (approval.fingerprint !== packet.fingerprint) return "stale";
  if (!packet.handoff || approval.url !== packet.handoff.url) return "stale";
  return "approved";
}

export function isApproved(packet: ReviewablePacket): boolean {
  return approvalState(packet) === "approved";
}

/**
 * Drop an approval that no longer matches the packet. Called wherever a packet
 * is (re)staged or edited, so an approval never survives a content change.
 */
export function invalidateStaleApproval<T extends ReviewablePacket>(packet: T): T {
  return approvalState(packet) === "approved" ? packet : { ...packet, approval: null };
}
