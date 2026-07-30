import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Login screen (AUTH-01.6), traced to ui-reference/loginPage.png: a two-panel split — a
 * brand marketing panel on the left, the sign-in form on the right. Emarath brand name,
 * palette and logo replace Workpex's (the three permitted differences); layout, copy and
 * controls match. Below `lg` the marketing panel drops and the form fills the screen.
 *
 * Known reference gaps carried from the plan: the marketing photograph is Workpex-licensed
 * with no Emarath equivalent supplied, so its region is left out (not fabricated); the stat
 * card's decorative progress ring is omitted for the same reason.
 */
export function LoginView() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="max-w-md rounded-surface bg-white/10 p-8 text-white">
          <h2 className="text-3xl leading-tight font-semibold">
            Manage leads and close more deals with Emarath
          </h2>
          <p className="mt-4 text-white/85">
            Track leads, manage your sales pipeline, and stay on top of every
            opportunity — all in one simple CRM.
          </p>
        </div>

        <Card className="w-fit px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold text-ink">15%</span>
            <span className="text-sm text-ink-muted">More deals closed</span>
          </div>
        </Card>
      </section>

      <section className="flex items-center justify-center bg-surface p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <span
            className="flex items-baseline text-3xl font-semibold tracking-tight select-none"
            aria-label="Emarath"
          >
            <span className="text-brand">E</span>
            <span className="text-ink">marath</span>
          </span>

          <h1 className="mt-8 text-2xl font-semibold text-ink">
            Welcome back to Emarath
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Log in to manage your leads, track deals, and keep your sales
            process moving forward smoothly.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
