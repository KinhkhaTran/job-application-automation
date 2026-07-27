import { createClient } from "@/lib/supabase/server";

const BUCKET = "resumes";

/**
 * Uploads a résumé file to the private `resumes` bucket under the user's own
 * folder (`${userId}/…`) so per-user RLS applies. Returns the storage path.
 */
export async function uploadResume(
  userId: string,
  fileName: string,
  bytes: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = createClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`Résumé upload failed: ${error.message}`);
  }
  return path;
}
