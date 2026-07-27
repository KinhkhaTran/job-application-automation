import type { IngestedPosting } from "@/lib/discovery/ingestUrl";
import { classifyPosting } from "@/lib/scrapers/classifier";

// A single real posting the dashboard shows out of the box: the amazon.jobs
// EFA Network Software Engineer I role the user pasted in. It is seeded from
// captured public data so the UI has something to display before any live
// ingest/scan runs. Live re-ingest via /api/ingest overwrites it with fresh
// data. Seeding is skipped under NODE_ENV=test so the store stays empty for
// unit tests.

const AMAZON_EFA_DESCRIPTION = `Annapurna Labs (AWS) is hiring an entry-level engineer to develop the highest-performing code in C for multiple open-source projects supporting EFA (Elastic Fabric Adapter). You will design new networking APIs, optimize the efficiency of the software stack, write comprehensive tests, create design documentation, and collaborate with ML infrastructure teams to validate products across large-scale clusters supporting AI workloads.

BASIC QUALIFICATIONS
• Bachelor's degree in computer science, computer engineering, or related field
• Strong programming skills in C through coursework, projects, or internships
• Knowledge of systems programming including memory management and performance optimization on Linux
• Experience with Git, code reviews, and build processes

PREFERRED QUALIFICATIONS
• Contributions to open source networking projects like Libfabric or Open MPI
• Coursework or experience in computer networking, protocol design, and distributed systems
• Experience developing performance-critical code focused on minimizing instruction count and occupancy
• Familiarity with HPC or ML infrastructure
• Full software development lifecycle experience including testing and operations`;

function build(
  partial: Omit<IngestedPosting, "isNewGrad" | "requiredYearsMin">
): IngestedPosting {
  const { isNewGrad, requiredYearsMin } = classifyPosting(
    partial.title,
    partial.description
  );
  return { ...partial, isNewGrad, requiredYearsMin };
}

export const SEED_POSTINGS: IngestedPosting[] = [
  build({
    companyName: "Amazon",
    title: "EFA Network Software Engineer I, Annapurna Labs",
    url: "https://www.amazon.jobs/jobs/10481932/apply",
    location: "Seattle, WA, USA",
    description: AMAZON_EFA_DESCRIPTION,
    postedAt: null,
    source: "ingest:amazon.jobs",
  }),
];

/** True when the store should be seeded (skipped for unit tests). */
export const SHOULD_SEED = process.env.NODE_ENV !== "test";
