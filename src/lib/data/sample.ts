import { scoreJob } from "./scoring";
import type { AtsType, JobView, PostingStatus, ApplicationPacket } from "./types";
import { RESUME_VERSIONS } from "./resume";

// Seed data so the dashboard is populated on first run without a live DB.
// Dates are anchored around late July 2026 to read naturally as "Xd ago".

export interface SampleCompany {
  id: number;
  name: string;
  careersUrl: string;
  atsType: AtsType;
}

export const SAMPLE_COMPANIES: SampleCompany[] = [
  { id: 1, name: "Stripe", careersUrl: "https://stripe.com/jobs", atsType: "greenhouse" },
  { id: 2, name: "Linear", careersUrl: "https://linear.app/careers", atsType: "ashby" },
  { id: 3, name: "Notion", careersUrl: "https://notion.so/careers", atsType: "greenhouse" },
  { id: 4, name: "Vercel", careersUrl: "https://vercel.com/careers", atsType: "greenhouse" },
  { id: 5, name: "Ramp", careersUrl: "https://ramp.com/careers", atsType: "ashby" },
  { id: 6, name: "Figma", careersUrl: "https://figma.com/careers", atsType: "greenhouse" },
];

function packet(
  version: string,
  company: string,
  role: string,
  status: ApplicationPacket["status"],
  preparedAt: string,
  submittedDate: string | null
): ApplicationPacket {
  return {
    status,
    resumeVersion: version,
    coverLetter: draftCoverLetter(company, role),
    screeningAnswers: [
      { question: "Are you authorized to work in the US?", answer: "Yes." },
      { question: "Will you require sponsorship?", answer: "No." },
      {
        question: "Expected graduation date?",
        answer: "May 2026 (available full-time from June 2026).",
      },
    ],
    preparedAt,
    submittedDate,
  };
}

export function draftCoverLetter(company: string, role: string): string {
  return `Dear ${company} Hiring Team,

I'm applying for the ${role} role. As a new-grad software engineer, I've shipped full-stack projects end to end — strict-TypeScript React frontends backed by Postgres and tested Node services — and I'm drawn to ${company}'s focus on craft and velocity.

Recently I built a job-application automation platform: a rate-limited scraper with robots.txt compliance, SHA-256 deduplication, and a human-in-the-loop review pipeline, all covered by a Jest suite. I'd bring that same bias toward correctness and polish to your team.

I'd welcome the chance to talk.

Best,
Kinhkha Tran`;
}

interface Seed {
  id: number;
  companyId: number;
  title: string;
  path: string;
  location: string | null;
  description: string;
  postedDate: string | null;
  foundDate: string;
  status: PostingStatus;
  application?: ApplicationPacket;
}

