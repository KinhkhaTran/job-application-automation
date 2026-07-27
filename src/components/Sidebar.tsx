"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Briefcase, Kanban, FileText } from "./icons";
import { cn } from "@/lib/data/format";

const NAV = [
  { href: "/", label: "Overview", icon: Sparkles },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/resume", label: "Résumé", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-hair bg-surface/40 px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow">
          <Sparkles width={18} height={18} />
        </span>
        <span className="text-sm font-semibold leading-tight text-zinc-100">
          Job Autopilot
          <span className="block text-[11px] font-normal text-zinc-500">
            new-grad SWE
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.06] text-zinc-100"
                  : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              )}
            >
              <Icon
                width={17}
                height={17}
                className={cn(active ? "text-brand-300" : "text-zinc-500 group-hover:text-zinc-300")}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-hair bg-surface2/60 p-3">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-300">Human-in-the-loop.</span> Packets
          are staged for your review — nothing is auto-submitted to any ATS.
        </p>
      </div>
    </aside>
  );
}
