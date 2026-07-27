"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveOnboarding, type SaveState } from "@/app/onboarding/actions";
import type { OnboardingInput } from "@/lib/profile/schema";
import type { OnboardingFormValues } from "@/lib/profile/form";
import type { ParsedResume } from "@/lib/resume/schema";

type FormState = OnboardingFormValues;
type EduRow = FormState["education"][number];
type ExpRow = FormState["experience"][number];
type ResumeMeta = OnboardingInput["resume"];

export interface OnboardingFormProps {
  mode: "onboarding" | "edit";
  initial: FormState;
}

const STEPS = ["Résumé", "About you", "Education", "Experience", "Review"];

const s = (v: string | null | undefined) => v ?? "";
const clean = (v: string) => {
  const t = v.trim();
  return t === "" ? undefined : t;
};

export function OnboardingForm({ mode, initial }: OnboardingFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState<string | null>(
    initial.resume ? initial.resume.fileName : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useFormState<SaveState, FormData>(saveOnboarding, {
    ok: true,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      applyParsed(data.parsed as ParsedResume, data.resume as ResumeMeta);
      setUploadDone(file.name);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function applyParsed(p: ParsedResume, resume: ResumeMeta) {
    setForm((f) => ({
      ...f,
      fullName: s(p.fullName) || f.fullName,
      email: s(p.email) || f.email,
      phone: s(p.phone) || f.phone,
      location: s(p.location) || f.location,
      linkedinUrl: s(p.linkedinUrl) || f.linkedinUrl,
      githubUrl: s(p.githubUrl) || f.githubUrl,
      portfolioUrl: s(p.portfolioUrl) || f.portfolioUrl,
      summary: s(p.summary) || f.summary,
      skills: p.skills.length ? p.skills : f.skills,
      education: p.education.length
        ? p.education.map((e) => ({
            school: s(e.school),
            degree: s(e.degree),
            fieldOfStudy: s(e.fieldOfStudy),
            startDate: s(e.startDate),
            endDate: s(e.endDate),
            gpa: s(e.gpa),
            details: "",
          }))
        : f.education,
      experience: p.experience.length
        ? p.experience.map((x) => ({
            company: s(x.company),
            title: s(x.title),
            location: s(x.location),
            startDate: s(x.startDate),
            endDate: s(x.endDate),
            isCurrent: false,
            description: s(x.description),
          }))
        : f.experience,
      resume: resume ?? f.resume,
    }));
  }

  // Assemble the validated payload the server action expects.
  const payload: OnboardingInput = {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: clean(form.phone),
    location: clean(form.location),
    linkedinUrl: clean(form.linkedinUrl),
    githubUrl: clean(form.githubUrl),
    portfolioUrl: clean(form.portfolioUrl),
    authorizedToWork: form.authorizedToWork,
    requiresSponsorship: form.requiresSponsorship,
    willingToRelocate: form.willingToRelocate,
    desiredSalary: clean(form.desiredSalary),
    availableStartDate: clean(form.availableStartDate),
    summary: clean(form.summary),
    skills: form.skills.map((x) => x.trim()).filter(Boolean),
    education: form.education
      .filter((e) => e.school.trim())
      .map((e) => ({
        school: e.school.trim(),
        degree: clean(e.degree),
        fieldOfStudy: clean(e.fieldOfStudy),
        startDate: clean(e.startDate),
        endDate: clean(e.endDate),
        gpa: clean(e.gpa),
        details: clean(e.details),
      })),
    experience: form.experience
      .filter((x) => x.company.trim())
      .map((x) => ({
        company: x.company.trim(),
        title: clean(x.title),
        location: clean(x.location),
        startDate: clean(x.startDate),
        endDate: clean(x.endDate),
        isCurrent: x.isCurrent,
        description: clean(x.description),
      })),
    resume: form.resume ?? null,
  };

  const canSubmit = payload.fullName !== "" && /.+@.+\..+/.test(payload.email);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Stepper step={step} />

      <div className="mt-6 rounded-2xl border border-hair bg-surface/60 p-6 shadow-card">
        {step === 0 && (
          <ResumeStep
            uploading={uploading}
            uploadError={uploadError}
            uploadDone={uploadDone}
            fileRef={fileRef}
            onFile={onFile}
          />
        )}
        {step === 1 && <AboutStep form={form} set={set} />}
        {step === 2 && (
          <ListStep
            kind="education"
            rows={form.education}
            onChange={(rows) => set("education", rows)}
          />
        )}
        {step === 3 && (
          <ListStep
            kind="experience"
            rows={form.experience}
            onChange={(rows) => set("experience", rows)}
          />
        )}
        {step === 4 && <ReviewStep payload={payload} />}
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((n) => Math.max(0, n - 1))}
          className="rounded-lg border border-hair px-4 py-2 text-sm text-zinc-300 disabled:opacity-40 hover:bg-slate-900/[0.04]"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
            className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90"
          >
            {step === 0 ? (uploadDone ? "Continue" : "Skip & continue") : "Next"}
          </button>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="payload" value={JSON.stringify(payload)} />
            <SubmitButton mode={mode} disabled={!canSubmit} />
          </form>
        )}
      </div>
    </div>
  );
}

