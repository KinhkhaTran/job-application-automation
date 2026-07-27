// Unit test for parseResume with the Anthropic SDK and mammoth fully mocked —
// no network, no real API key.

const parseMock = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { parse: parseMock },
  })),
}));

jest.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: jest.fn(() => ({ type: "json_schema", name: "resume" })),
}));

const extractRawText = jest.fn();
jest.mock("mammoth", () => ({
  __esModule: true,
  default: { extractRawText: (...args: unknown[]) => extractRawText(...args) },
}));

import { parseResume } from "@/lib/resume/parse";

const SAMPLE_PARSED = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  location: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  summary: null,
  skills: [],
  education: [],
  experience: [],
};

describe("parseResume", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockReset();
    extractRawText.mockReset();
    parseMock.mockResolvedValue({ parsed_output: SAMPLE_PARSED });
  });

  test("sends a PDF as a base64 document block and keeps rawText null", async () => {
    const bytes = Buffer.from("%PDF-1.4 fake", "utf8");
    const result = await parseResume(bytes, "application/pdf", "cv.pdf");

    expect(result.rawText).toBeNull();
    expect(result.parsed.fullName).toBe("Ada Lovelace");
    expect(extractRawText).not.toHaveBeenCalled();

    const req = parseMock.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-4-5");
    expect(req.max_tokens).toBe(4096);
    const blocks = req.messages[0].content;
    expect(blocks[0].type).toBe("document");
    expect(blocks[0].source.media_type).toBe("application/pdf");
    expect(blocks[0].source.data).toBe(bytes.toString("base64"));
    expect(blocks[1].type).toBe("text");
  });

  test("extracts DOCX text with mammoth and sends a text block", async () => {
    extractRawText.mockResolvedValue({ value: "Grace Hopper résumé text" });
    const bytes = Buffer.from("PK docx", "utf8");
    const result = await parseResume(
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "grace.docx"
    );

    expect(extractRawText).toHaveBeenCalledTimes(1);
    expect(result.rawText).toBe("Grace Hopper résumé text");
    const blocks = parseMock.mock.calls[0][0].messages[0].content;
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].text).toContain("Grace Hopper résumé text");
  });

  test("treats plain text as a text block", async () => {
    const bytes = Buffer.from("plain resume", "utf8");
    const result = await parseResume(bytes, "text/plain", "resume.txt");
    expect(extractRawText).not.toHaveBeenCalled();
    expect(result.rawText).toBe("plain resume");
    expect(parseMock.mock.calls[0][0].messages[0].content[0].type).toBe("text");
  });

  test("throws when the model returns no structured output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    await expect(
      parseResume(Buffer.from("x"), "text/plain", "r.txt")
    ).rejects.toThrow(/no structured output/i);
  });

  test("throws a clear error when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      parseResume(Buffer.from("x"), "text/plain", "r.txt")
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
