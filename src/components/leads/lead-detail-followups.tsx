"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadDetailAddButton } from "@/components/leads/lead-detail-section";
import { cn } from "@/lib/cn";

type Tab = "followup" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "followup", label: "Follow-up" },
  { key: "history", label: "History" },
];

/**
 * The Lead Detail page's Follow-up / History section (traced from the supplied
 * Workpex screenshots): two tabs above a records area with a green add control.
 *
 * Both tabs rest on the honest Workpex empty state — there is no per-lead follow-up
 * feed or lead history feed today (the Activities list is a bucketed worklist, not
 * per-lead; no audit log exists). "Add Follow-up" is shown to match Workpex but
 * disabled with a tooltip: the follow-up create form is the Activities module's
 * (ACT-03.2), which isn't built, so it is not fabricated. The "Assigned To" and
 * "Date Filter" controls filter data that doesn't exist yet, so they are omitted
 * here (see ADR-0037).
 */
export function LeadDetailFollowUps() {
  const [tab, setTab] = useState<Tab>("followup");

  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5">
        <div role="tablist" aria-label="Follow-up and history" className="flex">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              className={cn(
                "focus-ring -mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-(--duration-shell) ease-shell",
                tab === entry.key
                  ? "border-brand text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <LeadDetailAddButton
          label="Add Follow-up"
          disabled
          tooltip="Follow-up scheduling is part of the Activities module"
        />
      </div>

      <div className="p-6">
        {tab === "followup" ? (
          <EmptyState
            title="No records yet"
            description="Records will appear here once they are added."
            action={
              <Tooltip content="Follow-up scheduling is part of the Activities module">
                <span className="inline-flex">
                  <Button size="sm" disabled>
                    <IconPlus size={16} stroke={2} aria-hidden="true" />
                    Add Follow-up
                  </Button>
                </span>
              </Tooltip>
            }
          />
        ) : (
          <EmptyState
            title="No records yet"
            description="Records will appear here once they are added."
          />
        )}
      </div>
    </Card>
  );
}