function SubmitButton({
  mode,
  disabled,
}: {
  mode: "onboarding" | "edit";
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50"
    >
      {pending
        ? "Saving…"
        : mode === "edit"
          ? "Save changes"
          : "Finish setup"}
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1.5">
          <div
            className={
              "h-1 rounded-full " +
              (i <= step ? "bg-brand-500" : "bg-slate-900/[0.08]")
            }
          />
          <span
            className={
              "text-[10px] " + (i <= step ? "text-zinc-300" : "text-zinc-600")
            }
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResumeStep({
  uploading,
  uploadError,
  uploadDone,
  fileRef,
  onFile,
}: {
  uploading: boolean;
  uploadError: string | null;
  uploadDone: string | null;
  fileRef: RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-100">Upload your résumé</h2>
      <p className="mt-1 text-xs text-zinc-500">
        We&apos;ll read it with Claude and pre-fill the next steps. PDF, DOCX, or
        TXT — you can review and edit everything before saving. Or skip and fill
        it in yourself.
      </p>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hair2 bg-surface2/40 px-6 py-10 text-center hover:bg-surface2/70">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <span className="text-sm font-medium text-zinc-200">
          {uploading ? "Parsing résumé…" : "Choose a file"}
        </span>
        <span className="text-[11px] text-zinc-500">Max 8 MB</span>
      </label>

      {uploadDone && !uploading && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Parsed “{uploadDone}”. Review the pre-filled fields in the next steps.
        </p>
      )}
      {uploadError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {uploadError}
        </p>
      )}
    </div>
  );
}

function AboutStep({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Text label="Full name *" value={form.fullName} onChange={(v) => set("fullName", v)} />
      <Text label="Email *" value={form.email} onChange={(v) => set("email", v)} type="email" />
      <Text label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
      <Text label="Location" value={form.location} onChange={(v) => set("location", v)} />
      <Text label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} />
      <Text label="GitHub URL" value={form.githubUrl} onChange={(v) => set("githubUrl", v)} />
      <Text label="Portfolio URL" value={form.portfolioUrl} onChange={(v) => set("portfolioUrl", v)} />
      <Text label="Desired salary" value={form.desiredSalary} onChange={(v) => set("desiredSalary", v)} />
      <Text label="Available start date" value={form.availableStartDate} onChange={(v) => set("availableStartDate", v)} />
      <Text label="Skills (comma-separated)" value={form.skills.join(", ")} onChange={(v) => set("skills", v.split(",").map((x) => x.trim()).filter(Boolean))} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <Label>Summary</Label>
        <textarea
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-hair bg-surface2/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500/60"
        />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-hair bg-surface2/40 p-3">
        <Toggle label="Authorized to work in the US" checked={form.authorizedToWork} onChange={(v) => set("authorizedToWork", v)} />
        <Toggle label="Will require visa sponsorship" checked={form.requiresSponsorship} onChange={(v) => set("requiresSponsorship", v)} />
        <Toggle label="Willing to relocate" checked={form.willingToRelocate} onChange={(v) => set("willingToRelocate", v)} />
      </div>
    </div>
  );
}

