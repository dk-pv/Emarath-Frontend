"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";

type Health = {
  state: "loading" | "online" | "offline";
  environment?: string;
  detail?: string;
};

/**
 * Minimal, robust backend connectivity indicator for the FND-01.1 scaffold.
 *
 * Pings the backend health endpoint once on mount. If the backend is not
 * running (or unreachable) it degrades gracefully to an "offline" state and
 * never throws — this is a temporary diagnostic, not product UI.
 */
export function HealthStatus() {
  const [health, setHealth] = useState<Health>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function ping() {
      try {
        const res = await fetch(`${env.apiBaseUrl}/health`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { environment?: string } = await res.json();
        if (active) {
          setHealth({ state: "online", environment: data.environment });
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setHealth({
            state: "offline",
            detail: error instanceof Error ? error.message : "unreachable",
          });
        }
      }
    }

    void ping();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const label =
    health.state === "loading"
      ? "Checking backend…"
      : health.state === "online"
        ? `Backend online${health.environment ? ` (${health.environment})` : ""}`
        : "Backend offline";

  const dotClass =
    health.state === "loading"
      ? "bg-amber-500"
      : health.state === "online"
        ? "bg-emerald-500"
        : "bg-red-500";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}
