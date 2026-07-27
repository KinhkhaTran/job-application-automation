import { desc, eq, inArray } from "drizzle-orm";
import { isValidTransition } from "@/lib/scrapers/statusTransitions";
import { configuredAllowlist } from "@/lib/apply/allowlist";
import { invalidateStaleApproval, type ApprovalRecord } from "@/lib/apply/approval";
import { buildProvenance, needsUserInputFields } from "@/lib/apply/provenance";
import { computePacketFingerprint } from "@/lib/apply/fingerprint";
import {
  applyPacketEdits,
  hasEdits,
  stagePacket,
  type PacketContext,
  type PacketEdits,
} from "@/lib/apply/packet";
import {
  evaluateApproval,
  evaluateOpen,
  type RefusalCode,
} from "@/lib/apply/review";
import { draftCoverLetter } from "@/lib/apply/coverLetter";
import { runDiscovery } from "@/lib/discovery/run";
import { persistDiscovery } from "@/lib/discovery/persist";
import { fetchSimplifyListings, persistSimplify } from "@/lib/discovery/simplify";
import { DISCOVERY_SOURCES } from "../../../config/discovery";
import { db, hasDb, companies, postings, applications } from "@/lib/db";
import type { Application, Company, Posting } from "@/lib/db";
import { scoreJob } from "./scoring";
import { RESUME_VERSIONS } from "./resume";
import type {
  ApplicationPacket,
  DashboardStats,
  JobView,
  PacketProvenance,
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

function parseProvenance(raw: string | null): PacketProvenance[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PacketProvenance[]) : null;
  } catch {
    return null;
  }
}

