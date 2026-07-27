import { resolveRedirect } from "@/lib/auth/redirect";

describe("resolveRedirect", () => {
  test("auth and api routes always pass through", () => {
    expect(resolveRedirect(false, false, "/auth/callback")).toBeNull();
    expect(resolveRedirect(true, false, "/api/resume")).toBeNull();
    expect(resolveRedirect(true, true, "/api/scan")).toBeNull();
  });

  describe("no session", () => {
    test("protected routes redirect to /login", () => {
      expect(resolveRedirect(false, false, "/")).toBe("/login");
      expect(resolveRedirect(false, false, "/jobs")).toBe("/login");
      expect(resolveRedirect(false, false, "/onboarding")).toBe("/login");
    });
    test("/login itself is allowed", () => {
      expect(resolveRedirect(false, false, "/login")).toBeNull();
    });
  });

  describe("session, onboarding incomplete", () => {
    test("non-onboarding routes redirect to /onboarding", () => {
      expect(resolveRedirect(true, false, "/")).toBe("/onboarding");
      expect(resolveRedirect(true, false, "/jobs")).toBe("/onboarding");
    });
    test("/onboarding is allowed", () => {
      expect(resolveRedirect(true, false, "/onboarding")).toBeNull();
    });
    test("/login redirects to /onboarding", () => {
      expect(resolveRedirect(true, false, "/login")).toBe("/onboarding");
    });
  });

  describe("session, onboarding complete", () => {
    test("app routes pass through", () => {
      expect(resolveRedirect(true, true, "/")).toBeNull();
      expect(resolveRedirect(true, true, "/jobs")).toBeNull();
      expect(resolveRedirect(true, true, "/profile")).toBeNull();
    });
    test("/login and /onboarding redirect home", () => {
      expect(resolveRedirect(true, true, "/login")).toBe("/");
      expect(resolveRedirect(true, true, "/onboarding")).toBe("/");
    });
  });
});
