import type { ReactNode } from "react";

/**
 * The shell for the secondary auth screens — Forgot Password and Reset Password (AUTH-03.1).
 *
 * Workpex has no reference for these screens (only loginPage.png exists), and the Product
 * Owner approved treating them as Emarath self-service additions that follow the login
 * screen's visual language. This reuses login's right-panel composition — the Emarath
 * wordmark, a heading and subtitle over the surface background — centred on the viewport,
 * rather than fabricating the marketing panel, which has no content for these pages.
 */
export function AuthPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-6 sm:p-10">
      <div className="w-full max-w-sm">
        <span
          className="flex items-baseline text-3xl font-semibold tracking-tight select-none"
          aria-label="Emarath"
        >
          <span className="text-brand">E</span>
          <span className="text-ink">marath</span>
        </span>

        <h1 className="mt-8 text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
