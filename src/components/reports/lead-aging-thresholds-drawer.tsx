"use client";

import { useId, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import { ApiError } from "@/lib/api-client";
import type { AgingThresholds } from "@/services/view-preferences-service";

/**
 * "Configure Aging Thresholds", matched to the supplied reference: the two day bounds
 * that band every lead on the report, each a required field with an info tooltip, over
 * the Cancel / Save footer.
 *
 * Red needs no field — it is everything past amber, which the hints state rather than ask
 * for. Saving persists to the caller's own view preference (the same per-user store the
 * Kanban pins use), so the bands follow the user, not the browser.
 */
export function LeadAgingThresholdsDrawer({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: AgingThresholds;
  onClose: () => void;
  onSave: (next: AgingThresholds) => Promise<void>;
}) {
  const [green, setGreen] = useState(String(value.green));
  const [amber, setAmber] = useState(String(value.amber));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const greenDays = Number(green);
  const amberDays = Number(amber);
  const validGreen =
    Number.isInteger(greenDays) && greenDays >= 1 && greenDays <= 364;
  const validAmber =
    Number.isInteger(amberDays) && amberDays <= 365 && amberDays > greenDays;

  async function submit() {
    if (!validGreen || !validAmber) {
      setError("Enter whole days, with Amber greater than Green (1–365).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ green: greenDays, amber: amberDays });
    } catch (problem) {
      setError(
        problem instanceof ApiError
          ? problem.message
          : "Couldn’t save the thresholds. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Configure Aging Thresholds"
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        {error && <FormError>{error}</FormError>}

        <ThresholdField
          label="Green Max Days"
          hint="Leads up to this age are healthy."
          value={green}
          invalid={green !== "" && !validGreen}
          onChange={setGreen}
        />

        <ThresholdField
          label="Amber Max Days"
          hint={`Leads up to this age need attention; anything older is red${
            validAmber ? ` (≥${amberDays + 1}d)` : ""
          }.`}
          value={amber}
          invalid={amber !== "" && !validAmber}
          onChange={setAmber}
        />
      </div>
    </Drawer>
  );
}

/** One labelled, required day field with the reference's info tooltip. */
function ThresholdField({
  label,
  hint,
  value,
  invalid,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm text-ink-muted"
      >
        {label}
        <span className="text-danger" aria-hidden="true">
          *
        </span>
        <Tooltip content={hint} portal>
          <span className="inline-flex text-ink-subtle">
            <IconInfoCircle size={15} stroke={1.75} aria-label={hint} />
          </span>
        </Tooltip>
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        size="lg"
        required
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
