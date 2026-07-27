// Profile → application-form field mapping.
//
// Turns the applicant's profile into a list of candidate form fields plus the
// keywords used to locate the matching input on an arbitrary application page.
// This module is pure and browser-free so it can be unit-tested; the runner
// (runner.ts) is what actually drives Playwright.

import { RESUME } from "@/lib/data/resume";
import type { ResumeData } from "@/lib/data/types";

export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
}

export type FieldKind = "text" | "email" | "tel" | "url";

export interface AutofillField {
  key: string;
  label: string;
  value: string;
  /** Lowercase substrings matched against a field's label/name/id/placeholder. */
  keywords: string[];
  kind: FieldKind;
}

/** Ensure a bare "github.com/x" style value is a fetchable https URL. */
function toHttps(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Derive an ApplicantProfile from the résumé constant (the single-user source). */
export function profileFromResume(resume: ResumeData = RESUME): ApplicantProfile {
  const parts = resume.name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return {
    firstName,
    lastName,
    fullName: resume.name,
    email: resume.email,
    phone: null, // the résumé constant carries no phone; left for the user to add
    location: resume.location,
    linkedin: toHttps(resume.linkedin),
    github: toHttps(resume.github),
    website: toHttps(resume.website),
  };
}

/**
 * Build the ordered list of fields to autofill. Only fields with a real value
 * are included; the runner reports anything it could not place on the page.
 */
export function buildAutofillFields(profile: ApplicantProfile): AutofillField[] {
  const candidates: (AutofillField | null)[] = [
    {
      key: "firstName",
      label: "First name",
      value: profile.firstName,
      keywords: ["first name", "firstname", "given name", "given-name", "fname"],
      kind: "text",
    },
    {
      key: "lastName",
      label: "Last name",
      value: profile.lastName,
      keywords: ["last name", "lastname", "family name", "surname", "lname"],
      kind: "text",
    },
    {
      key: "fullName",
      label: "Full name",
      value: profile.fullName,
      keywords: ["full name", "fullname", "your name", "name"],
      kind: "text",
    },
    {
      key: "email",
      label: "Email",
      value: profile.email,
      keywords: ["email", "e-mail"],
      kind: "email",
    },
    profile.phone
      ? {
          key: "phone",
          label: "Phone",
          value: profile.phone,
          keywords: ["phone", "mobile", "telephone", "cell"],
          kind: "tel" as const,
        }
      : null,
    profile.location
      ? {
          key: "location",
          label: "Location",
          value: profile.location,
          keywords: ["location", "city", "where are you", "current location"],
          kind: "text" as const,
        }
      : null,
    profile.linkedin
      ? {
          key: "linkedin",
          label: "LinkedIn",
          value: profile.linkedin,
          keywords: ["linkedin"],
          kind: "url" as const,
        }
      : null,
    profile.github
      ? {
          key: "github",
          label: "GitHub",
          value: profile.github,
          keywords: ["github", "git hub"],
          kind: "url" as const,
        }
      : null,
    profile.website
      ? {
          key: "website",
          label: "Website / Portfolio",
          value: profile.website,
          keywords: ["website", "portfolio", "personal site", "url"],
          kind: "url" as const,
        }
      : null,
  ];

  return candidates.filter(
    (f): f is AutofillField => f !== null && f.value.trim().length > 0
  );
}
