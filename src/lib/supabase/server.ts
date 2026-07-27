import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** True when the Supabase env vars are present. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Server-side Supabase client bound to the request cookies. Safe to call from
 * Server Components (cookie writes are no-ops there and swallowed), Server
 * Actions, and Route Handlers (cookie writes persist the refreshed session).
 */
export function createClient() {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookies are read-only here. The
            // session is refreshed by middleware, so this is safe to ignore.
          }
        },
      },
    }
  );
}

/** Returns the signed-in user's email, or null if unauthenticated / unconfigured. */
export async function getUserEmail(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
