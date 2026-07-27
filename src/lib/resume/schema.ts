import { z } from "zod";

// Structured shape Claude extracts from a résumé. Every field is required in
// the JSON schema (so structured-output validation is strict) but nullable, so
// the model emits null for anything the document doesn't contain rather than
// inventing it.
export const ParsedResumeSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      fieldOfStudy: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      gpa: z.string().nullable(),
    })
  ),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string().nullable(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
    })
  ),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
