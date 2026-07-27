import type { ResumeData } from "@/lib/data/types";
import type { Resume } from "@/lib/db";
import type { FullProfile } from "./store";

// Build the print-friendly ResumeData shape the résumé page renders from the
// user's REAL saved profile (profiles + education + work_experience rows) —
// the same data captured during onboarding / résumé import. This is what makes
// /resume reflect the résumé you actually uploaded instead of sample content.

const strip = (v: string | null | undefined): string =>
  (v ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

/** "2023 — Present" / "2022 — 2026" / "" from free-text start/end dates. */
function period(
  start: string | null,
  end: string | null,
  isCurrent?: boolean
): string {
  const from = (start ?? "").trim();
  const to = isCurrent ? "Present" : (end ?? "").trim();
  if (from && to) return `${from} — ${to}`;
  return from || to || "";
}

/** Split a free-text description into résumé bullet points. */
function bullets(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n|(?:^|\s)[•·–-]\s+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/** The most recent (primary) résumé file the user uploaded, if any. */
export function primaryResume(full: FullProfile): Resume | null {
  return (
    full.resumes.find((r) => r.isPrimary) ?? full.resumes[0] ?? null
  );
}

/** Map a stored profile into the résumé view model. */
export function resumeDataFromProfile(full: FullProfile): ResumeData {
  const { profile, education, experience } = full;

  const headline =
    experience.find((e) => e.isCurrent)?.title ??
    experience[0]?.title ??
    "Software Engineer — New Grad";

  return {
    name: profile.fullName ?? "",
    headline,
    location: profile.location ?? "",
    email: profile.email ?? "",
    website: strip(profile.portfolioUrl),
    github: strip(profile.githubUrl),
    linkedin: strip(profile.linkedinUrl),
    summary: profile.summary ?? "",
    skills: profile.skills ?? [],
    experience: experience.map((e) => ({
      company: e.company,
      role: e.title ?? "",
      period: period(e.startDate, e.endDate, e.isCurrent),
      location: e.location ?? undefined,
      bullets: bullets(e.description),
    })),
    // No dedicated projects table yet — the résumé view renders an empty
    // Projects section gracefully.
    projects: [],
    education: education.map((ed) => ({
      school: ed.school,
      degree: [ed.degree, ed.fieldOfStudy].filter(Boolean).join(", "),
      period: period(ed.startDate, ed.endDate),
      details:
        [ed.gpa ? `GPA: ${ed.gpa}` : null, ed.details]
          .filter(Boolean)
          .join(" · ") || undefined,
    })),
  };
}