const SEEDS: Seed[] = [
  {
    id: 101,
    companyId: 1,
    title: "Software Engineer, New Grad",
    path: "jobs/swe-new-grad",
    location: "San Francisco, CA",
    description:
      "New-grad software engineer. We welcome candidates with 0-1 years of experience across our payments platform.",
    postedDate: "2026-07-24T00:00:00Z",
    foundDate: "2026-07-26T14:00:00Z",
    status: "new",
  },
  {
    id: 102,
    companyId: 4,
    title: "Frontend Engineer, University Grad",
    path: "careers/frontend-ug",
    location: "Remote (US)",
    description:
      "University grad frontend role. Build the tools developers love. Class of 2026 grads encouraged to apply.",
    postedDate: "2026-07-25T00:00:00Z",
    foundDate: "2026-07-26T14:00:00Z",
    status: "new",
  },
  {
    id: 103,
    companyId: 2,
    title: "Product Engineer (Entry Level)",
    path: "careers/product-eng",
    location: "San Francisco, CA",
    description:
      "Entry level product engineer. Ship features across our issue-tracking product. Recent graduates welcome.",
    postedDate: "2026-07-22T00:00:00Z",
    foundDate: "2026-07-25T09:00:00Z",
    status: "reviewing",
    application: packet(
      RESUME_VERSIONS[2],
      "Linear",
      "Product Engineer (Entry Level)",
      "ready",
      "2026-07-26T10:00:00Z",
      null
    ),
  },
  {
    id: 104,
    companyId: 5,
    title: "Software Engineer, New Grad (Backend)",
    path: "careers/swe-backend-ng",
    location: "New York, NY",
    description:
      "New grad backend engineer. Work on our financial infrastructure. 0-1 years experience.",
    postedDate: "2026-07-20T00:00:00Z",
    foundDate: "2026-07-24T09:00:00Z",
    status: "reviewing",
    application: packet(
      RESUME_VERSIONS[1],
      "Ramp",
      "Software Engineer, New Grad (Backend)",
      "ready",
      "2026-07-25T16:00:00Z",
      null
    ),
  },
  {
    id: 105,
    companyId: 3,
    title: "Software Engineer, Early Career",
    path: "careers/swe-early",
    location: "San Francisco, CA",
    description:
      "Early career software engineer. Join our applied engineering team building the connected workspace.",
    postedDate: "2026-07-15T00:00:00Z",
    foundDate: "2026-07-20T09:00:00Z",
    status: "applied",
    application: packet(
      RESUME_VERSIONS[0],
      "Notion",
      "Software Engineer, Early Career",
      "submitted",
      "2026-07-19T12:00:00Z",
      "2026-07-19T15:30:00Z"
    ),
  },
  {
    id: 106,
    companyId: 6,
    title: "New Grad Software Engineer, Product",
    path: "careers/ng-swe-product",
    location: "San Francisco, CA",
    description:
      "New grad product engineer. Help design tools used by millions. Recent graduates encouraged to apply.",
    postedDate: "2026-07-10T00:00:00Z",
    foundDate: "2026-07-14T09:00:00Z",
    status: "interviewing",
    application: packet(
      RESUME_VERSIONS[0],
      "Figma",
      "New Grad Software Engineer, Product",
      "submitted",
      "2026-07-13T12:00:00Z",
      "2026-07-13T18:00:00Z"
    ),
  },
  {
    id: 107,
    companyId: 1,
    title: "Software Engineer, University Grad (Infra)",
    path: "jobs/ug-infra",
    location: "Seattle, WA",
    description:
      "University grad infrastructure engineer. Build reliable systems at scale. Class of 2026 welcome.",
    postedDate: "2026-06-28T00:00:00Z",
    foundDate: "2026-07-02T09:00:00Z",
    status: "offer",
    application: packet(
      RESUME_VERSIONS[1],
      "Stripe",
      "Software Engineer, University Grad (Infra)",
      "submitted",
      "2026-07-01T12:00:00Z",
      "2026-07-01T14:00:00Z"
    ),
  },
  {
    id: 108,
    companyId: 5,
    title: "Senior Software Engineer",
    path: "careers/senior-swe",
    location: "Remote",
    description:
      "Seeking a senior engineer with 5+ years of professional experience leading platform initiatives.",
    postedDate: "2026-07-18T00:00:00Z",
    foundDate: "2026-07-23T09:00:00Z",
    status: "skipped",
  },
  {
    id: 109,
    companyId: 2,
    title: "Software Engineer, New Grad (Fullstack)",
    path: "careers/ng-fullstack",
    location: "Remote (US)",
    description:
      "New grad fullstack engineer. Work across the entire product. 0-1 years of experience.",
    postedDate: "2026-07-23T00:00:00Z",
    foundDate: "2026-07-26T14:00:00Z",
    status: "new",
  },
  {
    id: 110,
    companyId: 4,
    title: "Backend Engineer",
    path: "careers/backend-eng",
    location: "Remote (US)",
    description:
      "Backend engineer with a minimum of 3 years experience building distributed systems.",
    postedDate: "2026-07-21T00:00:00Z",
    foundDate: "2026-07-25T09:00:00Z",
    status: "new",
  },
  {
    id: 111,
    companyId: 6,
    title: "Software Engineer, Recent Grad (Platform)",
    path: "careers/rg-platform",
    location: "New York, NY",
    description:
      "Recent graduate platform engineer. Build the rendering pipeline. Entry level, 0-1 years.",
    postedDate: "2026-07-12T00:00:00Z",
    foundDate: "2026-07-16T09:00:00Z",
    status: "rejected",
    application: packet(
      RESUME_VERSIONS[0],
      "Figma",
      "Software Engineer, Recent Grad (Platform)",
      "submitted",
      "2026-07-15T12:00:00Z",
      "2026-07-15T13:00:00Z"
    ),
  },
  {
    id: 112,
    companyId: 3,
    title: "New Grad Software Engineer, ML Platform",
    path: "careers/ng-ml",
    location: "San Francisco, CA",
    description:
      "New grad engineer on the ML platform team. 0-1 years experience. Recent graduates welcome.",
    postedDate: "2026-07-25T00:00:00Z",
    foundDate: "2026-07-26T14:00:00Z",
    status: "new",
  },
];

function toJobView(seed: Seed): JobView {
  const company = SAMPLE_COMPANIES.find((c) => c.id === seed.companyId)!;
  const isNewGrad =
    /new[\s-]?grad|entry|university grad|recent grad|early career/i.test(
      seed.title + " " + seed.description
    );
  const yearsMatch = seed.description.match(/(\d+)\+?\s*years?/i);
  const requiredYearsMin =
    yearsMatch && !/0\s*[-to]+\s*[12]/i.test(seed.description)
      ? parseInt(yearsMatch[1], 10)
      : null;
  return {
    id: seed.id,
    companyId: seed.companyId,
    company: company.name,
    atsType: company.atsType,
    title: seed.title,
    url: `${company.careersUrl.replace(/\/$/, "")}/${seed.path}`,
    location: seed.location,
    description: seed.description,
    source: company.atsType,
    postedDate: seed.postedDate,
    foundDate: seed.foundDate,
    isNewGrad,
    requiredYearsMin,
    status: seed.status,
    matchScore: scoreJob({ title: seed.title, isNewGrad, requiredYearsMin }),
    application: seed.application ?? null,
  };
}

export function seedJobs(): JobView[] {
  return SEEDS.map(toJobView);
}
