/**
 * Centralised access to public runtime configuration.
 *
 * Only `NEXT_PUBLIC_*` variables are readable in the browser, and Next.js
 * inlines them at **build time**. Values are therefore set per environment
 * when the app is built/deployed (e.g. per Vercel environment).
 *
 * Each variable is referenced statically (not via a computed key) so Next.js
 * can inline it. Fallbacks keep the app runnable if a variable is missing.
 */
export type AppEnvironment = "development" | "staging" | "production";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Emarath",
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as AppEnvironment,
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api",
} as const;
