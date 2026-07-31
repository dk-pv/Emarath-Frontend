"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconArrowRight, IconAt } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset } from "@/services/auth-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The forgot-password form (AUTH-03.1). Submits an email and then shows the same generic
 * confirmation regardless of whether the account exists — the UI must not reveal it either
 * (AC2). The backend returns success for any well-formed email, so the confirmation is
 * identical; only a transport failure surfaces an error.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setApiError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch {
      setApiError(
        "Can't reach the server. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-ink-muted">
          If an account exists for{" "}
          <span className="font-medium text-ink">{email.trim()}</span>,
          we&apos;ve sent a link to reset your password. The link can be used
          once and expires soon.
        </p>
        <Link
          href="/login"
          className="focus-ring inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-brand hover:text-brand-strong"
        >
          <IconArrowLeft className="size-4" aria-hidden="true" />
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <FormField label="Email" error={error ?? undefined}>
        {(control) => (
          <div className="relative">
            <IconAt
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              {...control}
              type="email"
              name="email"
              size="lg"
              autoComplete="email"
              placeholder="you@company.com"
              className="pl-10"
              value={email}
              disabled={submitting}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
            />
          </div>
        )}
      </FormField>

      {apiError && (
        <p role="alert" className="text-sm text-danger">
          {apiError}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={submitting} className="w-full">
        Send reset link
        {!submitting && (
          <IconArrowRight className="size-5" aria-hidden="true" />
        )}
      </Button>

      <div className="flex justify-center">
        <Link
          href="/login"
          className="focus-ring inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-ink-muted hover:text-ink"
        >
          <IconArrowLeft className="size-4" aria-hidden="true" />
          Back to login
        </Link>
      </div>
    </form>
  );
}
