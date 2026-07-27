import { createHash } from "crypto";

export function computeDedupHash(companyId: number, url: string): string {
  return createHash("sha256")
    .update(`${companyId}:${url}`)
    .digest("hex");
}
