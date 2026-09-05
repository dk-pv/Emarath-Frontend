"use client";

import { useEffect, useState } from "react";
import { isAbortError } from "@/lib/api-client";
import {
  fetchActivityWorkflow,
  type ActivityWorkflowSettings,
} from "@/services/activity-settings-service";

/**
 * Settings → Activity and Reminders, as the follow-up screens consume it.
 *
 * Read through the one endpoint on the settings controller that is not administrator-only,
 * because an agent's own follow-up form has to honour the configuration (ADR-0071).
 *
 * A failed read resolves to `null` rather than an error: the configuration decides how the
 * follow-up flow behaves, so an unreachable settings row must leave Activities working as
 * it did before the flow was configurable — never blocked behind a settings request.
 */
export function useActivityWorkflow(): ActivityWorkflowSettings | null {
  const [workflow, setWorkflow] = useState<ActivityWorkflowSettings | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchActivityWorkflow(controller.signal)
      .then((result) => {
        if (active) setWorkflow(result);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setWorkflow(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return workflow;
}
