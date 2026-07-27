import type { OnboardingInput } from "./schema";
import type { FullProfile } from "./store";

// The onboarding form's local state shape: like OnboardingInput but with all
// optional text fields as plain strings (controlled inputs) and never null.
export type OnboardingFormValues = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  authorizedToWork: boolean;
  requiresSponsorship: boolean;
  willingToRelocate: boolean;
  desiredSalary: string;
  availableStartDate: string;
  summary: string;
  skills: string[];
  education: {
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa: string;
    details: string;
  }[];
  experience: {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description: string;
  }[];
  resume: OnboardingInput["resume"];
};

const str = (v: string | null | undefined) => v ?? "";

export function emptyOnboardingForm(email = ""): OnboardingFormValues {
  return {
    fullName: "",
    email,
    phone: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    authorizedToWork: false,
    requiresSponsorship: false,
    willingToRelocate: false,
    desiredSalary: "",
    availableStartDate: "",
    summary: "",
    skills: [],
    education: [],
    experience: [],
    resume: null,
  };
}

/** Map a stored profile back into the editable form shape. */
export function onboardingFormFromProfile(
  full: FullProfile
): OnboardingFormValues {
  const { profile, education, experience } = full;
  return {
    fullName: str(profile.fullName),
    email: str(profile.email),
    phone: str(profile.phone),
    location: str(profile.location),
    linkedinUrl: str(profile.linkedinUrl),
    githubUrl: str(profile.githubUrl),
    portfolioUrl: str(profile.portfolioUrl),
    authorizedToWork: Boolean(profile.authorizedToWork),
    requiresSponsorship: Boolean(profile.requiresSponsorship),
    willingToRelocate: Boolean(profile.willingToRelocate),
    desiredSalary: str(profile.desiredSalary),
    availableStartDate: str(profile.availableStartDate),
    summary: str(profile.summary),
    skills: profile.skills ?? [],
    education: education.map((e) => ({
      school: str(e.school),
      degree: str(e.degree),
      fieldOfStudy: str(e.fieldOfStudy),
      startDate: str(e.startDate),
      endDate: str(e.endDate),
      gpa: str(e.gpa),
      details: str(e.details),
    })),
    experience: experience.map((x) => ({
      company: str(x.company),
      title: str(x.title),
      location: str(x.location),
      startDate: str(x.startDate),
      endDate: str(x.endDate),
      isCurrent: Boolean(x.isCurrent),
      description: str(x.description),
    })),
    resume: null,
  };
}
