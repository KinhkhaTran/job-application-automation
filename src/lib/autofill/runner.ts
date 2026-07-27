// Local, human-in-the-loop autofill runner.
//
// Launches a VISIBLE browser on the user's own machine, navigates to an
// already-approved application URL, and fills known fields from the user's
// profile. It deliberately DOES NOT click submit — the user reviews the filled
// form and submits it themselves. The browser window is left open for them.
//
// Playwright is imported dynamically so the rest of the app (and the test
// suite) never depends on it being installed. This module only runs locally;
// the API route refuses to invoke it in a serverless/production environment.

import { existsSync } from "node:fs";
import type { AutofillField } from "./fieldMap";

export interface AutofillReport {
  url: string;
  pageTitle: string | null;
  filled: { key: string; label: string; matchedOn: string }[];
  skipped: { key: string; label: string; reason: string }[];
  resume: { attempted: boolean; uploaded: boolean; note: string };
  /** Always true: the runner never submits — the user does. */
  submitLeftToUser: true;
  notice: string;
}

const NOTICE =
  "The form was filled in a browser on your machine. Review every field, " +
  "complete anything left blank, and press Submit yourself. This tool never " +
  "clicks Submit.";

// Keep the launched browser alive across the request so it is not closed when
// this function returns, and close a prior one before opening a new window.
const g = globalThis as unknown as { __autofillBrowser?: { close(): Promise<void> } };

/**
 * The function evaluated INSIDE the page. Tags the best-matching input for each
 * field with data-autofill-key and returns which keys matched. Kept as a plain
 * function so Playwright can serialize it into the browser context.
 */
export function tagFieldsInPage(
  fields: { key: string; keywords: string[] }[]
): Record<string, string> {
  function labelText(el: Element): string {
    const bits: string[] = [];
    const id = el.getAttribute("id");
    if (id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lbl?.textContent) bits.push(lbl.textContent);
    }
    const wrapping = el.closest("label");
    if (wrapping?.textContent) bits.push(wrapping.textContent);
    for (const attr of ["aria-label", "placeholder", "name", "id"]) {
      const v = el.getAttribute(attr);
      if (v) bits.push(v);
    }
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      for (const ref of labelledby.split(/\s+/)) {
        const node = document.getElementById(ref);
        if (node?.textContent) bits.push(node.textContent);
      }
    }
    return bits.join(" ").toLowerCase().replace(/\s+/g, " ");
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("input, textarea")
  ).filter((el) => {
    if (el instanceof HTMLInputElement) {
      const skip = ["hidden", "password", "file", "submit", "button", "checkbox", "radio", "reset"];
      if (skip.includes(el.type)) return false;
      if (el.disabled || el.readOnly) return false;
    }
    if (el instanceof HTMLTextAreaElement && (el.disabled || el.readOnly)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0; // visible
  });

  const haystacks = new Map<HTMLElement, string>();
  for (const el of candidates) haystacks.set(el, labelText(el));

  const used = new Set<HTMLElement>();
  const matched: Record<string, string> = {};

  for (const field of fields) {
    let best: { el: HTMLElement; score: number; on: string } | null = null;
    for (const el of candidates) {
      if (used.has(el)) continue;
      const hay = haystacks.get(el) ?? "";
      for (const kw of field.keywords) {
        if (hay.includes(kw)) {
          const score = kw.length; // longer keyword = more specific match
          if (!best || score > best.score) best = { el, score, on: kw };
          break;
        }
      }
    }
    if (best) {
      used.add(best.el);
      best.el.setAttribute("data-autofill-key", field.key);
      matched[field.key] = best.on;
    }
  }
  return matched;
}

/** Inject a non-blocking banner so the human boundary is visible in the window. */
function bannerInPage(text: string): void {
  const id = "__autofill_banner";
  document.getElementById(id)?.remove();
  const bar = document.createElement("div");
  bar.id = id;
  bar.textContent = "⚠ " + text;
  Object.assign(bar.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    background: "#7c2d12",
    color: "#fff",
    font: "600 13px/1.4 system-ui, sans-serif",
    padding: "10px 16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
  });
  document.body.appendChild(bar);
}

export interface RunAutofillOptions {
  url: string;
  fields: AutofillField[];
  /** Absolute path to a résumé file to upload, if available locally. */
  resumePath?: string | null;
}

export async function runAutofill(opts: RunAutofillOptions): Promise<AutofillReport> {
  // Dynamic import keeps playwright out of the dependency graph for tests/builds.
  // The specifier is indirected through a variable so the type checker does not
  // require playwright's types to be installed (it is an optional local dep).
  let chromium: { launch(o: unknown): Promise<any> };
  const pkg = "playwright";
  try {
    ({ chromium } = (await import(pkg)) as any);
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` to enable autofill."
    );
  }

  // Replace any previous autofill window.
  try {
    await g.__autofillBrowser?.close();
  } catch {
    /* ignore a browser the user already closed */
  }

  const browser = await chromium.launch({ headless: false });
  g.__autofillBrowser = browser;
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Give client-rendered forms a moment to mount.
  await page.waitForTimeout(1500).catch(() => {});

  const pageTitle: string | null = await page.title().catch(() => null);

  const matched: Record<string, string> = await page.evaluate(
    tagFieldsInPage,
    opts.fields.map((f) => ({ key: f.key, keywords: f.keywords }))
  );

  const filled: AutofillReport["filled"] = [];
  const skipped: AutofillReport["skipped"] = [];

  for (const field of opts.fields) {
    const on = matched[field.key];
    if (!on) {
      skipped.push({ key: field.key, label: field.label, reason: "no matching field on page" });
      continue;
    }
    try {
      await page.fill(`[data-autofill-key="${field.key}"]`, field.value, { timeout: 5000 });
      filled.push({ key: field.key, label: field.label, matchedOn: on });
    } catch {
      skipped.push({ key: field.key, label: field.label, reason: "field could not be filled" });
    }
  }

  // Résumé upload (best-effort): only if a local file was provided.
  const resume: AutofillReport["resume"] = { attempted: false, uploaded: false, note: "" };
  if (opts.resumePath) {
    resume.attempted = true;
    if (!existsSync(opts.resumePath)) {
      resume.note = `Résumé file not found at ${opts.resumePath}`;
    } else {
      try {
        await page.setInputFiles('input[type="file"]', opts.resumePath, { timeout: 5000 });
        resume.uploaded = true;
        resume.note = "Résumé uploaded to the first file input.";
      } catch {
        resume.note = "No file input found — upload your résumé manually.";
      }
    }
  } else {
    resume.note = "Set AUTOFILL_RESUME_PATH to auto-upload your résumé.";
  }

  await page.evaluate(bannerInPage, NOTICE).catch(() => {});

  // Intentionally do NOT close the browser: the user reviews and submits.
  return {
    url: opts.url,
    pageTitle,
    filled,
    skipped,
    resume,
    submitLeftToUser: true,
    notice: NOTICE,
  };
}
