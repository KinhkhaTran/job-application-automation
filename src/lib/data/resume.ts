import type { ResumeData } from "./types";

// The résumé that gets attached to application packets and shown on the
// résumé page. Edit this to reflect your real profile — it's the single
// source of truth the "cloud script" pulls from when preparing packets.
export const RESUME: ResumeData = {
  name: "Kinhkha Tran",
  headline: "Software Engineer — New Grad 2026",
  location: "San Francisco Bay Area, CA",
  email: "kkhatran@gmail.com",
  website: "kinhkha.dev",
  github: "github.com/kinhkhatran",
  linkedin: "linkedin.com/in/kinhkhatran",
  summary:
    "New-grad software engineer who ships end to end — from Postgres schemas and rate-limited scrapers to polished React dashboards. I care about correctness (strict TypeScript, tested edge cases) and about interfaces that feel fast and considered.",
  skills: [
    "TypeScript",
    "React / Next.js",
    "Node.js",
    "Python",
    "PostgreSQL",
    "Drizzle ORM",
    "Tailwind CSS",
    "REST APIs",
    "Jest",
    "Git",
    "Vercel",
    "System design",
  ],
  experience: [
    {
      company: "Independent / Personal Projects",
      role: "Full-Stack Engineer",
      period: "2025 — Present",
      location: "Remote",
      bullets: [
        "Built a job-application automation platform: Next.js dashboard, Drizzle/Postgres schema, and rate-limited ATS scraper adapters with robots.txt compliance.",
        "Implemented deduplication (SHA-256 content hashing), new-grad classification, and years-of-experience flagging with a full Jest suite (67 passing tests).",
        "Designed a human-in-the-loop application pipeline with validated status transitions.",
      ],
    },
    {
      company: "University Research Lab",
      role: "Undergraduate Research Assistant",
      period: "2024 — 2025",
      location: "On-campus",
      bullets: [
        "Prototyped data-processing pipelines in Python, cutting a batch job's runtime by ~40%.",
        "Collaborated with graduate researchers to instrument and visualize experiment results.",
      ],
    },
  ],
  projects: [
    {
      name: "Job Application Automation",
      description:
        "Personal platform that aggregates new-grad SWE postings, classifies them, and stages application packets for human review.",
      tech: ["Next.js", "TypeScript", "Drizzle", "Postgres", "Tailwind"],
      link: "github.com/kinhkhatran/job-application-automation",
    },
    {
      name: "Realtime Collab Editor",
      description:
        "CRDT-based collaborative text editor with presence and offline sync.",
      tech: ["React", "WebSockets", "Yjs"],
    },
  ],
  education: [
    {
      school: "State University",
      degree: "B.S. in Computer Science",
      period: "2022 — 2026",
      details: "Coursework: Distributed Systems, Databases, Algorithms, HCI.",
    },
  ],
};

/** Résumé versions the pipeline can attach to a packet. */
export const RESUME_VERSIONS = [
  "SWE — General v3",
  "Backend-focused v2",
  "Frontend-focused v2",
] as const;
