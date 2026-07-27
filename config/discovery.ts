import type { DiscoverySource } from "../src/lib/discovery/types";

// Explicitly configured public job-board sources for `npm run discover`.
//
// Discovery is OPT-IN and ships empty: nothing is fetched until you add a
// company here. Only ATS platforms with official public read-only job-board
// APIs are supported (Greenhouse, Lever, Ashby). Before adding a company,
// confirm its board handle resolves on the platform's public API and that
// you are comfortable with that platform's terms of service. Workday and
// other ATSes without a public listing API are intentionally unsupported.
//
// Example entries (verify the boardId before enabling — handles change):
//
// {
//   companyId: 101,
//   companyName: "Example Co",
//   ats: "greenhouse",           // boards-api.greenhouse.io/v1/boards/<boardId>/jobs
//   boardId: "exampleco",
//   careersUrl: "https://example.com/careers",
// },
// {
//   companyId: 102,
//   companyName: "Example Two",
//   ats: "lever",                // api.lever.co/v0/postings/<boardId>
//   boardId: "example-two",
//   careersUrl: "https://exampletwo.com/careers",
// },
// {
//   companyId: 103,
//   companyName: "Example Three",
//   ats: "ashby",                // api.ashbyhq.com/posting-api/job-board/<boardId>
//   boardId: "example-three",
//   careersUrl: "https://examplethree.com/careers",
// },
export const DISCOVERY_SOURCES: DiscoverySource[] = [];
