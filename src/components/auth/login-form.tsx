"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconAt,
  IconEye,
  IconEyeOff,
  IconLock,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/auth/auth-context";
import { ApiError } from "@/lib/api-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The sign-in form (AUTH-01.6). Validates client-side, then hands credentials to the
 * AuthProvider; the backend sets the session cookies (AUTH-01.2). On success it lands the
 * user on the Dashboard. Route protection is a later phase — this only performs the login.
 */
export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) {
      next.email = "Enter your email.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!password) {
      next.password = "Enter your password.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setApiError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Session cookies are set; leave the loading state on through navigation so the
      // controls stay disabled until the Dashboard takes over.
      router.replace("/dashboard");
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Can't reach the server. Check your connection and try again.";
      setApiError(message);
      setSubmitting(false);
    }
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
      <FormField label="Email" error={errors.email}>
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
                if (errors.email) {
                  setErrors((current) => ({ ...current, email: undefined }));
                }
              }}
            />
          </div>
        )}
      </FormField>

      <FormField label="Password" error={errors.password}>
        {(control) => (
          <div className="relative">
            <IconLock
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              name="password"
              size="lg"
              autoComplete="current-password"
              placeholder="Enter your password"
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

      <div className="flex justify-end">
        {/* Present for parity; the reset flow is a later task (AUTH-03.1), so it is inert. */}
        <button
          type="button"
          disabled
          title="Password reset arrives in a later task."
          className="cursor-not-allowed text-sm font-medium text-ink-muted"
        >
          Forgot Password?
        </button>
      </div>

      {apiError && (
        <p role="alert" className="text-sm text-danger">
          {apiError}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={submitting} className="w-full">
        Login
        {!submitting && (
          <IconArrowRight className="size-5" aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
