// Packet fingerprint.
//
// A fingerprint is a cryptographic digest of exactly the content a human sees
// when reviewing an application packet. The approval record stores the
// fingerprint that was approved, so any later change to the packet — a
// regeneration, an edit, a different posting URL — produces a different
// fingerprint and silently invalidates the old approval.
//
// Only reviewable content is hashed. Volatile bookkeeping (preparedAt,
// submittedDate, packet status, approval itself) is deliberately excluded so
// re-staging identical content is recognized as identical.

import { createHash } from "node:crypto";

/** Bump when the canonical form below changes; old approvals then stop matching. */
export const FINGERPRINT_VERSION = "v1";

export interface FingerprintInput {
  postingId: number;
  company: string;
  title: string;
  /** The exact normalized URL the user is being asked to approve. */
  applicationUrl: string;
  resumeVersion: string;
  coverLetter: string;
  screeningAnswers: { question: string; answer: string }[];
  /** Field keys still needing user input (see needsUserInputFields). */
  needsUserInput: string[];
}

/**
 * Canonical serialization of the reviewable content. Built from an explicit
 * field list, so the key order of the input object cannot change the result.
 */
export function canonicalizePacket(input: FingerprintInput): string {
  return JSON.stringify([
    FINGERPRINT_VERSION,
    input.postingId,
    input.company,
    input.title,
    input.applicationUrl,
    input.resumeVersion,
    input.coverLetter,
    input.screeningAnswers.map((qa) => [qa.question, qa.answer]),
    [...input.needsUserInput].sort(),
  ]);
}

/**
 * Fingerprint of a packet's reviewable content, as "v1:<sha256 hex>".
 * Deterministic: identical content always yields an identical fingerprint.
 */
export function computePacketFingerprint(input: FingerprintInput): string {
  const digest = createHash("sha256")
    .update(canonicalizePacket(input), "utf8")
    .digest("hex");
  return `${FINGERPRINT_VERSION}:${digest}`;
}

/** Shape check for a fingerprint supplied by a client. */
export function isWellFormedFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^v1:[0-9a-f]{64}$/.test(value);
}