function toPacket(
  app: Application,
  ctx: { postingId: number; company: string; title: string }
): ApplicationPacket {
  const handoff =
    app.applicationUrl && app.handoffAllowed !== null
      ? {
          allowed: app.handoffAllowed,
          url: app.applicationUrl,
          domain: app.applicationDomain,
          reason: app.handoffReason ?? "",
        }
      : undefined;

  const resumeVersion = app.resumeVersion ?? "";
  const coverLetter = app.coverLetter ?? "";
  const screeningAnswers = parseScreeningAnswers(app.screeningAnswers);

  // Rows written before the review gate existed carry no provenance or
  // fingerprint; both are deterministic, so they are recomputed here rather
  // than left empty (an empty fingerprint could never be approved).
  const provenance =
    parseProvenance(app.provenance) ??
    buildProvenance({
      resumeVersion,
      coverLetter,
      screeningAnswers,
      handoffAllowed: handoff?.allowed ?? false,
    });

  const fingerprint =
    app.packetFingerprint ??
    computePacketFingerprint({
      postingId: ctx.postingId,
      company: ctx.company,
      title: ctx.title,
      applicationUrl: handoff?.url ?? "",
      resumeVersion,
      coverLetter,
      screeningAnswers,
      needsUserInput: needsUserInputFields(provenance),
    });

  const approval: ApprovalRecord | null =
    app.approvedFingerprint && app.approvedUrl && app.approvedAt
      ? {
          fingerprint: app.approvedFingerprint,
          url: app.approvedUrl,
          approvedAt: app.approvedAt.toISOString(),
          approvedBy: "human-review",
        }
      : null;

  // Defence in depth: an approval that no longer matches the stored packet is
  // dropped on read, whatever wrote it.
  return invalidateStaleApproval({
    status: app.status,
    resumeVersion,
    coverLetter,
    screeningAnswers,
    preparedAt: app.createdAt.toISOString(),
    submittedDate: app.submittedDate?.toISOString() ?? null,
    handoff,
    provenance,
    fingerprint,
    approval,
  });
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
    application: app
      ? toPacket(app, {
          postingId: posting.id,
          company: company.name,
          title: posting.title,
        })
      : null,
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

/** Screening answers pre-filled for a staged packet; the human edits them. */
const DEFAULT_SCREENING_ANSWERS = [
  { question: "Are you authorized to work in the US?", answer: "Yes." },
  { question: "Will you require sponsorship?", answer: "No." },
  {
    question: "Expected graduation date?",
    answer: "May 2026 (available full-time from June 2026).",
  },
];

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
  if (job.application?.status === "submitted") {
    return { ok: false, error: "This application is already marked as submitted." };
  }

  // stagePacket clears any prior approval, so regenerating a packet always
  // requires a fresh human approval.
  const packet = stagePacket(
    {
      resumeVersion: pickResumeVersion(job),
      coverLetter: draftCoverLetter(job.company, job.title),
      screeningAnswers: DEFAULT_SCREENING_ANSWERS.map((qa) => ({ ...qa })),
    },
    await packetContext(job),
    {
      status: "ready",
      preparedAt: new Date(now).toISOString(),
      submittedDate: null,
    }
  );

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

/**
 * Build the staging context for a posting. In DB mode the posting's own
 * careers-page domain is added to the config-derived allowlist; without a DB
 * the discovery-source domains in configuredAllowlist() are the whole
 * allowlist.
 */
async function packetContext(job: JobView): Promise<PacketContext> {
  const extraUrls = hasDb ? await dbCareersUrls(job.companyId) : [];
  return {
    postingId: job.id,
    company: job.company,
    title: job.title,
    url: job.url,
    allowlist: configuredAllowlist(extraUrls),
  };
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
    packetFingerprint: packet.fingerprint,
    provenance: JSON.stringify(packet.provenance),
    // Staging clears the approval columns: a re-staged packet is unapproved.
    approvedFingerprint: packet.approval?.fingerprint ?? null,
    approvedUrl: packet.approval?.url ?? null,
    approvedAt: packet.approval ? new Date(packet.approval.approvedAt) : null,
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

// ── Human-review gate ────────────────────────────────────────────────────────
// Three operations, and none of them touches the ATS:
//   editApplication    — re-stage with human edits (invalidates the approval)
//   approveApplication — record that a human reviewed this exact packet
//   openApplication    — return the approved URL for the user to open manually

export interface EditResult {
  ok: boolean;
  job?: JobView;
  error?: string;
}

/**
 * Apply human edits to a staged packet. The packet is re-staged, so its
 * fingerprint changes and any existing approval is dropped — an edited packet
 * must be reviewed and approved again.
 */
export async function editApplication(
  id: number,
  edits: PacketEdits,
  now: number
): Promise<EditResult> {
  if (!hasEdits(edits)) return { ok: false, error: "No edits supplied." };

  const job = await getJob(id);
  if (!job) return { ok: false, error: "Posting not found" };
  const current = job.application;
  if (!current) {
    return { ok: false, error: "No application packet is staged for this posting." };
  }
  if (current.status === "submitted") {
    return { ok: false, error: "This application is already marked as submitted." };
  }

  const packet = applyPacketEdits(current, edits, await packetContext(job), now);

  if (hasDb) {
    await dbUpsertApplication(id, packet, now);
    const updated = await dbGetJob(id);
    return updated ? { ok: true, job: updated } : { ok: false, error: "Posting not found" };
  }

  job.application = packet;
  return { ok: true, job };
}

export interface ApproveResult {
  ok: boolean;
  job?: JobView;
  error?: string;
  code?: RefusalCode | "not-found";
}

/**
 * Record an explicit human approval of a packet. The caller must echo the
 * exact fingerprint and URL that were displayed, and the URL must still be
 * allowlisted. Approval is a review record — it submits nothing.
 */
export async function approveApplication(
  id: number,
  input: { fingerprint: string; url: string },
  now: number
): Promise<ApproveResult> {
  const job = await getJob(id);
  if (!job) return { ok: false, error: "Posting not found", code: "not-found" };

  const ctx = await packetContext(job);
  const decision = evaluateApproval({
    packet: job.application,
    fingerprint: input.fingerprint,
    url: input.url,
    allowlist: ctx.allowlist,
    now,
  });
  if (!decision.ok) return { ok: false, error: decision.error, code: decision.code };

  if (hasDb) {
    await dbSetApproval(id, decision.approval, now);
    const updated = await dbGetJob(id);
    return updated ? { ok: true, job: updated } : { ok: false, error: "Posting not found" };
  }

  job.application!.approval = decision.approval;
  return { ok: true, job };
}

export interface OpenResult {
  ok: boolean;
  /** The approved, allowlisted URL to open manually. Never fetched here. */
  url?: string;
  domain?: string | null;
  approvedAt?: string;
  notice?: string;
  error?: string;
  code?: RefusalCode | "not-found";
}

/**
 * Return the application URL for an approved packet so the user can open it in
 * their own browser. This performs no network request: it looks the URL up,
 * re-checks the allowlist and the approval, and hands the string back.
 */
export async function openApplication(
  id: number,
  fingerprint: string
): Promise<OpenResult> {
  const job = await getJob(id);
  if (!job) return { ok: false, error: "Posting not found", code: "not-found" };

  const ctx = await packetContext(job);
  const decision = evaluateOpen({
    packet: job.application,
    fingerprint,
    allowlist: ctx.allowlist,
  });
  if (!decision.ok) return { ok: false, error: decision.error, code: decision.code };

  return {
    ok: true,
    url: decision.url,
    domain: decision.domain,
    approvedAt: decision.approvedAt,
    notice: decision.notice,
  };
}

async function dbSetApproval(
  postingId: number,
  approval: ApprovalRecord,
  now: number
): Promise<void> {
  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.postingId, postingId))
    .orderBy(desc(applications.id))
    .limit(1);
  if (existing.length === 0) return;
  await db
    .update(applications)
    .set({
      approvedFingerprint: approval.fingerprint,
      approvedUrl: approval.url,
      approvedAt: new Date(approval.approvedAt),
      updatedAt: new Date(now),
    })
    .where(eq(applications.id, existing[0].id));
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
    const ts = new Date(now);
    const summary = await persistDiscovery(result, DISCOVERY_SOURCES, ts);

    // Also pull the SimplifyJobs New-Grad feed (the high-volume source).
    // Isolated so a feed hiccup never fails the official-ATS scan.
    let simplifyFound = 0;
    let simplifyAdded = 0;
    try {
      const listings = await fetchSimplifyListings();
      const s = await persistSimplify(listings, ts);
      simplifyFound = s.postingsFound;
      simplifyAdded = s.postingsInserted;
    } catch {
      /* leave Simplify counts at 0 on failure */
    }

    return {
      found: result.totals.postingsFound + simplifyFound,
      added: summary.postingsInserted + simplifyAdded,
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
