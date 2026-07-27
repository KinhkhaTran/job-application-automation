// Mirror of postingStatusEnum values — kept local so this module is testable
// without importing drizzle-orm.
export type PostingStatus =
  | "new"
  | "reviewing"
  | "applied"
  | "interviewing"
  | "rejected"
  | "ghosted"
  | "offer"
  | "skipped";

const VALID_TRANSITIONS: Record<PostingStatus, PostingStatus[]> = {
  new: ["reviewing", "skipped"],
  reviewing: ["applied", "skipped", "new"],
  applied: ["interviewing", "rejected", "ghosted"],
  interviewing: ["offer", "rejected", "ghosted"],
  rejected: [],
  ghosted: [],
  offer: [],
  skipped: ["new"],
};

export function isValidTransition(from: PostingStatus, to: PostingStatus): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function getValidNextStatuses(current: PostingStatus): PostingStatus[] {
  return [...(VALID_TRANSITIONS[current] ?? [])];
}
