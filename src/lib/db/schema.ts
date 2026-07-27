import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const atsTypeEnum = pgEnum("ats_type", [
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "custom",
  "unknown",
]);

export const postingStatusEnum = pgEnum("posting_status", [
  "new",
  "reviewing",
  "applied",
  "interviewing",
  "rejected",
  "ghosted",
  "offer",
  "skipped",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "ready",
  "submitted",
  "withdrawn",
]);

// ── companies ──────────────────────────────────────────────────────────────
export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    careersUrl: text("careers_url").notNull(),
    atsType: atsTypeEnum("ats_type").notNull().default("unknown"),
    // Greenhouse/Lever/Ashby board handle, e.g. "stripe" in boards.greenhouse.io/stripe
    atsBoardId: text("ats_board_id"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("companies_name_idx").on(t.name),
  })
);

// ── postings ───────────────────────────────────────────────────────────────
export const postings = pgTable(
  "postings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    location: text("location"),
    description: text("description"),
    postedDate: timestamp("posted_date"),
    foundDate: timestamp("found_date").notNull().defaultNow(),
    // Stable hash for deduplication: sha256(company_id + url)
    dedupHash: text("dedup_hash").notNull(),
    isNewGrad: boolean("is_new_grad").notNull().default(false),
    // null means not flagged; integer = minimum years found in description
    requiredYearsMin: integer("required_years_min"),
    status: postingStatusEnum("status").notNull().default("new"),
    source: text("source").notNull(), // "greenhouse" | "lever" | "ashby" | "mock"
    rawData: text("raw_data"), // JSON blob of raw API response
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    dedupHashIdx: uniqueIndex("postings_dedup_hash_idx").on(t.dedupHash),
    companyIdx: index("postings_company_idx").on(t.companyId),
    statusIdx: index("postings_status_idx").on(t.status),
    foundDateIdx: index("postings_found_date_idx").on(t.foundDate),
  })
);

// ── applications ───────────────────────────────────────────────────────────
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  postingId: integer("posting_id")
    .notNull()
    .references(() => postings.id, { onDelete: "cascade" }),
  resumeVersion: text("resume_version"),
  coverLetter: text("cover_letter"),
  screeningAnswers: text("screening_answers"), // JSON
  status: applicationStatusEnum("status").notNull().default("draft"),
  submittedDate: timestamp("submitted_date"),
  notes: text("notes"),
  // Manual-review handoff: normalized application URL and the allowed-domain
  // decision. The user opens the URL themselves; nothing is auto-submitted.
  applicationUrl: text("application_url"),
  applicationDomain: text("application_domain"),
  handoffAllowed: boolean("handoff_allowed"),
  handoffReason: text("handoff_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── application_history ────────────────────────────────────────────────────
export const applicationHistory = pgTable("application_history", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  fromStatus: applicationStatusEnum("from_status"),
  toStatus: applicationStatusEnum("to_status").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  note: text("note"),
});

// ── scrape_logs ────────────────────────────────────────────────────────────
export const scrapeLogs = pgTable("scrape_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  source: text("source").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  postingsFound: integer("postings_found").notNull().default(0),
  postingsNew: integer("postings_new").notNull().default(0),
  errorMessage: text("error_message"),
});

// ── profiles ───────────────────────────────────────────────────────────────
// One row per authenticated user (Supabase auth.users.id). Holds the common
// "common-application" fields the pipeline reuses when preparing packets. No
// cross-schema FK to auth.users — access is scoped by userId in app code.
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  // Work authorization — the two questions nearly every US application asks.
  authorizedToWork: boolean("authorized_to_work"),
  requiresSponsorship: boolean("requires_sponsorship"),
  willingToRelocate: boolean("willing_to_relocate"),
  desiredSalary: text("desired_salary"),
  availableStartDate: text("available_start_date"),
  skills: text("skills").array(),
  summary: text("summary"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── education ──────────────────────────────────────────────────────────────
export const education = pgTable(
  "education",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    school: text("school").notNull(),
    degree: text("degree"),
    fieldOfStudy: text("field_of_study"),
    // Free-text dates ("May 2026") so parsed résumé values round-trip cleanly.
    startDate: text("start_date"),
    endDate: text("end_date"),
    gpa: text("gpa"),
    details: text("details"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("education_user_idx").on(t.userId),
  })
);

// ── work_experience ────────────────────────────────────────────────────────
export const workExperience = pgTable(
  "work_experience",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    company: text("company").notNull(),
    title: text("title"),
    location: text("location"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("work_experience_user_idx").on(t.userId),
  })
);

// ── resumes ────────────────────────────────────────────────────────────────
// Metadata for a résumé file stored in the private Supabase `resumes` bucket.
// The original file stays in Storage; parsed text is kept for re-use/re-parse.
export const resumes = pgTable(
  "resumes",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    rawText: text("raw_text"),
    isPrimary: boolean("is_primary").notNull().default(true),
    parsedAt: timestamp("parsed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("resumes_user_idx").on(t.userId),
  })
);

// ── relations ──────────────────────────────────────────────────────────────
export const companiesRelations = relations(companies, ({ many }) => ({
  postings: many(postings),
  scrapeLogs: many(scrapeLogs),
}));

export const postingsRelations = relations(postings, ({ one, many }) => ({
  company: one(companies, { fields: [postings.companyId], references: [companies.id] }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  posting: one(postings, { fields: [applications.postingId], references: [postings.id] }),
  history: many(applicationHistory),
}));

export const applicationHistoryRelations = relations(applicationHistory, ({ one }) => ({
  application: one(applications, {
    fields: [applicationHistory.applicationId],
    references: [applications.id],
  }),
}));

export const scrapeLogsRelations = relations(scrapeLogs, ({ one }) => ({
  company: one(companies, { fields: [scrapeLogs.companyId], references: [companies.id] }),
}));

// ── inferred types ─────────────────────────────────────────────────────────
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Posting = typeof postings.$inferSelect;
export type NewPosting = typeof postings.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationHistory = typeof applicationHistory.$inferSelect;
export type ScrapeLog = typeof scrapeLogs.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Education = typeof education.$inferSelect;
export type NewEducation = typeof education.$inferInsert;
export type WorkExperience = typeof workExperience.$inferSelect;
export type NewWorkExperience = typeof workExperience.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
