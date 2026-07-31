import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password · Emarath",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
