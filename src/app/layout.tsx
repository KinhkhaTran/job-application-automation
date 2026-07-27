import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";

export const metadata = {
  title: "Job Autopilot — new-grad SWE tracker",
  description: "Personal new-grad SWE job aggregation & application tracker",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <div className="no-print">
            <Sidebar />
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
