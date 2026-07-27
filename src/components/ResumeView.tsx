import type { ResumeData } from "@/lib/data/types";
import { Mail, Globe, MapPin, ArrowUpRight } from "./icons";

export function ResumeView({ resume }: { resume: ResumeData }) {
  return (
    <article className="card print-clean mx-auto max-w-3xl p-8 sm:p-10">
      {/* Header */}
      <header className="border-b border-hair pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{resume.name}</h1>
        <p className="mt-1 text-base text-brand-300">{resume.headline}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-zinc-400">
          {resume.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin width={13} height={13} /> {resume.location}
            </span>
          )}
          {resume.email && (
            <a href={`mailto:${resume.email}`} className="inline-flex items-center gap-1.5 hover:text-zinc-200">
              <Mail width={13} height={13} /> {resume.email}
            </a>
          )}
          {resume.website && (
            <span className="inline-flex items-center gap-1.5">
              <Globe width={13} height={13} /> {resume.website}
            </span>
          )}
          {resume.github && (
            <span className="inline-flex items-center gap-1.5 text-zinc-500">{resume.github}</span>
          )}
          {resume.linkedin && (
            <span className="inline-flex items-center gap-1.5 text-zinc-500">{resume.linkedin}</span>
          )}
        </div>
      </header>

      {/* Summary */}
      {resume.summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-zinc-300">{resume.summary}</p>
        </Section>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span key={s} className="chip border-hair text-zinc-300">
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
      <Section title="Experience">
        <div className="space-y-5">
          {resume.experience.map((e) => (
            <div key={e.company + e.role}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {e.role} <span className="font-normal text-zinc-400">· {e.company}</span>
                </h3>
                <span className="num text-xs text-zinc-500">{e.period}</span>
              </div>
              {e.location && <p className="text-xs text-zinc-500">{e.location}</p>}
              <ul className="mt-2 space-y-1.5">
                {e.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      )}

      {/* Projects */}
      {resume.projects.length > 0 && (
      <Section title="Projects">
        <div className="grid gap-3 sm:grid-cols-2">
          {resume.projects.map((p) => (
            <div key={p.name} className="rounded-xl border border-hair p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {p.link && (
                  <a
                    href={`https://${p.link}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-brand-300 no-print"
                  >
                    <ArrowUpRight width={14} height={14} />
                  </a>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tech.map((t) => (
                  <span key={t} className="rounded-md bg-slate-900/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
      <Section title="Education">
        {resume.education.map((ed) => (
          <div key={ed.school} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{ed.school}</h3>
              <p className="text-sm text-zinc-400">{ed.degree}</p>
              {ed.details && <p className="mt-0.5 text-xs text-zinc-500">{ed.details}</p>}
            </div>
            <span className="num text-xs text-zinc-500">{ed.period}</span>
          </div>
        ))}
      </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}
