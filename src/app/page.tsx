import { env } from "@/lib/env";
import { HealthStatus } from "@/components/health-status";

/**
 * Temporary Emarath landing route (backlog task FND-01.1).
 *
 * This exists only to confirm the frontend runs and to surface the active
 * environment + backend connectivity. It is NOT the final login page,
 * dashboard, or application shell — those are separate, later backlog tasks.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
          {env.appEnv}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {env.appName}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ERP / CRM platform — foundation scaffold (FND-01.1)
        </p>
      </div>

      <dl className="grid w-full max-w-md grid-cols-1 gap-px overflow-hidden rounded-xl border border-black/[.08] bg-black/[.06] text-sm dark:border-white/[.145] dark:bg-white/[.145]">
        <div className="flex items-center justify-between bg-white px-4 py-3 dark:bg-black">
          <dt className="text-zinc-500 dark:text-zinc-400">Frontend</dt>
          <dd className="font-medium text-black dark:text-zinc-50">Running</dd>
        </div>
        <div className="flex items-center justify-between bg-white px-4 py-3 dark:bg-black">
          <dt className="text-zinc-500 dark:text-zinc-400">Environment</dt>
          <dd className="font-medium text-black dark:text-zinc-50">
            {env.appEnv}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 dark:bg-black">
          <dt className="text-zinc-500 dark:text-zinc-400">API base URL</dt>
          <dd className="truncate font-mono text-xs text-black dark:text-zinc-50">
            {env.apiBaseUrl}
          </dd>
        </div>
      </dl>

      <HealthStatus />
    </main>
  );
}
