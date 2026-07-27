// Request-shape validation for the review-gate endpoints.
//
// The gate is deliberately narrow, and these checks keep it that way:
//
//   * POST only — a link, a prefetch, or a stray <img> can never approve a packet.
//   * Body-only — any query string on the request URL is rejected outright, so
//     "?approve=1&postingId=…" style bypasses cannot exist even by accident.
//   * One posting per request — arrays and batch/bulk fields are rejected, so
//     there is no way to approve everything at once.
//   * Exact keys — unknown fields are rejected rather than ignored, so extra
//     parameters cannot smuggle in behaviour.

import { isWellFormedFingerprint } from "./fingerprint";

export type RequestRejectionCode =
  | "method-not-allowed"
  | "query-parameters-not-accepted"
  | "unsupported-media-type"
  | "invalid-json"
  | "bulk-not-supported"
  | "unexpected-field"
  | "invalid-field";

export interface RequestRejection {
  ok: false;
  status: number;
  code: RequestRejectionCode;
  error: string;
}

export interface RawRequest {
  method: string;
  /** The full request URL, including any query string. */
  url: string;
  contentType: string | null;
  /** Parsed JSON body, or `undefined` when the body was absent/unparseable. */
  body: unknown;
}

export interface ApprovalRequestBody {
  postingId: number;
  fingerprint: string;
  url: string;
}

export interface OpenRequestBody {
  postingId: number;
  fingerprint: string;
}

/** Field names that would mean "do this to many postings at once". */
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

function reject(
  status: number,
  code: RequestRejectionCode,
  error: string
): RequestRejection {
  return { ok: false, status, code, error };
}

function hasQueryString(rawUrl: string): boolean {
  const q = rawUrl.indexOf("?");
  // A bare trailing "?" carries no parameters; anything after it does.
  return q !== -1 && rawUrl.slice(q + 1).length > 0;
}

/**
 * Validate the transport-level shape of a review-gate request and return the
 * body as a plain object. Callers then validate individual fields.
 */
function parseEnvelope(
  req: RawRequest,
  allowedKeys: string[]
): { ok: true; body: Record<string, unknown> } | RequestRejection {
  if (req.method.toUpperCase() !== "POST") {
    return reject(
      405,
      "method-not-allowed",
      "Use POST with a JSON body; this action is never available over GET."
    );
  }

  if (hasQueryString(req.url)) {
    return reject(
      400,
      "query-parameters-not-accepted",
      "Query parameters are not accepted on this endpoint; send the request body only."
    );
  }

  const mediaType = (req.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return reject(
      415,
      "unsupported-media-type",
      "Content-Type must be application/json."
    );
  }

  if (Array.isArray(req.body)) {
    return reject(
      400,
      "bulk-not-supported",
      "Only one posting per request; arrays of postings are not accepted."
    );
  }
  if (typeof req.body !== "object" || req.body === null) {
    return reject(400, "invalid-json", "Request body must be a JSON object.");
  }

  const body = req.body as Record<string, unknown>;

  for (const field of BULK_FIELDS) {
    if (field in body) {
      return reject(
        400,
        "bulk-not-supported",
        `Field "${field}" is not accepted: approvals and handoffs are one posting at a time.`
      );
    }
  }

  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      return reject(
        400,
        "unexpected-field",
        `Unexpected field "${key}"; allowed fields are ${allowedKeys.join(", ")}.`
      );
    }
  }

  return { ok: true, body };
}

