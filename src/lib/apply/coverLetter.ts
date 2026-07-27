import Anthropic from "@anthropic-ai/sdk";
import { RESUME } from "@/lib/data/resume";
import type { ResumeData } from "@/lib/data/types";

// LLM-assisted cover letter drafting.
//
// This is the one place in the pipeline that spends model tokens, so it never
// runs automatically: a packet is staged with an empty cover letter, and this
// generator is invoked only when the user explicitly asks for a draft in the
// review gate. The human still reads and personalizes whatever comes back —
// this is a starting draft, never auto-submitted.

// Sonnet 4.6 — strong prose for a short, tailored letter, without reaching for
// the most expensive tier on a one-page document.
const MODEL = "claude-sonnet-4-6";

const SYSTEM = [
  "You are an expert cover letter writer. You produce ONE tailored cover letter",
  "for a specific role at a specific company. Generic letters are worthless.",
  "",
  "Follow this four-paragraph structure:",
  "1. Opening hook — why this role, why now, something specific about THIS",
  "   company or role. Never open with \"I am writing to express my interest\".",
  "2. Why you — two or three specific examples that map the candidate's",
  "   experience to what the posting asks for. Use language from the posting.",
  "   Do not just recap the résumé.",
  "3. Why this company — demonstrate fit. Reference the role's domain, product,",
  "   or mission. Generic praise does not count.",
  "4. Close — one clear call to action, and the candidate's contact email.",
  "",
  "Hard rules:",
  "- Under one page. Tight, concrete, no filler.",
  "- Use ONLY facts present in the candidate JSON. Never invent employers,",
  "  numbers, dates, or credentials.",
  "- Do NOT invent specific company facts (funding, launches, headcount) you",
  "  were not given. Anchor company references to the posting text and role.",
  "- No placeholders, brackets, TODOs, or \"[Company]\" tokens — the letter must",
  "  be ready to read end to end.",
  "- Match the tone to the company: measured and professional for large/",
  "  enterprise employers, direct and conversational for startups.",
  "- Output ONLY the letter text (greeting through sign-off). No preamble, no",
  "  markdown, no notes about what you did.",
].join("\n");

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — cannot generate a cover letter"
    );
  }
  if (!client) client = new Anthropic();
  return client;
}

/** Compact the résumé into the facts a cover letter can legitimately draw on. */
function resumeFacts(resume: ResumeData): string {
  const experience = resume.experience
    .map(
      (e) =>
        `- ${e.role} @ ${e.company} (${e.period}):\n` +
        e.bullets.map((b) => `    • ${b}`).join("\n")
    )
    .join("\n");
  const projects = resume.projects
    .map((p) => `- ${p.name}: ${p.description} [${p.tech.join(", ")}]`)
    .join("\n");
  const education = resume.education
    .map((ed) => `- ${ed.degree}, ${ed.school} (${ed.period})`)
    .join("\n");

  return [
    `Name: ${resume.name}`,
    `Contact email: ${resume.email}`,
    resume.headline ? `Headline: ${resume.headline}` : "",
    resume.summary ? `Summary: ${resume.summary}` : "",
    resume.skills.length ? `Skills: ${resume.skills.join(", ")}` : "",
    experience ? `Experience:\n${experience}` : "",
    projects ? `Projects:\n${projects}` : "",
    education ? `Education:\n${education}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface CoverLetterInput {
  company: string;
  role: string;
  location?: string | null;
  /** The scraped/enriched posting text, when available — this is what makes
   *  the letter genuinely tailored rather than generic. */
  description?: string | null;
  resume?: ResumeData;
}

/**
 * Generate a tailored cover letter for a posting. Spends model tokens, so
 * callers gate this behind an explicit user action.
 */
export async function generateCoverLetter(
  input: CoverLetterInput
): Promise<string> {
  const resume = input.resume ?? RESUME;

  const posting = [
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    input.location ? `Location: ${input.location}` : "",
    input.description
      ? `Job posting:\n${input.description.slice(0, 6000)}`
      : "Job posting: (not available — tailor from the company name and role, and do not invent specifics)",
  ]
    .filter(Boolean)
    .join("\n");

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Write a cover letter for this application.\n\n` +
          `=== POSTING ===\n${posting}\n\n` +
          `=== CANDIDATE ===\n${resumeFacts(resume)}`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Cover letter generation returned no text");
  }
  return text;
}
