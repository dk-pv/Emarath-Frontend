import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password · Emarath",
};

/**
 * The token rides in the link's query string (`/reset-password?token=…`). It is read on the
 * server and handed to the client form, so no Suspense boundary is needed for
 * `useSearchParams` and the page renders without forcing the whole route dynamic.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthPageShell
      title="Set a new password"
      subtitle="Choose a new password for your Emarath account."
    >
      <ResetPasswordForm token={token ?? null} />
    </AuthPageShell>
  );
}
