"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 my-4 w-full max-w-2xl animate-fade-in rounded-2xl border border-hair2 bg-surface shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-hair px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <X width={18} height={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-hair px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
