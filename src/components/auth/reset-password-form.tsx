"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api-client";
import { resetPassword } from "@/services/auth-service";

/** Mirrors the backend strength rule (AUTH-03.1 AC3): at least 8 characters. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * The reset-password form (AUTH-03.1). Reads the token from the link (passed in by the
 * page), lets the user set a new password meeting the strength rule (AC3), and on success
 * sends them to login. A missing token, or a 401 from a used/expired/invalid link, shows a
 * clear recovery path rather than a dead end (AC4). After a successful reset only the new
 * password works and existing sessions are gone — enforced server-side.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const next: { password?: string; confirm?: string } = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirm !== password) {
      next.confirm = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setApiError(null);
    if (!token) {
      setLinkInvalid(true);
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        // Used, expired or tampered link — not a field problem.
        setLinkInvalid(true);
      } else if (error instanceof ApiError) {
        setErrors({ password: error.messages[0] ?? error.message });
      } else {
        setApiError(
          "Can't reach the server. Check your connection and try again.",
        );
      }
      setSubmitting(false);
    }
  }

  if (linkInvalid) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-ink-muted">
          This reset link is invalid or has expired. Reset links can be used
          once and expire for your security.
        </p>
        <Link
          href="/forgot-password"
          className="focus-ring inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-brand hover:text-brand-strong"
        >
          Request a new link
          <IconArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <p className="inline-flex items-center gap-2 text-sm text-ink">
          <IconCheck className="size-5 text-brand" aria-hidden="true" />
          Your password has been reset. You&apos;re signed out of other
          sessions.
        </p>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => router.replace("/login")}
        >
          Continue to login
          <IconArrowRight className="size-5" aria-hidden="true" />
        </Button>
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
      <FormField label="New password" error={errors.password}>
        {(control) => (
          <div className="relative">
            <IconLock
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              name="new-password"
              size="lg"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="pr-10 pl-10"
              value={password}
              disabled={submitting}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) {
                  setErrors((current) => ({ ...current, password: undefined }));
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="focus-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-ink-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showPassword ? (
                <IconEyeOff className="size-5" aria-hidden="true" />
              ) : (
                <IconEye className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </FormField>

      <FormField label="Confirm new password" error={errors.confirm}>
        {(control) => (
          <div className="relative">
            <IconLock
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              name="confirm-password"
              size="lg"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              className="pl-10"
              value={confirm}
              disabled={submitting}
              onChange={(event) => {
                setConfirm(event.target.value);
                if (errors.confirm) {
                  setErrors((current) => ({ ...current, confirm: undefined }));
                }
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
        Reset password
        {!submitting && (
          <IconArrowRight className="size-5" aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
