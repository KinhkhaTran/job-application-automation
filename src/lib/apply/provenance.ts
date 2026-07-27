// Packet provenance.
//
// Every field of a staged application packet records where its content came
// from and whether a human still has to supply or confirm something. This is
// what the review UI surfaces as "needs your input" warnings, and it feeds the
// packet fingerprint so approving a packet approves its provenance too.

/** Where a packet field's content came from. */
export type ProvenanceSource =
  | "resume-library" // picked from the local résumé version list
  | "generated-template" // drafted locally from a template
  | "generated-llm" // drafted on demand by the model
  | "stored-profile" // answers the user configured once
  | "posting"; // taken from the scraped posting

export interface PacketProvenance {
  /** Stable field key, e.g. "coverLetter" or "screeningAnswers[0]". */
  field: string;
  /** Human label for the review UI. */
  label: string;
  source: ProvenanceSource;
  /** True when the user must write, fix, or confirm this before applying. */
  needsUserInput: boolean;
  /** Why it is flagged, or how the content was produced. */
  note: string;
}

/** Tokens that mean a draft still has a hole in it. */
const PLACEHOLDER = /\[[^\]]*\]|\bTODO\b|\bTBD\b|\bXX+\b/;

/**
 * Questions this tool cannot answer from stored data — the answer is always a
 * judgement call, so a pre-filled answer must be confirmed by the user.
 */
const JUDGEMENT_QUESTION =
  /salary|compensation|expected pay|why (do you|are you)|referr|notice period|relocat/i;

export interface ProvenanceInput {
  resumeVersion: string;
  coverLetter: string;
  screeningAnswers: { question: string; answer: string }[];
  /** Whether the application URL passed the handoff allowlist check. */
  handoffAllowed: boolean;
}

/**
 * Describe the provenance of every reviewable field. Pure and deterministic:
 * the same draft always produces the same records, which is what lets the
 * fingerprint include them.
 */
export function buildProvenance(input: ProvenanceInput): PacketProvenance[] {
  const records: PacketProvenance[] = [
    {
      field: "resumeVersion",
      label: "Résumé version",
      source: "resume-library",
      needsUserInput: input.resumeVersion.trim() === "",
      note:
        input.resumeVersion.trim() === ""
          ? "No résumé version was selected — pick one before applying."
          : "Selected from your résumé library by title keywords. Upload this version yourself.",
    },
    {
      field: "coverLetter",
      label: "Cover letter",
      // Empty until the user asks for a draft; once drafted it comes from the
      // model (or their own edits).
      source: input.coverLetter.trim() === "" ? "generated-template" : "generated-llm",
      // A draft is never submission-ready without a human read.
      needsUserInput: true,
      note:
        input.coverLetter.trim() === ""
          ? "No cover letter yet — generate a draft or write one before applying."
          : PLACEHOLDER.test(input.coverLetter)
            ? "Draft still contains placeholders — fill them in and read it end to end."
            : "AI draft — read it end to end and personalize before you submit.",
    },
    {
      field: "applicationUrl",
      label: "Application URL",
      source: "posting",
      needsUserInput: !input.handoffAllowed,
      note: input.handoffAllowed
        ? "Normalized from the scraped posting URL (https, credential-free, public host)."
        : "URL failed a safety check (must be https, credential-free, and a public host) — verify the real posting yourself before applying.",
    },
  ];

  input.screeningAnswers.forEach((qa, i) => {
    const empty = qa.answer.trim() === "";
    const placeholder = PLACEHOLDER.test(qa.answer);
    const judgement = JUDGEMENT_QUESTION.test(qa.question);
    records.push({
      field: `screeningAnswers[${i}]`,
      label: qa.question,
      source: "stored-profile",
      needsUserInput: empty || placeholder || judgement,
      note: empty
        ? "No stored answer — answer this yourself on the posting."
        : placeholder
          ? "Stored answer contains a placeholder — replace it before applying."
          : judgement
            ? "This answer is a judgement call — confirm it before applying."
            : "Pre-filled from your stored profile answers.",
    });
  });

  return records;
}

/** Sorted field keys that still need the user, used by the fingerprint. */
export function needsUserInputFields(records: PacketProvenance[]): string[] {
  return records
    .filter((r) => r.needsUserInput)
    .map((r) => r.field)
    .sort();
}
