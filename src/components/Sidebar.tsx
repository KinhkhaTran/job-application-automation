"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Briefcase, Kanban, FileText, UserCircle, LogOut } from "./icons";
import { cn } from "@/lib/data/format";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/resume", label: "Résumé", icon: FileText },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-hair bg-surface/40 px-4 py-6">
      {/* Wordmark as a shell prompt — this is the user's career build-console. */}
      <Link href="/" className="group mb-8 flex items-baseline gap-2 px-2">
        <span className="font-mono text-base font-bold text-brand-400 transition-colors group-hover:text-brand-300">
          ❯
        </span>
        <span className="font-mono text-sm font-semibold leading-tight text-zinc-100">
          job-autopilot
          <span className="mt-0.5 block text-[10px] font-normal tracking-kicker text-zinc-500">
            NEW-GRAD SWE
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-[13px] transition-colors",
                active
                  ? "bg-slate-900/[0.05] text-zinc-100"
                  : "text-zinc-400 hover:bg-slate-900/[0.03] hover:text-zinc-200"
              )}
            >
              <Icon
                width={16}
                height={16}
                className={cn(active ? "text-brand-400" : "text-zinc-500 group-hover:text-zinc-300")}
              />
              <span>
                <span className={cn(active ? "text-brand-400" : "text-zinc-600 group-hover:text-zinc-500")}>
                  /
                </span>
                {label.toLowerCase()}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400 shadow-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-lg border border-hair bg-surface2/60 p-3">
          <p className="eyebrow mb-1.5 text-brand-400/80">Human-in-the-loop</p>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Packets are staged for your review. Nothing is submitted to any ATS
            without you.
          </p>
        </div>

        {userEmail && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-hair bg-surface2/40 px-3 py-2">
            <span className="truncate font-mono text-[11px] text-zinc-400" title={userEmail}>
              {userEmail}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                className="flex items-center text-zinc-500 transition-colors hover:text-red-600"
              >
                <LogOut width={15} height={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
