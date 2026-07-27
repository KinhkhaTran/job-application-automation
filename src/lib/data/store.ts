import { runScraper } from "@/lib/scrapers/orchestrator";
import { MockAdapter } from "@/lib/scrapers/adapters/mock";
import { COMPANY_TARGETS } from "../../../config/companies";
import { isValidTransition } from "@/lib/scrapers/statusTransitions";
import { scoreJob } from "./scoring";
import { seedJobs, draftCoverLetter } from "./sample";
import { RESUME_VERSIONS } from "./resume";
import type { DashboardStats, JobView, PostingStatus } from "./types";

// ── In-memory store ──────────────────────────────────────────────────────────
// This is the source of truth for the UI in local/dev without a provisioned
// database. It lives on globalThis so it survives Next.js hot-reloads and is
// shared across server components and API route handlers within a process.
//
// SWAP-IN SEAM: when DATABASE_URL points at a migrated Neon DB, replace the
// bodies of these functions with Drizzle queries against src/lib/db/schema.ts.
// The return shapes (JobView, DashboardStats) are what the UI consumes.

interface StoreState {
  jobs: JobView[];
}

const g = globalThis as unknown as { __jobStore?: StoreState };

function store(): StoreState {
  if (!g.__jobStore) {
    g.__jobStore = { jobs: seedJobs() };
  }
  return g.__jobStore;
}

const byScoreDesc = (a: JobView, b: JobView) => b.matchScore - a.matchScore;

export function listJobs(): JobView[] {
  return [...store().jobs].sort(byScoreDesc);
}

export function getJob(id: number): JobView | undefined {
  return store().jobs.find((j) => j.id === id);
}

const STATUS_KEYS: PostingStatus[] = [
  "new",
  "reviewing",
  "applied",
  "interviewing",
  "rejected",
  "ghosted",
  "offer",
  "skipped",
];

export function getStats(now: number): DashboardStats {
  const jobs = store().jobs;
  const byStatus = Object.fromEntries(
    STATUS_KEYS.map((s) => [s, 0])
  ) as Record<PostingStatus, number>;
  for (const j of jobs) byStatus[j.status] += 1;

  const weekAgo = now - 7 * 86_400_000;
  const appliedThisWeek = jobs.filter(
    (j) =>
      j.application?.submittedDate &&
      new Date(j.application.submittedDate).getTime() >= weekAgo
  ).length;

  return {
    totalPostings: jobs.length,
    newGrad: jobs.filter((j) => j.isNewGrad).length,
    readyToApply: jobs.filter(
      (j) => j.status === "reviewing" && j.application?.status === "ready"
    ).length,
    applied: byStatus.applied,
    interviewing: byStatus.interviewing,
    offers: byStatus.offer,
    appliedThisWeek,
    byStatus,
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export interface PrepareResult {
  ok: boolean;
  job?: JobView;
  error?: string;
}

/**
 * The "cloud script" for an Apply action. Prepares a staged application
 * packet — selects a résumé version, drafts a cover letter, and fills common
 * screening answers — WITHOUT submitting to any third-party ATS (human stays
 * in the loop). Moves the posting to "reviewing".
 */
export function prepareApplication(id: number, now: number): PrepareResult {
  const job = getJob(id);
  if (!job) return { ok: false, error: "Posting not found" };
  if (job.status !== "new" && job.status !== "reviewing") {
    return { ok: false, error: `Cannot prepare a packet from status "${job.status}".` };
  }

  const version = pickResumeVersion(job);
  job.application = {
    status: "ready",
    resumeVersion: version,
    coverLetter: draftCoverLetter(job.company, job.title),
    screeningAnswers: [
      { question: "Are you authorized to work in the US?", answer: "Yes." },
      { question: "Will you require sponsorship?", answer: "No." },
      {
        question: "Expected graduation date?",
        answer: "May 2026 (available full-time from June 2026).",
      },
    ],
    preparedAt: new Date(now).toISOString(),
    submittedDate: null,
  };
  if (job.status === "new") job.status = "reviewing";
  return { ok: true, job };
}

function pickResumeVersion(job: JobView): string {
  const t = job.title.toLowerCase();
  if (/back[\s-]?end|infra|platform|systems|ml/.test(t)) return RESUME_VERSIONS[1];
  if (/front[\s-]?end|product|ui|web/.test(t)) return RESUME_VERSIONS[2];
  return RESUME_VERSIONS[0];
}

export interface StatusResult {
  ok: boolean;
  job?: JobView;
  error?: string;
}

/** Move a posting through the pipeline, enforcing valid transitions. */
export function setStatus(id: number, to: PostingStatus, now: number): StatusResult {
  const job = getJob(id);
  if (!job) return { ok: false, error: "Posting not found" };
  if (job.status === to) return { ok: true, job };
  if (!isValidTransition(job.status, to)) {
    return {
      ok: false,
      error: `Invalid transition: ${job.status} → ${to}.`,
    };
  }
  job.status = to;
  if (to === "applied" && job.application) {
    job.application.status = "submitted";
    job.application.submittedDate = new Date(now).toISOString();
  }
  return { ok: true, job };
}

export interface ScanResult {
  found: number;
  added: number;
  jobs: JobView[];
}

/**
 * The aggregation "cloud script": runs the scraper orchestrator over the
 * configured company targets (mock adapter for now) and merges any new
 * postings into the store, deduplicating by URL.
 */
export async function runScan(now: number): Promise<ScanResult> {
  const adapter = new MockAdapter();
  const existingUrls = new Set(store().jobs.map((j) => j.url));
  let nextId = Math.max(0, ...store().jobs.map((j) => j.id)) + 1;
  let found = 0;
  let added = 0;

  for (const target of COMPANY_TARGETS) {
    // checkRobots: false — the mock adapter makes no outbound requests, and
    // we avoid a robots.txt fetch in restricted/offline environments.
    const result = await runScraper(adapter, target, { checkRobots: false });
    for (const p of result.postings) {
      found += 1;
      if (existingUrls.has(p.url)) continue;
      existingUrls.add(p.url);
      const job: JobView = {
        id: nextId++,
        companyId: target.companyId,
        company: target.companyName,
        atsType: "unknown",
        title: p.title,
        url: p.url,
        location: p.location,
        description: p.description,
        source: p.source,
        postedDate: p.postedAt,
        foundDate: new Date(now).toISOString(),
        isNewGrad: p.isNewGrad,
        requiredYearsMin: p.requiredYearsMin,
        status: "new",
        matchScore: scoreJob({
          title: p.title,
          isNewGrad: p.isNewGrad,
          requiredYearsMin: p.requiredYearsMin,
        }),
        application: null,
      };
      store().jobs.push(job);
      added += 1;
    }
  }

  return { found, added, jobs: listJobs() };
}
