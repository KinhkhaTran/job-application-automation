import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getUserEmail } from "@/lib/supabase/server";

export const metadata = {
  title: "Job Autopilot — new-grad SWE tracker",
  description: "Personal new-grad SWE job aggregation & application tracker",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // null when unauthenticated or when Supabase isn't configured (sample mode).
  const userEmail = await getUserEmail();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell userEmail={userEmail}>{children}</AppShell>
      </body>
    </html>
  );
}
