import { desc, eq, inArray } from "drizzle-orm";
import { isValidTransition } from "@/lib/scrapers/statusTransitions";
import { evaluateHandoff } from "@/lib/apply/handoff";
import { configuredAllowlist } from "@/lib/apply/allowlist";
import { draftCoverLetter } from "@/lib/apply/coverLetter";
import { runDiscovery } from "@/lib/discovery/run";
import { persistDiscovery } from "@/lib/discovery/persist";
import { DISCOVERY_SOURCES } from "../../../config/discovery";
import { db, hasDb, companies, postings, applications } from "@/lib/db";
import type { Application, Company, Posting } from "@/lib/db";
import { scoreJob } from "./scoring";
import { RESUME_VERSIONS } from "./resume";
import type {
  ApplicationPacket,
  DashboardStats,
  JobView,
  PostingStatus,
} from "./types";

// ── Data store ───────────────────────────────────────────────────────────────
// When DATABASE_URL is configured (hasDb), reads and mutations go through the
// Drizzle schema in src/lib/db/schema.ts. Without it, an in-memory store keeps
// the UI, tests, and builds working with zero configuration. It starts EMPTY —
// real postings enter only via runScan()/discovery. The in-memory state lives
// on globalThis so it survives Next.js hot-reloads and is shared across server
// components and API route handlers within a process.

interface StoreState {
  jobs: JobView[];
}

const g = globalThis as unknown as { __jobStore?: StoreState };

function store(): StoreState {
  if (!g.__jobStore) {
    g.__jobStore = { jobs: [] };
  }
  return g.__jobStore;
}

const byScoreDesc = (a: JobView, b: JobView) => b.matchScore - a.matchScore;

// ── DB row → JobView mapping ─────────────────────────────────────────────────

