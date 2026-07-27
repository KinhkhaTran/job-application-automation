import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  /** Mono path shown above the title, e.g. "~/jobs". Defaults from the title. */
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const path = kicker ?? `~/${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker flex items-center gap-1.5">
          <span className="text-brand-400/70">❯</span>
          {path}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
