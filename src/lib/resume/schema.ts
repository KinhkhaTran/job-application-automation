import { z } from "zod";

// A required string that tolerates the model emitting null / a non-string:
// `.catch("")` coerces any invalid value to "" during validation, while still
// generating a plain (union-free) string in the JSON schema sent to Claude.
// This matters twice over: LLMs often emit null for "missing" despite the
// prompt, and Claude's structured-output compiler caps a schema at 16
// union-or-array-typed parameters — so `.nullable()` on every field is out.
const field = z.string().catch("");

// Structured shape Claude extracts from a résumé. The model is asked to use ""
// for anything the document doesn't contain; `field` backstops stray nulls.
export const ParsedResumeSchema = z.object({
  fullName: field,
  email: field,
  phone: field,
  location: field,
  linkedinUrl: field,
  githubUrl: field,
  portfolioUrl: field,
  summary: field,
  skills: z.array(field),
  education: z.array(
    z.object({
      school: field,
      degree: field,
      fieldOfStudy: field,
      startDate: field,
      endDate: field,
      gpa: field,
    })
  ),
  experience: z.array(
    z.object({
      company: field,
      title: field,
      location: field,
      startDate: field,
      endDate: field,
      description: field,
    })
  ),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
