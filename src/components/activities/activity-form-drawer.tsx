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
import { ApiError } from "@/lib/api-client";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  updateActivity,
  type ActivityListItem,
  type ActivityType,
} from "@/services/activities-service";
import {
  TYPE_LABEL,
  TYPE_OPTIONS,
  TimeRow,
  composeIso,
  splitTime,
} from "@/components/activities/activity-form-parts";
import type { SelectOption } from "@/types";

type ActivityFormDrawerProps = {
  activity: ActivityListItem;
  onClose: () => void;
  /** The optimistic row patch to apply on success, then reconcile via refetch. */
  onSaved: (override: Partial<ActivityListItem>) => void;
};

type FormState = {
  type: ActivityType;
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

function initialForm(activity: ActivityListItem): FormState {
  const start = splitTime(activity.dueAt);
  const end = activity.endAt ? splitTime(activity.endAt) : null;
  return {
    type: activity.type,
    description: activity.description ?? "",
    assigneeIds: activity.assignees.map((a) => a.id),
    date: new Date(activity.dueAt),
    startHour: start.hour,
    startMinute: start.minute,
    startAmpm: start.ampm,
    endHour: end?.hour ?? null,
    endMinute: end?.minute ?? null,
    endAmpm: end?.ampm ?? null,
  };
}

/**
 * The Edit Follow-up drawer (ACT-05.1), prefilled from the row. Reuses the Add
 * New Lead drawer's form idiom (Drawer + FormField + shared inputs, validate →
 * submit → ApiError banner). The lead link is fixed, so there is no lead picker.
 * The Location field is a Meeting/Task option whose catalogue is the GPS module's
 * (not built): its value is preserved through the edit but not shown — no picker
 * is invented for a catalogue that does not exist yet.
 */
export function ActivityFormDrawer({
  activity,
  onClose,
  onSaved,
}: ActivityFormDrawerProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(activity));
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

  const nameOf = useMemo(() => {
    const byId = new Map(agents.map((a) => [a.value, a.label]));
    for (const a of activity.assignees)
      if (!byId.has(a.id)) byId.set(a.id, a.name);
    return (id: string) => byId.get(id) ?? id;
  }, [agents, activity.assignees]);

  const showEnd = form.type === "MEETING" || form.type === "TASK";
  const endTouched = Boolean(form.endHour || form.endMinute || form.endAmpm);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
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
    if (!validate() || !form.date) return;

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
    // A Call clears any preserved location; Meeting/Task keep the GPS-owned value.
    const locationId = showEnd ? (activity.locationId ?? undefined) : undefined;

    setSubmitting(true);
    try {
      await updateActivity(activity.id, {
        type: form.type,
        description: form.description.trim(),
        dueAt,
        endAt,
        locationId,
        assigneeIds: form.assigneeIds,
      });
      onSaved({
        type: form.type,
        title: `${TYPE_LABEL[form.type]} with ${activity.lead.name}`,
        description: form.description.trim(),
        dueAt,
        endAt: endAt ?? null,
        locationId: locationId ?? null,
        assignees: form.assigneeIds.map((id) => ({ id, name: nameOf(id) })),
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Something went wrong while saving. Please try again.";
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Follow-up"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Saving…" : "Submit"}
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

        <FormField label="Follow Up Type" required>
          <SearchableSelect
            searchable={false}
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(v) => set("type", (v ?? form.type) as ActivityType)}
            placeholder="Follow Up Type"
          />
        </FormField>

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
            options={agents}
            value={form.assigneeIds}
            onChange={(v) => set("assigneeIds", v)}
            placeholder="Assigned To"
          />
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
      </form>
    </Drawer>
  );
}
