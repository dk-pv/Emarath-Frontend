"use client";

import { useId, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import { ApiError } from "@/lib/api-client";
import type { FirstResponseSettings } from "@/services/view-preferences-service";

/**
 * "Report Settings" for Lead First Response: the one number the report is configured by —
 * how many hours count as a late first response. It rides every query, so the server
 * counts exactly what the card's title claims.
 *
 * Saved to the caller's own view preference (the store the Kanban pins and the aging
 * thresholds use), so the setting follows the user rather than the browser.
 */
export function LeadFirstResponseSettingsDrawer({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: FirstResponseSettings;
  onClose: () => void;
  onSave: (next: FirstResponseSettings) => Promise<void>;
}) {
  const [hours, setHours] = useState(String(value.lateHours));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  const lateHours = Number(hours);
  const valid =
    Number.isInteger(lateHours) && lateHours >= 1 && lateHours <= 720;

  async function submit() {
    if (!valid) {
      setError("Enter a whole number of hours between 1 and 720.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ lateHours });
    } catch (problem) {
      setError(
        problem instanceof ApiError
          ? problem.message
          : "Couldn’t save the settings. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Report Settings"
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={id}
            className="flex items-center gap-1.5 text-sm text-ink-muted"
          >
            Late Response After (hours)
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <Tooltip
              portal
              content="A first response slower than this counts towards the “Responded >” card."
            >
              <span className="inline-flex text-ink-subtle">
                <IconInfoCircle
                  size={15}
                  stroke={1.75}
                  aria-label="A first response slower than this counts as late."
                />
              </span>
            </Tooltip>
          </label>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            size="lg"
            required
            aria-invalid={hours !== "" && !valid}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        </div>

        <p className="rounded-control bg-canvas px-3 py-2 text-sm text-ink-muted">
          {valid
            ? `Leads first worked more than ${lateHours} hours after they were created count as late.`
            : "Enter a whole number of hours between 1 and 720."}
        </p>
      </div>
    </Drawer>
  );
}
