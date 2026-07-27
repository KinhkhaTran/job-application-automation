import type { CompanyTarget } from "@/lib/scrapers/types";

// Three test companies using the mock adapter for increment 1.
// FUTURE DECISION: Before enabling real Greenhouse/Lever/Ashby adapters,
// confirm ATS platform choice with the user and review each platform's ToS.
// The companyId values here must match rows seeded in the `companies` table.
export const COMPANY_TARGETS: CompanyTarget[] = [
  {
    companyId: 1,
    companyName: "Stripe",
    atsBoardId: "stripe",
    careersUrl: "https://stripe.com/jobs",
  },
  {
    companyId: 2,
    companyName: "Linear",
    atsBoardId: "linear",
    careersUrl: "https://linear.app/careers",
  },
  {
    companyId: 3,
    companyName: "Notion",
    atsBoardId: "notion",
    careersUrl: "https://www.notion.so/careers",
  },
];
