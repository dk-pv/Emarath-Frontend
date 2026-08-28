"use client";

import { useEffect, useMemo, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import {
  TYPE_OPTIONS,
  TimeRow,
  composeIso,
} from "@/components/activities/activity-form-parts";
import { ApiError } from "@/lib/api-client";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  createActivity,
  type ActivityType,
} from "@/services/activities-service";
import type { LeadListItem } from "@/services/leads-service";
import type { SelectOption } from "@/types";

type LeadFollowUpFormDrawerProps = {
  /** The lead the drawer was opened on — the follow-up's fixed Lead. */
  lead: LeadListItem;
  onClose: () => void;
  /** Called after the follow-up persists so the parent can toast + refresh the drawer. */
  onCreated: () => void;
};

type FormState = {
  type: ActivityType | null;
  description: string;
  assigneeIds: string[];
  date: Date | null;
  startHour: string | null;
  startMinute: string | null;
  startAmpm: string | null;
  endHour: string | null;
  endMinute: string | null;
  endAmpm: string | null;
};

/**
 * The Workpex "Add New Follow-up" panel (ACT-03.2), opened from the Lead Detail
 * drawer's "New Follow-up" button and traced from the supplied Workpex screenshots:
 * a right-side form whose first field is Follow Up Type, revealing Description /
 * Assigned To / Lead / Due Date / Start Time (+ End Time for Meeting/Task) once a
 * type is picked, over a sticky Cancel / Submit footer.
 *
 * Reuses the existing follow-up form idiom — the shared Drawer, FormField and inputs,
 * and the `activity-form-parts` time helpers the Edit Follow-up drawer uses — and
 * posts through the existing `POST /api/activities` (no new endpoint). The Lead is
 * fixed to the drawer's lead (no picker); Assigned To defaults to the lead's assigned
 * agents. Only a successful create closes the panel; a failure keeps the entered data.
 */
export function LeadFollowUpFormDrawer({
  lead,
  onClose,
  onCreated,
}: LeadFollowUpFormDrawerProps) {
  const [form, setForm] = useState<FormState>(() => ({
    type: null,
    description: "",
    assigneeIds: lead.assignedAgents.map((a) => a.id),
    date: null,
    startHour: null,
    startMinute: null,
    startAmpm: null,
    endHour: null,
    endMinute: null,
    endAmpm: null,
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<SelectOption[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then((list) =>
        setAgents(list.map((a) => ({ value: a.id, label: a.name }))),
      )
      .catch(() => {
        /* leaving Assigned options empty must not break the form */
      });
    return () => controller.abort();
  }, []);

  // The lead's own assigned agents may not be in the assignable directory; merge
  // them in so their default chips still render with a name.
  const agentOptions = useMemo(() => {
    const byId = new Map(agents.map((a) => [a.value, a]));
    for (const a of lead.assignedAgents)
      if (!byId.has(a.id)) byId.set(a.id, { value: a.id, label: a.name });
    return [...byId.values()];
  }, [agents, lead.assignedAgents]);

  const typeSelected = form.type !== null;
  const showEnd = form.type === "MEETING" || form.type === "TASK";
  const endTouched = Boolean(form.endHour || form.endMinute || form.endAmpm);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.type) next.type = "Follow Up Type is required";
    if (!form.description.trim())
      next.description = "Follow-up Description is required";
    if (form.assigneeIds.length === 0)
      next.assigneeIds = "At least one assignee is required";
    if (!form.date) next.date = "Due Date is required";
    if (!form.startHour || !form.startMinute || !form.startAmpm)
      next.startHour = "Start Time is required";
    if (
      showEnd &&
      endTouched &&
      (!form.endHour || !form.endMinute || !form.endAmpm)
    )
      next.endHour = "Complete the End Time or clear it";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setApiError(null);
    if (!validate() || !form.type || !form.date) return;

    const dueAt = composeIso(
      form.date,
      form.startHour!,
      form.startMinute!,
      form.startAmpm!,
    );
    const endAt =
      showEnd && form.endHour && form.endMinute && form.endAmpm
        ? composeIso(form.date, form.endHour, form.endMinute, form.endAmpm)
        : undefined;

    setSubmitting(true);
    try {
      await createActivity({
        type: form.type,
        leadId: lead.id,
        description: form.description.trim(),
        dueAt,
        endAt,
        assigneeIds: form.assigneeIds,
      });
      onCreated();
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Something went wrong while saving. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Add New Follow-up"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {apiError && <FormError>{apiError}</FormError>}

        <FormField label="Follow Up Type" required error={errors.type}>
          <SearchableSelect
            searchable={false}
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(v) => set("type", (v as ActivityType | null) ?? null)}
            placeholder="Select Follow Up Type"
          />
        </FormField>

        {typeSelected && (
          <>
            <FormField
              label="Follow-up Description"
              required
              error={errors.description}
            >
              {(control) => (
                <Textarea
                  {...control}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Follow-up Description"
                />
              )}
            </FormField>

            <FormField label="Assigned To" required error={errors.assigneeIds}>
              <MultiSelect
                searchable
                options={agentOptions}
                value={form.assigneeIds}
                onChange={(v) => set("assigneeIds", v)}
                placeholder="Assigned To"
              />
            </FormField>

            <FormField label="Lead" required>
              <div className="flex h-control-md items-center rounded-control border border-hairline bg-canvas px-3 text-sm text-ink">
                {lead.name}
              </div>
            </FormField>

            <FormField label="Due Date" required error={errors.date}>
              <DatePicker
                numeric
                value={form.date}
                onChange={(d) => set("date", d)}
                placeholder="DD/MM/YYYY"
              />
            </FormField>

            <FormField label="Start Time" required error={errors.startHour}>
              <TimeRow
                hour={form.startHour}
                minute={form.startMinute}
                ampm={form.startAmpm}
                onHour={(v) => set("startHour", v)}
                onMinute={(v) => set("startMinute", v)}
                onAmpm={(v) => set("startAmpm", v)}
              />
            </FormField>

            {showEnd && (
              <FormField label="End Time" error={errors.endHour}>
                <TimeRow
                  hour={form.endHour}
                  minute={form.endMinute}
                  ampm={form.endAmpm}
                  onHour={(v) => set("endHour", v)}
                  onMinute={(v) => set("endMinute", v)}
                  onAmpm={(v) => set("endAmpm", v)}
                />
              </FormField>
            )}
          </>
        )}
      </form>
    </Drawer>
  );
}
