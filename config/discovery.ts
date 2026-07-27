import type { DiscoverySource } from "../src/lib/discovery/types";

// Production public job-board sources. Board handles were verified against
// the official ATS APIs on 2026-07-27 and should be rechecked if a source
// starts returning 404s. Discovery only reads public listings.
export const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    companyId: 1,
    companyName: "Stripe",
    ats: "greenhouse",
    boardId: "stripe",
    careersUrl: "https://stripe.com/jobs/search",
  },
  {
    companyId: 2,
    companyName: "Linear",
    ats: "ashby",
    boardId: "linear",
    careersUrl: "https://linear.app/careers",
  },
  {
    companyId: 3,
    companyName: "Figma",
    ats: "greenhouse",
    boardId: "figma",
    careersUrl: "https://www.figma.com/careers/",
  },
  {
    companyId: 4,
    companyName: "Vercel",
    ats: "greenhouse",
    boardId: "vercel",
    careersUrl: "https://vercel.com/careers",
  },
  {
    companyId: 5,
    companyName: "Ramp",
    ats: "ashby",
    boardId: "ramp",
    careersUrl: "https://ramp.com/careers",
  },
];
