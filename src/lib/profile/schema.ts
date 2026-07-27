import { z } from "zod";

// Empty string → undefined, otherwise must be a valid URL. Lets optional link
// fields be left blank in the form without failing validation.
const urlish = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().url().optional()
);

export const EducationInputSchema = z.object({
  school: z.string().trim().min(1, "School is required"),
  degree: z.string().trim().optional(),
  fieldOfStudy: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  gpa: z.string().trim().optional(),
  details: z.string().trim().optional(),
});

export const ExperienceInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  title: z.string().trim().optional(),
  location: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().trim().optional(),
});

export const ResumeMetaSchema = z.object({
  fileName: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  rawText: z.string().nullable().optional(),
});

export const OnboardingInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  linkedinUrl: urlish,
  githubUrl: urlish,
  portfolioUrl: urlish,
  authorizedToWork: z.boolean(),
  requiresSponsorship: z.boolean(),
  willingToRelocate: z.boolean().optional().default(false),
  desiredSalary: z.string().trim().optional(),
  availableStartDate: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  skills: z.array(z.string().trim().min(1)).default([]),
  education: z.array(EducationInputSchema).default([]),
  experience: z.array(ExperienceInputSchema).default([]),
  resume: ResumeMetaSchema.nullable().optional(),
});

export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
export type EducationInput = z.infer<typeof EducationInputSchema>;
export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>;