/** A posting id must be a real positive integer — strings are not coerced. */
function parsePostingId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function parseApprovalRequest(
  req: RawRequest
): { ok: true; value: ApprovalRequestBody } | RequestRejection {
  const envelope = parseEnvelope(req, ["postingId", "fingerprint", "url"]);
  if (!envelope.ok) return envelope;
  const { body } = envelope;

  const postingId = parsePostingId(body.postingId);
  if (postingId === null) {
    return reject(400, "invalid-field", "postingId must be a positive integer.");
  }
  if (!isWellFormedFingerprint(body.fingerprint)) {
    return reject(
      400,
      "invalid-field",
      "fingerprint must be the packet fingerprint you were shown."
    );
  }
  if (typeof body.url !== "string" || !body.url.startsWith("https://")) {
    return reject(
      400,
      "invalid-field",
      "url must be the exact https application URL you were shown."
    );
  }

  return {
    ok: true,
    value: { postingId, fingerprint: body.fingerprint, url: body.url },
  };
}

export interface PrepareRequestBody {
  postingId: number;
  /** Present only when the request carries human edits. */
  edits?: {
    resumeVersion?: string;
    coverLetter?: string;
    screeningAnswers?: { question: string; answer: string }[];
  };
}

function parseEdits(
  value: unknown
): { ok: true; value: PrepareRequestBody["edits"] } | RequestRejection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return reject(400, "invalid-field", "edits must be an object.");
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!["resumeVersion", "coverLetter", "screeningAnswers"].includes(key)) {
      return reject(400, "unexpected-field", `Unexpected edit field "${key}".`);
    }
  }

  const edits: NonNullable<PrepareRequestBody["edits"]> = {};
  for (const key of ["resumeVersion", "coverLetter"] as const) {
    if (key in raw) {
      if (typeof raw[key] !== "string") {
        return reject(400, "invalid-field", `edits.${key} must be a string.`);
      }
      edits[key] = raw[key] as string;
    }
  }
  if ("screeningAnswers" in raw) {
    const answers = raw.screeningAnswers;
    if (
      !Array.isArray(answers) ||
      !answers.every(
        (qa) =>
          typeof qa === "object" &&
          qa !== null &&
          typeof (qa as { question?: unknown }).question === "string" &&
          typeof (qa as { answer?: unknown }).answer === "string"
      )
    ) {
      return reject(
        400,
        "invalid-field",
        "edits.screeningAnswers must be an array of { question, answer } strings."
      );
    }
    edits.screeningAnswers = (answers as { question: string; answer: string }[]).map(
      (qa) => ({ question: qa.question, answer: qa.answer })
    );
  }

  if (Object.keys(edits).length === 0) {
    return reject(400, "invalid-field", "edits must change at least one field.");
  }
  return { ok: true, value: edits };
}

/**
 * Staging a packet — either a fresh draft or one carrying human edits. Both
 * paths clear any existing approval, so this endpoint can never approve.
 */
export function parsePrepareRequest(
  req: RawRequest
): { ok: true; value: PrepareRequestBody } | RequestRejection {
  const envelope = parseEnvelope(req, ["postingId", "edits"]);
  if (!envelope.ok) return envelope;
  const { body } = envelope;

  const postingId = parsePostingId(body.postingId);
  if (postingId === null) {
    return reject(400, "invalid-field", "postingId must be a positive integer.");
  }
  if (!("edits" in body)) return { ok: true, value: { postingId } };

  const edits = parseEdits(body.edits);
  if (!edits.ok) return edits;
  return { ok: true, value: { postingId, edits: edits.value } };
}

export function parseOpenRequest(
  req: RawRequest
): { ok: true; value: OpenRequestBody } | RequestRejection {
  const envelope = parseEnvelope(req, ["postingId", "fingerprint"]);
  if (!envelope.ok) return envelope;
  const { body } = envelope;

  const postingId = parsePostingId(body.postingId);
  if (postingId === null) {
    return reject(400, "invalid-field", "postingId must be a positive integer.");
  }
  if (!isWellFormedFingerprint(body.fingerprint)) {
    return reject(
      400,
      "invalid-field",
      "fingerprint must be the packet fingerprint you were shown."
    );
  }

  return { ok: true, value: { postingId, fingerprint: body.fingerprint } };
}

/** Read a Request into the shape these validators expect. */
export async function toRawRequest(req: Request): Promise<RawRequest> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  return {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    body,
  };
}
