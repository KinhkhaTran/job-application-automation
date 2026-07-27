"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

// Routes that render full-bleed without the app chrome (sidebar + centered main).
function isBareRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth")
  );
}

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (isBareRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="no-print">
        <Sidebar userEmail={userEmail} />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10">
        {children}
      </main>
    </div>
  );
}
