/**
 * Pure routing policy for the auth/onboarding gate. Given whether the request
 * has an authenticated session, whether that user has finished onboarding, and
 * the requested pathname, returns the path to redirect to — or null to allow
 * the request through. Kept side-effect-free so it can be unit-tested.
 *
 * Rules:
 *  - /auth/* and /api/* always pass (they gate themselves).
 *  - No session → everything except /login redirects to /login.
 *  - Session + not onboarded → everything except /onboarding redirects there.
 *  - Session + onboarded → /login and /onboarding redirect to /.
 */
export function resolveRedirect(
  hasSession: boolean,
  onboardingCompleted: boolean,
  pathname: string
): string | null {
  if (pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return null;
  }

  const isLogin = pathname === "/login";

  if (!hasSession) {
    return isLogin ? null : "/login";
  }

  if (isLogin) {
    return onboardingCompleted ? "/" : "/onboarding";
  }

  if (!onboardingCompleted && pathname !== "/onboarding") {
    return "/onboarding";
  }

  if (onboardingCompleted && pathname === "/onboarding") {
    return "/";
  }

  return null;
}
