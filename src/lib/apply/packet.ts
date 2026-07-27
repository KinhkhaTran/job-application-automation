// Staging an application packet.
//
// Every packet that reaches the review UI goes through stagePacket, which
// attaches the three things the review gate depends on: the normalized+checked
// application URL (handoff), the per-field provenance, and the fingerprint of
// the reviewable content.
//
// Staging always clears any prior approval. Regenerating or editing a packet
// therefore always requires a fresh human approval, even in the edge case
// where the regenerated content is byte-identical.

import { evaluateHandoff } from "./handoff";
import { buildProvenance, needsUserInputFields } from "./provenance";
import { computePacketFingerprint } from "./fingerprint";
import type { ApplicationPacket, ApplicationStatus } from "@/lib/data/types";

/** The reviewable content of a packet, before staging. */
export interface PacketDraft {
  resumeVersion: string;
  coverLetter: string;
  screeningAnswers: { question: string; answer: string }[];
}

export interface PacketContext {
  postingId: number;
  company: string;
  title: string;
  /** The posting URL as scraped; normalized during staging. */
  url: string;
  /** Allowlisted apply domains (see configuredAllowlist). */
  allowlist: string[];
}

export interface PacketMeta {
  status: ApplicationStatus;
  preparedAt: string; // ISO
  submittedDate: string | null;
}

export function stagePacket(
  draft: PacketDraft,
  ctx: PacketContext,
  meta: PacketMeta
): ApplicationPacket {
  const handoff = evaluateHandoff(ctx.url, ctx.allowlist);
  const provenance = buildProvenance({
    resumeVersion: draft.resumeVersion,
    coverLetter: draft.coverLetter,
    screeningAnswers: draft.screeningAnswers,
    handoffAllowed: handoff.allowed,
  });

  return {
    status: meta.status,
    resumeVersion: draft.resumeVersion,
    coverLetter: draft.coverLetter,
    screeningAnswers: draft.screeningAnswers,
    preparedAt: meta.preparedAt,
    submittedDate: meta.submittedDate,
    handoff,
    provenance,
    fingerprint: computePacketFingerprint({
      postingId: ctx.postingId,
      company: ctx.company,
      title: ctx.title,
      // Fingerprint the normalized URL — the exact string shown and approved.
      applicationUrl: handoff.url,
      resumeVersion: draft.resumeVersion,
      coverLetter: draft.coverLetter,
      screeningAnswers: draft.screeningAnswers,
      needsUserInput: needsUserInputFields(provenance),
    }),
    // A newly staged packet is never pre-approved.
    approval: null,
  };
}

/** The subset of a packet a human may edit before applying. */
export interface PacketEdits {
  resumeVersion?: string;
  coverLetter?: string;
  screeningAnswers?: { question: string; answer: string }[];
}

export function hasEdits(edits: PacketEdits): boolean {
  return (
    edits.resumeVersion !== undefined ||
    edits.coverLetter !== undefined ||
    edits.screeningAnswers !== undefined
  );
}

/**
 * Re-stage an existing packet with human edits. The fingerprint is recomputed
 * and the approval is dropped, so an edited packet must be re-approved.
 */
export function applyPacketEdits(
  packet: ApplicationPacket,
  edits: PacketEdits,
  ctx: PacketContext,
  now: number
): ApplicationPacket {
  return stagePacket(
    {
      resumeVersion: edits.resumeVersion ?? packet.resumeVersion,
      coverLetter: edits.coverLetter ?? packet.coverLetter,
      screeningAnswers: edits.screeningAnswers ?? packet.screeningAnswers,
    },
    ctx,
    {
      // Editing a submitted packet is not a supported path; callers gate on it.
      status: packet.status === "submitted" ? "submitted" : "ready",
      preparedAt: new Date(now).toISOString(),
      submittedDate: packet.submittedDate,
    }
  );
}
