import { desc, eq } from "drizzle-orm";
import {
  db,
  hasDb,
  profiles,
  education,
  workExperience,
  resumes,
} from "@/lib/db";
import type { Profile, Education, WorkExperience, Resume } from "@/lib/db";
import type { OnboardingInput } from "./schema";

export interface FullProfile {
  profile: Profile;
  education: Education[];
  experience: WorkExperience[];
  resumes: Resume[];
}

/** Load a user's full common-application profile, or null if none saved yet. */
export async function getFullProfile(
  userId: string
): Promise<FullProfile | null> {
  if (!hasDb) return null;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return null;

  const [edu, exp, res] = await Promise.all([
    db.select().from(education).where(eq(education.userId, userId)),
    db.select().from(workExperience).where(eq(workExperience.userId, userId)),
    db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.id)),
  ]);
  return { profile, education: edu, experience: exp, resumes: res };
}

/**
 * Upserts the profile row and replaces the user's education/experience rows in
 * a single transaction; appends a new résumé row (demoting prior primaries)
 * when one was uploaded. Marks onboarding complete.
 */
export async function saveProfile(
  userId: string,
  input: OnboardingInput,
  now: number
): Promise<void> {
  if (!hasDb) throw new Error("Database is not configured");
  const ts = new Date(now);

  await db.transaction(async (tx) => {
    const values = {
      userId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      location: input.location ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      githubUrl: input.githubUrl ?? null,
      portfolioUrl: input.portfolioUrl ?? null,
      authorizedToWork: input.authorizedToWork,
      requiresSponsorship: input.requiresSponsorship,
      willingToRelocate: input.willingToRelocate ?? false,
      desiredSalary: input.desiredSalary ?? null,
      availableStartDate: input.availableStartDate ?? null,
      skills: input.skills,
      summary: input.summary ?? null,
      onboardingCompleted: true,
      updatedAt: ts,
    };
    await tx
      .insert(profiles)
      .values(values)
      .onConflictDoUpdate({ target: profiles.userId, set: values });

    await tx.delete(education).where(eq(education.userId, userId));
    if (input.education.length > 0) {
      await tx
        .insert(education)
        .values(input.education.map((e) => ({ userId, ...e })));
    }

    await tx.delete(workExperience).where(eq(workExperience.userId, userId));
    if (input.experience.length > 0) {
      await tx.insert(workExperience).values(
        input.experience.map((e) => ({
          userId,
          ...e,
          isCurrent: e.isCurrent ?? false,
        }))
      );
    }

    if (input.resume) {
      await tx
        .update(resumes)
        .set({ isPrimary: false })
        .where(eq(resumes.userId, userId));
      await tx.insert(resumes).values({
        userId,
        fileName: input.resume.fileName,
        storagePath: input.resume.storagePath,
        mimeType: input.resume.mimeType,
        sizeBytes: input.resume.sizeBytes,
        rawText: input.resume.rawText ?? null,
        isPrimary: true,
        parsedAt: ts,
      });
    }
  });
}
