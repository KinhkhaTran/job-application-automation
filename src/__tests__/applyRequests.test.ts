import {
  parseApprovalRequest,
  parseOpenRequest,
  parsePrepareRequest,
  toRawRequest,
  type RawRequest,
} from "../lib/apply/requests";

// Transport-shape rules for the three review-gate endpoints. These exist so the
// gate cannot be widened by accident: no GET, no query parameters, no arrays,
// no bulk fields, no unknown fields.

const FP = `v1:${"a".repeat(64)}`;
const URL_OK = "https://linear.app/careers/product-engineer";

function req(overrides: Partial<RawRequest> = {}): RawRequest {
  return {
    method: "POST",
    url: "https://dashboard.example/api/apply/approve",
    contentType: "application/json",
    body: { postingId: 42, fingerprint: FP, url: URL_OK },
    ...overrides,
  };
}

const PARSERS = [
  ["approval", parseApprovalRequest],
  ["open", parseOpenRequest],
  ["prepare", parsePrepareRequest],
] as const;

describe("every review-gate endpoint rejects the same unsafe envelopes", () => {
  it.each(PARSERS)("%s: rejects anything but POST", (_name, parse) => {
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "get"]) {
      const result = parse(req({ method, body: { postingId: 42 } }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("method-not-allowed");
      expect(result.status).toBe(405);
    }
  });

  it.each(PARSERS)("%s: accepts lowercase post", (_name, parse) => {
    // Casing of the verb is normalized; only the verb itself is the gate.
    const result = parse(req({ method: "post" }));
    if (!result.ok) expect(result.code).not.toBe("method-not-allowed");
  });

  it.each(PARSERS)("%s: rejects any query string", (_name, parse) => {
    for (const url of [
      "https://dashboard.example/api/apply/approve?approve=1",
      "https://dashboard.example/api/apply/approve?postingId=42",
      "https://dashboard.example/api/apply/approve?all=true&confirm=yes",
      "https://dashboard.example/api/apply/approve?",
    ]) {
      const result = parse(req({ url }));
      if (url.endsWith("?")) {
        // A bare "?" carries no parameters, so it is not treated as one.
        if (!result.ok) expect(result.code).not.toBe("query-parameters-not-accepted");
        continue;
      }
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("query-parameters-not-accepted");
      expect(result.status).toBe(400);
    }
  });

  it.each(PARSERS)("%s: rejects non-JSON content types", (_name, parse) => {
    for (const contentType of [
      null,
      "",
      "text/plain",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=xyz",
    ]) {
      const result = parse(req({ contentType }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("unsupported-media-type");
      expect(result.status).toBe(415);
    }
  });

  it.each(PARSERS)("%s: accepts a charset-qualified JSON content type", (_name, parse) => {
    const result = parse(req({ contentType: "application/json; charset=utf-8" }));
    if (!result.ok) expect(result.code).not.toBe("unsupported-media-type");
  });

  it.each(PARSERS)("%s: rejects a missing or non-object body", (_name, parse) => {
    for (const body of [undefined, null, "postingId=42", 42, true]) {
      const result = parse(req({ body }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-json");
    }
  });
});

describe("bulk and batch requests are rejected", () => {
  it.each(PARSERS)("%s: rejects a top-level array of postings", (_name, parse) => {
    const result = parse(req({ body: [{ postingId: 42, fingerprint: FP, url: URL_OK }] }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("bulk-not-supported");
    expect(result.error).toMatch(/one posting per request/i);
  });

  it.each(PARSERS)("%s: rejects an empty array too", (_name, parse) => {
    const result = parse(req({ body: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("bulk-not-supported");
  });

  const BULK_FIELDS = [
    "postingIds",
    "ids",
    "postings",
    "jobs",
    "items",
    "batch",
    "bulk",
    "all",
    "selection",
  ];

  it.each(BULK_FIELDS)("approval: rejects a %s field", (field) => {
    const result = parseApprovalRequest(
      req({ body: { postingId: 42, fingerprint: FP, url: URL_OK, [field]: [1, 2, 3] } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("bulk-not-supported");
  });

  it.each(BULK_FIELDS)("open: rejects a %s field", (field) => {
    const result = parseOpenRequest(
      req({ body: { postingId: 42, fingerprint: FP, [field]: true } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("bulk-not-supported");
  });

  it("rejects a bulk field even when its value looks harmless", () => {
    const result = parseApprovalRequest(
      req({ body: { postingId: 42, fingerprint: FP, url: URL_OK, all: false } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("bulk-not-supported");
  });
});

describe("unknown fields are rejected rather than ignored", () => {
  it("rejects an extra field on an approval", () => {
    const result = parseApprovalRequest(
      req({ body: { postingId: 42, fingerprint: FP, url: URL_OK, submit: true } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("unexpected-field");
    expect(result.error).toContain("submit");
  });

  it("rejects approval fields sent to the open endpoint", () => {
    const result = parseOpenRequest(
      req({ body: { postingId: 42, fingerprint: FP, url: URL_OK } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("unexpected-field");
  });
});

describe("field validation", () => {
  it("accepts a well-formed approval", () => {
    const result = parseApprovalRequest(req());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value).toEqual({ postingId: 42, fingerprint: FP, url: URL_OK });
  });

  it("accepts a well-formed open request", () => {
    const result = parseOpenRequest(req({ body: { postingId: 42, fingerprint: FP } }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value).toEqual({ postingId: 42, fingerprint: FP });
  });

  it("does not coerce a posting id", () => {
    for (const postingId of ["42", 0, -1, 1.5, NaN, null, [42], { id: 42 }]) {
      const result = parseApprovalRequest(
        req({ body: { postingId, fingerprint: FP, url: URL_OK } })
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-field");
      expect(result.error).toContain("postingId");
    }
  });

  it("requires a well-formed fingerprint", () => {
    for (const fingerprint of [undefined, "", "v1:nothex", "a".repeat(64), FP.toUpperCase()]) {
      const result = parseApprovalRequest(
        req({ body: { postingId: 42, fingerprint, url: URL_OK } })
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-field");
      expect(result.error).toContain("fingerprint");
    }
  });

  it("requires an https URL on an approval", () => {
    for (const url of [
      undefined,
      "",
      "http://linear.app/careers/1",
      "javascript:alert(1)",
      "//linear.app/careers/1",
      42,
    ]) {
      const result = parseApprovalRequest(
        req({ body: { postingId: 42, fingerprint: FP, url } })
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-field");
      expect(result.error).toContain("url");
    }
  });
});

describe("prepare requests", () => {
  const prepareReq = (body: unknown) =>
    parsePrepareRequest(
      req({ url: "https://dashboard.example/api/apply", body })
    );

  it("accepts a bare posting id", () => {
    const result = prepareReq({ postingId: 42 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value).toEqual({ postingId: 42 });
  });

  it("accepts human edits", () => {
    const result = prepareReq({
      postingId: 42,
      edits: {
        coverLetter: "Rewritten.",
        screeningAnswers: [{ question: "Sponsorship?", answer: "No." }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.edits).toEqual({
      coverLetter: "Rewritten.",
      screeningAnswers: [{ question: "Sponsorship?", answer: "No." }],
    });
  });

  it("rejects an unknown edit field", () => {
    const result = prepareReq({ postingId: 42, edits: { status: "submitted" } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("unexpected-field");
  });

  it("rejects an approval field smuggled into a prepare request", () => {
    const result = prepareReq({ postingId: 42, approval: { approvedBy: "human-review" } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("unexpected-field");
  });

  it("rejects malformed edit payloads", () => {
    for (const edits of [null, "coverLetter", 42, [], {}]) {
      const result = prepareReq({ postingId: 42, edits });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-field");
    }
  });

  it("rejects non-string edit values and malformed screening answers", () => {
    const bad: unknown[] = [
      { coverLetter: 42 },
      { resumeVersion: null },
      { screeningAnswers: "none" },
      { screeningAnswers: [{ question: "Sponsorship?" }] },
      { screeningAnswers: [{ question: 1, answer: 2 }] },
      { screeningAnswers: [null] },
    ];
    for (const edits of bad) {
      const result = prepareReq({ postingId: 42, edits });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.code).toBe("invalid-field");
    }
  });
});

describe("toRawRequest", () => {
  it("reads method, url, content type, and JSON body off a Request", async () => {
    const raw = await toRawRequest(
      new Request("https://dashboard.example/api/apply/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId: 42, fingerprint: FP, url: URL_OK }),
      })
    );
    expect(raw.method).toBe("POST");
    expect(raw.contentType).toBe("application/json");
    expect(raw.body).toEqual({ postingId: 42, fingerprint: FP, url: URL_OK });
    expect(parseApprovalRequest(raw).ok).toBe(true);
  });

  it("preserves the query string so the parser can reject it", async () => {
    const raw = await toRawRequest(
      new Request("https://dashboard.example/api/apply/approve?approve=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postingId: 42, fingerprint: FP, url: URL_OK }),
      })
    );
    const result = parseApprovalRequest(raw);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("query-parameters-not-accepted");
  });

  it("turns an unparseable body into a rejected request rather than a throw", async () => {
    const raw = await toRawRequest(
      new Request("https://dashboard.example/api/apply/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      })
    );
    expect(raw.body).toBeUndefined();
    const result = parseApprovalRequest(raw);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("invalid-json");
  });

  it("carries a GET through as a GET", async () => {
    const raw = await toRawRequest(
      new Request("https://dashboard.example/api/apply/approve")
    );
    const result = parseApprovalRequest(raw);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("method-not-allowed");
  });
});
