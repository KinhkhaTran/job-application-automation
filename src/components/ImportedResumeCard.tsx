import type { Resume } from "@/lib/db";
import { formatDate } from "@/lib/data/format";
import { FileText, Check } from "./icons";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The uploaded résumé file, shown as a document card so the user can see the
 * exact file that gets attached to application packets — not sample content.
 */
export function ImportedResumeCard({ resume }: { resume: Resume }) {
  const parsed = Boolean(resume.parsedAt);
  return (
    <div className="card mx-auto mb-4 flex max-w-3xl items-center gap-4 p-4">
      {/* Paper-document thumbnail */}
      <div className="relative shrink-0">
        <div className="flex h-16 w-12 flex-col gap-1 rounded-md border border-hair bg-white p-2 shadow-card">
          <div className="h-1 w-full rounded-full bg-zinc-800" />
          <div className="h-1 w-9/12 rounded-full bg-zinc-800" />
          <div className="h-1 w-full rounded-full bg-zinc-800" />
          <div className="h-1 w-7/12 rounded-full bg-zinc-800" />
        </div>
        <span className="absolute -bottom-1.5 -right-1.5 rounded bg-brand-500 px-1 py-0.5 font-mono text-[8px] font-semibold text-white">
          {resume.mimeType.includes("pdf")
            ? "PDF"
            : resume.mimeType.includes("word") || resume.fileName.endsWith(".docx")
              ? "DOCX"
              : "TXT"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <FileText width={14} height={14} className="shrink-0 text-brand-400" />
          <p className="truncate text-sm font-semibold text-zinc-100">
            {resume.fileName}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">
          {humanSize(resume.sizeBytes)} · Imported{" "}
          {formatDate(resume.createdAt.toISOString())}
        </p>
      </div>

      {parsed && (
        <span className="chip border-emerald-500/30 bg-emerald-50 text-emerald-600">
          <Check width={12} height={12} /> Parsed
        </span>
      )}
    </div>
  );
}
