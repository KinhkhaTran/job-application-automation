import type { AtsAdapter, CompanyTarget, RawPosting } from "../types";

export const MOCK_POSTINGS: RawPosting[] = [
  {
    externalId: "mock-001",
    title: "Software Engineer, New Grad",
    url: "https://careers.example.com/jobs/1",
    location: "San Francisco, CA",
    description:
      "Exciting opportunity for a new grad SWE. We welcome candidates with 0-1 years of experience.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "mock",
    rawData: { id: "mock-001" },
  },
  {
    externalId: "mock-002",
    title: "Senior Software Engineer",
    url: "https://careers.example.com/jobs/2",
    location: "Remote",
    description:
      "Seeking a senior engineer with 5+ years of professional experience.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "mock",
    rawData: { id: "mock-002" },
  },
  {
    externalId: "mock-003",
    title: "Entry Level Backend Engineer",
    url: "https://careers.example.com/jobs/3",
    location: "New York, NY",
    description:
      "Entry level position for recent graduates. Class of 2026 grads encouraged to apply.",
    postedAt: "2026-07-01T00:00:00Z",
    source: "mock",
    rawData: { id: "mock-003" },
  },
];

export class MockAdapter implements AtsAdapter {
  readonly name = "mock";

  async fetchPostings(_target: CompanyTarget): Promise<RawPosting[]> {
    return [...MOCK_POSTINGS];
  }
}