function parseScreeningAnswers(
  raw: string | null
): { question: string; answer: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toPacket(app: Application): ApplicationPacket {
  return {
    status: app.status,
    resumeVersion: app.resumeVersion ?? "",
    coverLetter: app.coverLetter ?? "",
    screeningAnswers: parseScreeningAnswers(app.screeningAnswers),
    preparedAt: app.createdAt.toISOString(),
    submittedDate: app.submittedDate?.toISOString() ?? null,
    handoff:
      app.applicationUrl && app.handoffAllowed !== null
        ? {
            allowed: app.handoffAllowed,
            url: app.applicationUrl,
            domain: app.applicationDomain,
            reason: app.handoffReason ?? "",
          }
        : undefined,
  };
}

function toJobView(
  posting: Posting,
  company: Company,
  app: Application | undefined
): JobView {
  return {
    id: posting.id,
    companyId: posting.companyId,
    company: company.name,
    atsType: company.atsType,
    title: posting.title,
    url: posting.url,
    location: posting.location,
    description: posting.description,
    source: posting.source,
    postedDate: posting.postedDate?.toISOString() ?? null,
    foundDate: posting.foundDate.toISOString(),
    isNewGrad: posting.isNewGrad,
    requiredYearsMin: posting.requiredYearsMin,
    status: posting.status,
    matchScore: scoreJob({
      title: posting.title,
      isNewGrad: posting.isNewGrad,
      requiredYearsMin: posting.requiredYearsMin,
    }),
    application: app ? toPacket(app) : null,
  };
}

/** Latest application row per posting id. */
async function latestApplications(
  postingIds: number[]
): Promise<Map<number, Application>> {
  const byPosting = new Map<number, Application>();
  if (postingIds.length === 0) return byPosting;
  const rows = await db
    .select()
    .from(applications)
    .where(inArray(applications.postingId, postingIds))
    .orderBy(desc(applications.id));
  for (const row of rows) {
    if (!byPosting.has(row.postingId)) byPosting.set(row.postingId, row);
  }
  return byPosting;
}

async function dbListJobs(): Promise<JobView[]> {
  const rows = await db
    .select()
    .from(postings)
    .innerJoin(companies, eq(postings.companyId, companies.id));
  const apps = await latestApplications(rows.map((r) => r.postings.id));
  return rows
    .map((r) => toJobView(r.postings, r.companies, apps.get(r.postings.id)))
    .sort(byScoreDesc);
}

async function dbGetJob(id: number): Promise<JobView | undefined> {
  const rows = await db
    .select()
    .from(postings)
    .innerJoin(companies, eq(postings.companyId, companies.id))
    .where(eq(postings.id, id))
    .limit(1);
  if (rows.length === 0) return undefined;
  const apps = await latestApplications([id]);
  return toJobView(rows[0].postings, rows[0].companies, apps.get(id));
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listJobs(): Promise<JobView[]> {
  if (hasDb) return dbListJobs();
  return [...store().jobs].sort(byScoreDesc);
}

export async function getJob(id: number): Promise<JobView | undefined> {
  if (hasDb) return dbGetJob(id);
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

export async function getStats(now: number): Promise<DashboardStats> {
  const jobs = await listJobs();
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
export async function prepareApplication(
  id: number,
  now: number
): Promise<PrepareResult> {
  const job = await getJob(id);
  if (!job) return { ok: false, error: "Posting not found" };
  if (job.status !== "new" && job.status !== "reviewing") {
    return { ok: false, error: `Cannot prepare a packet from status "${job.status}".` };
  }

  const version = pickResumeVersion(job);
  // In DB mode the posting's own careers-page domain is added to the
  // config-derived allowlist; without a DB the discovery-source domains in
  // configuredAllowlist() are the whole allowlist.
  const extraUrls = hasDb ? await dbCareersUrls(job.companyId) : [];
  const allowlist = configuredAllowlist(extraUrls);
  const packet: ApplicationPacket = {
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
    handoff: evaluateHandoff(job.url, allowlist),
  };

  if (hasDb) {
    await dbUpsertApplication(id, packet, now);
    if (job.status === "new") {
      await db
        .update(postings)
        .set({ status: "reviewing", updatedAt: new Date(now) })
        .where(eq(postings.id, id));
    }
    const updated = await dbGetJob(id);
    return updated
      ? { ok: true, job: updated }
      : { ok: false, error: "Posting not found" };
  }

  job.application = packet;
  if (job.status === "new") job.status = "reviewing";
  return { ok: true, job };
}

async function dbCareersUrls(companyId: number): Promise<string[]> {
  const rows = await db
    .select({ careersUrl: companies.careersUrl })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows.map((r) => r.careersUrl);
}

/** Insert or refresh the staged application row for a posting. */
async function dbUpsertApplication(
  postingId: number,
  packet: ApplicationPacket,
  now: number
): Promise<void> {
  const values = {
    resumeVersion: packet.resumeVersion,
    coverLetter: packet.coverLetter,
    screeningAnswers: JSON.stringify(packet.screeningAnswers),
    status: packet.status,
    submittedDate: null,
    applicationUrl: packet.handoff?.url ?? null,
    applicationDomain: packet.handoff?.domain ?? null,
    handoffAllowed: packet.handoff?.allowed ?? null,
    handoffReason: packet.handoff?.reason ?? null,
    updatedAt: new Date(now),
  };
  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.postingId, postingId))
    .orderBy(desc(applications.id))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(applications)
      .set(values)
      .where(eq(applications.id, existing[0].id));
  } else {
    await db.insert(applications).values({ postingId, ...values });
  }
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
export async function setStatus(
  id: number,
  to: PostingStatus,
  now: number
): Promise<StatusResult> {
  const job = await getJob(id);
  if (!job) return { ok: false, error: "Posting not found" };
  if (job.status === to) return { ok: true, job };
  if (!isValidTransition(job.status, to)) {
    return {
      ok: false,
      error: `Invalid transition: ${job.status} → ${to}.`,
    };
  }

  if (hasDb) {
    await db
      .update(postings)
      .set({ status: to, updatedAt: new Date(now) })
      .where(eq(postings.id, id));
    if (to === "applied" && job.application) {
      const existing = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.postingId, id))
        .orderBy(desc(applications.id))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(applications)
          .set({
            status: "submitted",
            submittedDate: new Date(now),
            updatedAt: new Date(now),
          })
          .where(eq(applications.id, existing[0].id));
      }
    }
    const updated = await dbGetJob(id);
    return updated
      ? { ok: true, job: updated }
      : { ok: false, error: "Posting not found" };
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
 * The aggregation "cloud script": runs the real discovery pipeline over the
 * configured public ATS sources (config/discovery.ts) and merges any new
 * postings into the store. With a DB, postings are persisted and deduplicated
 * by the dedup-hash unique index; without one, they merge into the in-memory
 * store, deduplicated by URL.
 */
export async function runScan(now: number): Promise<ScanResult> {
  const result = await runDiscovery(DISCOVERY_SOURCES);

  if (hasDb) {
    const summary = await persistDiscovery(result, DISCOVERY_SOURCES, new Date(now));
    return {
      found: result.totals.postingsFound,
      added: summary.postingsInserted,
      jobs: await listJobs(),
    };
  }

  const atsBySource = new Map(DISCOVERY_SOURCES.map((s) => [s.companyId, s.ats]));
  const existingUrls = new Set(store().jobs.map((j) => j.url));
  let nextId = Math.max(0, ...store().jobs.map((j) => j.id)) + 1;
  let added = 0;

  for (const p of result.postings) {
    if (existingUrls.has(p.url)) continue;
    existingUrls.add(p.url);
    store().jobs.push({
      id: nextId++,
      companyId: p.companyId,
      company: p.companyName,
      atsType: atsBySource.get(p.companyId) ?? "unknown",
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
    });
    added += 1;
  }

  return { found: result.totals.postingsFound, added, jobs: await listJobs() };
}
