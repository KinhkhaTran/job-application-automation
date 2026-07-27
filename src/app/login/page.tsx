import { AuthCard } from "@/components/auth/AuthCard";

export const metadata = { title: "Sign in — Job Autopilot" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <AuthCard error={searchParams.error} message={searchParams.message} />
    </div>
  );
}
