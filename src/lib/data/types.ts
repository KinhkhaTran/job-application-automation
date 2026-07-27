import type { PostingStatus } from "@/lib/scrapers/statusTransitions";

export type { PostingStatus };

export type AtsType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "custom"
  | "unknown";

export type ApplicationStatus = "draft" | "ready" | "submitted" | "withdrawn";

/** A staged application packet — prepared by the "cloud script", never auto-submitted. */
export interface ApplicationPacket {
  status: ApplicationStatus;
  resumeVersion: string;
  coverLetter: string;
  screeningAnswers: { question: string; answer: string }[];
  preparedAt: string; // ISO
  submittedDate: string | null;
}

/** Denormalized posting + company + application, ready for the UI. */
export interface JobView {
  id: number;
  companyId: number;
  company: string;
  atsType: AtsType;
  title: string;
  url: string;
  location: string | null;
  description: string | null;
  source: string;
  postedDate: string | null; // ISO
  foundDate: string; // ISO
  isNewGrad: boolean;
  requiredYearsMin: number | null;
  status: PostingStatus;
  /** 0–100 heuristic fit score. */
  matchScore: number;
  application: ApplicationPacket | null;
}

export interface DashboardStats {
  totalPostings: number;
  newGrad: number;
  readyToApply: number; // status === "reviewing" with a prepared packet
  applied: number;
  interviewing: number;
  offers: number;
  appliedThisWeek: number;
  byStatus: Record<PostingStatus, number>;
}

export interface ResumeData {
  name: string;
  headline: string;
  location: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  summary: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    period: string;
    location?: string;
    bullets: string[];
  }[];
  projects: { name: string; description: string; tech: string[]; link?: string }[];
  education: { school: string; degree: string; period: string; details?: string }[];
}
