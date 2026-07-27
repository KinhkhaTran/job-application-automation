import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRedirect } from "@/lib/auth/redirect";

export async function middleware(request: NextRequest) {
  // Without Supabase configured, the app runs in its DB-less sample mode and
  // there is no auth to enforce — let every request through untouched.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const onboardingCompleted = Boolean(user?.user_metadata?.onboarding_completed);
  const target = resolveRedirect(
    Boolean(user),
    onboardingCompleted,
    request.nextUrl.pathname
  );

  if (target && target !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static image assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