function ListStep({
  kind,
  rows,
  onChange,
}: {
  kind: "education" | "experience";
  rows: (EduRow | ExpRow)[];
  onChange: (rows: any[]) => void;
}) {
  const isEdu = kind === "education";
  const empty = isEdu
    ? { school: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", gpa: "", details: "" }
    : { company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, description: "" };

  function update(i: number, patch: Record<string, unknown>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">
          {isEdu ? "Education" : "Work experience"}
        </h2>
        <button
          type="button"
          onClick={() => onChange([...rows, { ...empty }])}
          className="rounded-lg border border-hair px-3 py-1.5 text-xs text-zinc-300 hover:bg-slate-900/[0.04]"
        >
          + Add
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {rows.length === 0 && (
          <p className="text-xs text-zinc-500">Nothing yet — add an entry above.</p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-hair bg-surface2/40 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {isEdu ? (
                <>
                  <Text label="School" value={(row as EduRow).school} onChange={(v) => update(i, { school: v })} />
                  <Text label="Degree" value={(row as EduRow).degree} onChange={(v) => update(i, { degree: v })} />
                  <Text label="Field of study" value={(row as EduRow).fieldOfStudy} onChange={(v) => update(i, { fieldOfStudy: v })} />
                  <Text label="GPA" value={(row as EduRow).gpa} onChange={(v) => update(i, { gpa: v })} />
                  <Text label="Start" value={(row as EduRow).startDate} onChange={(v) => update(i, { startDate: v })} />
                  <Text label="End" value={(row as EduRow).endDate} onChange={(v) => update(i, { endDate: v })} />
                </>
              ) : (
                <>
                  <Text label="Company" value={(row as ExpRow).company} onChange={(v) => update(i, { company: v })} />
                  <Text label="Title" value={(row as ExpRow).title} onChange={(v) => update(i, { title: v })} />
                  <Text label="Location" value={(row as ExpRow).location} onChange={(v) => update(i, { location: v })} />
                  <Text label="Start" value={(row as ExpRow).startDate} onChange={(v) => update(i, { startDate: v })} />
                  <Text label="End" value={(row as ExpRow).endDate} onChange={(v) => update(i, { endDate: v })} />
                  <div className="flex items-end">
                    <Toggle label="Current role" checked={(row as ExpRow).isCurrent} onChange={(v) => update(i, { isCurrent: v })} />
                  </div>
                </>
              )}
            </div>
            <div className="mt-3">
              <Label>{isEdu ? "Details" : "Description"}</Label>
              <textarea
                value={isEdu ? (row as EduRow).details : (row as ExpRow).description}
                onChange={(e) => update(i, isEdu ? { details: e.target.value } : { description: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-hair bg-surface/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500/60"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="mt-2 text-[11px] text-zinc-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ payload }: { payload: OnboardingInput }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-100">Review & save</h2>
      <p className="mt-1 text-xs text-zinc-500">
        This is what we&apos;ll store and reuse when preparing application packets.
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Row k="Name" v={payload.fullName} />
        <Row k="Email" v={payload.email} />
        <Row k="Phone" v={payload.phone} />
        <Row k="Location" v={payload.location} />
        <Row k="Work authorized" v={payload.authorizedToWork ? "Yes" : "No"} />
        <Row k="Needs sponsorship" v={payload.requiresSponsorship ? "Yes" : "No"} />
        <Row k="Education entries" v={String(payload.education.length)} />
        <Row k="Experience entries" v={String(payload.experience.length)} />
        <Row k="Skills" v={payload.skills.join(", ")} />
        <Row k="Résumé" v={payload.resume?.fileName ?? "— none uploaded —"} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-hair py-1.5">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="truncate text-right text-zinc-200">{v || "—"}</dd>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11px] font-medium text-zinc-400">{children}</span>;
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={"flex flex-col " + className}>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-hair bg-surface2/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500/60"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-hair bg-surface2 accent-brand-500"
      />
      {label}
    </label>
  );
}
