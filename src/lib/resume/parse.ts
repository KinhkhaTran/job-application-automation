import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import mammoth from "mammoth";
import { ParsedResumeSchema, type ParsedResume } from "./schema";

// Haiku 4.5 — a fast, inexpensive model well-suited to structured extraction.
const MODEL = "claude-haiku-4-5";

const SYSTEM =
  "You extract structured data from a résumé. Only use information that is " +
  "actually present in the document. Use null for any field that is missing — " +
  "never guess, infer, or fabricate details.";

// Created lazily so importing this module during build/tests (no API key) is safe.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — cannot parse résumés");
  }
  if (!client) client = new Anthropic();
  return client;
}

export interface ParseResult {
  parsed: ParsedResume;
  /** Extracted plain text when available (DOCX/TXT); null for PDFs sent as documents. */
  rawText: string | null;
}

/**
 * Builds the message content for Claude. PDFs are sent as a native `document`
 * block (Claude reads the PDF directly); DOCX is converted to text via mammoth;
 * everything else is treated as UTF-8 text.
 */
async function buildContent(
  bytes: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ content: Anthropic.MessageParam["content"]; rawText: string | null }> {
  const name = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    return {
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: bytes.toString("base64"),
          },
        },
        { type: "text", text: "Extract the structured fields from this résumé." },
      ],
      rawText: null,
    };
  }

  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");
  const text = isDocx
    ? (await mammoth.extractRawText({ buffer: bytes })).value
    : bytes.toString("utf8");

  return {
    content: [
      {
        type: "text",
        text: `Résumé text:\n\n${text}\n\nExtract the structured fields from this résumé.`,
      },
    ],
    rawText: text,
  };
}

/** Parse a résumé file into structured, schema-validated profile fields. */
export async function parseResume(
  bytes: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParseResult> {
  const { content, rawText } = await buildContent(bytes, mimeType, fileName);

  const message = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ParsedResumeSchema) },
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("Résumé parsing returned no structured output");
  }
  return { parsed, rawText };
}
