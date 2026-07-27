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
