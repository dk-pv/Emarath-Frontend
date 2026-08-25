"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import { useLookup } from "@/hooks/use-lookup";
import { changeLeadPipeline } from "@/services/leads-row-actions-service";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The card menu's "Change Pipeline" picker (KAN-03.1). No Workpex frame captures this
 * flow, so it is a restrained design-system default: the shared Modal with the
 * `pipelines` lookup (the same source the board's Pipeline switcher reads, ADR-0005)
 * as a radio list, the lead's current pipeline preselected. Moving is only enabled for
 * a different pipeline; the backend lands the lead on the target's first stage and
 * refuses a pipeline with no stages — that message is surfaced as a toast rather than
 * a silent invalid move.
 */
export function ChangePipelineModal({
  lead,
  onClose,
  onChanged,
}: {
  lead: LeadListItem;
  onClose: () => void;
  onChanged: (lead: LeadListItem) => void;
}) {
  const { options, isLoading } = useLookup("pipelines");
  const { toast } = useToast();
  const [selected, setSelected] = useState(lead.pipeline);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (selected === lead.pipeline) return;
    setBusy(true);
    changeLeadPipeline(lead.id, selected)
      .then((updated) => {
        toast({
          title: `${lead.name} moved to ${selected}`,
          tone: "success",
        });
        onChanged(updated);
      })
      .catch((error: unknown) =>
        toast({
          title: "Couldn’t change pipeline",
          description: error instanceof ApiError ? error.message : undefined,
          tone: "danger",
        }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Change pipeline"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy || isLoading || selected === lead.pipeline}
          >
            Move lead
          </Button>
        </>
      }
    >
      <fieldset className="space-y-1" disabled={busy}>
        <legend className="mb-2 text-sm text-ink-muted">
          Move “{lead.name}” to another pipeline. It lands on the pipeline’s first
          stage.
        </legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
          >
            <input
              type="radio"
              name="pipeline"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              className="size-4 accent-brand"
            />
            <span>{option.label}</span>
            {option.value === lead.pipeline && (
              <span className="text-xs text-ink-subtle">(current)</span>
            )}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
