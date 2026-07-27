"use client";

import { useState } from "react";
import { Sparkles } from "@/components/icons";
import { signIn, signUp } from "@/app/login/actions";

export function AuthCard({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;

  return (
    <div className="w-full max-w-sm animate-fade-in rounded-2xl border border-hair bg-surface/70 p-7 shadow-card">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow">
          <Sparkles width={19} height={19} />
        </span>
        <div>
          <h1 className="text-sm font-semibold leading-tight text-zinc-100">
            Job Autopilot
          </h1>
          <p className="text-[11px] text-zinc-500">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
          {message}
        </p>
      ) : null}

      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-lg border border-hair bg-surface2/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-brand-500/60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
            className="rounded-lg border border-hair bg-surface2/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-brand-500/60"
          />
        </label>
        <button
          type="submit"
          className="mt-1 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90"
        >
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
      >
        {mode === "signin"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
