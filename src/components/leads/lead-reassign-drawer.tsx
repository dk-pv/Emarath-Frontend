"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { SelectOption } from "@/types";

type LeadReassignDrawerProps = {
  open: boolean;
  /** How many leads the reassignment will apply to — shown in the drawer. */
  count: number;
  /** True while the reassign request is in flight; disables the controls. */
  submitting: boolean;
  onClose: () => void;
  onReassign: (agentId: string) => void;
};

/**
 * Reassign selected leads to one agent (LEAD-09.2).
 *
 * A documented parity deviation (ADR-0011): Workpex's "Assignee" dialog is not
 * captured, so this reuses the app's right Drawer + SearchableSelect rather than
 * inventing a bespoke picker. The agent list is the same `assignable-agents` source
 * the New Lead form uses. Mounted per-open, so it always starts from a clean choice.
 */
export function LeadReassignDrawer({
  open,
  count,
  submitting,
  onClose,
  onReassign,
}: LeadReassignDrawerProps) {
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch((error: unknown) => {
        // A superseded request aborts; expected. Any other failure leaves the
        // list empty, and the Reassign button stays disabled until a pick is made.
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  const options = useMemo<SelectOption[]>(
    () => agents.map((agent) => ({ label: agent.name, value: agent.id })),
    [agents],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Reassign Leads"
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => agentId && onReassign(agentId)}
            disabled={!agentId || submitting}
          >
            {submitting ? "Reassigning…" : "Reassign"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          Reassign {count} selected lead{count === 1 ? "" : "s"} to an agent. This
          replaces the current assignment.
        </p>
        <label htmlFor="reassign-agent" className="text-sm font-medium text-ink">
          Agent
        </label>
        <SearchableSelect
          id="reassign-agent"
          options={options}
          value={agentId}
          onChange={setAgentId}
          placeholder="Select an agent"
          searchable
        />
      </div>
    </Drawer>
  );
}
