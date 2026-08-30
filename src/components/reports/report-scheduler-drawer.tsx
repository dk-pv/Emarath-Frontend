"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  AMPM_OPTIONS,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  composeIso,
} from "@/components/activities/activity-form-parts";
import { REPORT_CATEGORIES } from "@/components/reports/report-registry";
import { cn } from "@/lib/cn";
import { EMAIL_PATTERN } from "@/lib/validation";

/** How often the schedule repeats — the reference offers a fixed cadence list. */
const REPEAT_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

/** Email is the only delivery channel Emarath has a transport for (ADR-0031/0032). */
const SEND_VIA_OPTIONS = [{ value: "email", label: "Email" }];

export type ReportSchedulePayload = {
  reportSlug: string;
  startAt: string;
  endDate: string;
  repeat: string;
  sendVia: string;
  recipients: string[];
};

export type ReportSchedulerDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Preselects the report the menu was opened from. */
  defaultReportSlug?: string;
  onSubmit: (payload: ReportSchedulePayload) => Promise<void> | void;
};

type Errors = Partial<Record<string, string>>;

/**
 * The report Scheduler form, matched to the supplied reference: report type, a start date
 * and 12-hour start time, a repeat cadence, an end date, the delivery channel and its
 * recipients, over the Cancel / Submit footer.
 *
 * Every option comes from something real — the report list is the registry the hub and the
 * routes already read, the time parts are the Activities module's own hour/minute/meridiem
 * options, and recipients are validated with the shared `EMAIL_PATTERN` — so a schedule can
 * only ever name a report that exists and an address the mailer could accept.
 */
export function ReportSchedulerDrawer({
  open,
  onClose,
  defaultReportSlug,
  onSubmit,
}: ReportSchedulerDrawerProps) {
  const reportOptions = useMemo(
    () =>
      REPORT_CATEGORIES.flatMap((category) =>
        category.reports.map((report) => ({
          value: report.slug,
          label: report.title,
        })),
      ),
    [],
  );

  const [reportSlug, setReportSlug] = useState(defaultReportSlug ?? "");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [ampm, setAmpm] = useState("");
  const [repeat, setRepeat] = useState("");
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sendVia, setSendVia] = useState("email");
  const [recipients, setRecipients] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!reportSlug) next.reportSlug = "Report Type is required";
    if (!startDate) next.startDate = "Start Date is required";
    if (!hour || !minute || !ampm) next.startTime = "Start Time is required";
    if (!repeat) next.repeat = "Repeat Duration is required";
    if (!endDate) next.endDate = "End Date is required";
    else if (startDate && endDate < startDate)
      next.endDate = "End Date must be on or after the Start Date";
    if (!sendVia) next.sendVia = "Send via is required";

    const list = recipients
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length === 0)
      next.recipients = "At least one recipient is required";
    else {
      const bad = list.filter((value) => !EMAIL_PATTERN.test(value));
      if (bad.length > 0) next.recipients = `Invalid email: ${bad.join(", ")}`;
    }
    return next;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setApiError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        reportSlug,
        startAt: composeIso(startDate as Date, hour, minute, ampm),
        endDate: (endDate as Date).toISOString(),
        repeat,
        sendVia,
        recipients: recipients
          .split(/[,\s]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      });
    } catch (problem) {
      setApiError(
        problem instanceof Error
          ? problem.message
          : "Couldn’t save the schedule. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Scheduler"
      width="max-w-xl"
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
      <div className="flex flex-col gap-4">
        {apiError && <FormError>{apiError}</FormError>}

        <FloatingField
          label="Report Type"
          required
          filled={Boolean(reportSlug)}
          error={errors.reportSlug}
        >
          <Select
            size="lg"
            aria-label="Report Type"
            placeholder="Report Type *"
            value={reportSlug}
            onChange={(event) => setReportSlug(event.target.value)}
            options={reportOptions}
          />
        </FloatingField>

        <FloatingField
          label="Start Date"
          required
          filled={Boolean(startDate)}
          error={errors.startDate}
        >
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Start Date *"
            numeric
          />
        </FloatingField>

        <div>
          <p className="text-sm text-ink-muted">
            Start Time
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-3">
            <Select
              size="lg"
              aria-label="Start hour"
              placeholder="HH *"
              value={hour}
              onChange={(event) => setHour(event.target.value)}
              options={HOUR_OPTIONS}
            />
            <Select
              size="lg"
              aria-label="Start minute"
              placeholder="MM *"
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
              options={MINUTE_OPTIONS}
            />
            <Select
              size="lg"
              aria-label="Start meridiem"
              placeholder="AM/PM *"
              value={ampm}
              onChange={(event) => setAmpm(event.target.value)}
              options={AMPM_OPTIONS}
            />
          </div>
          {errors.startTime && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.startTime}
            </p>
          )}
        </div>

        <FloatingField
          label="Repeat Duration"
          required
          filled={Boolean(repeat)}
          error={errors.repeat}
        >
          <Select
            size="lg"
            aria-label="Repeat Duration"
            placeholder="Repeat Duration *"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            options={REPEAT_OPTIONS}
          />
        </FloatingField>

        <FloatingField
          label="End Date"
          required
          filled={Boolean(endDate)}
          error={errors.endDate}
        >
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="End Date *"
            numeric
          />
        </FloatingField>

        <FloatingField
          label="Send via"
          required
          filled={Boolean(sendVia)}
          error={errors.sendVia}
        >
          <Select
            size="lg"
            aria-label="Send via"
            value={sendVia}
            onChange={(event) => setSendVia(event.target.value)}
            options={SEND_VIA_OPTIONS}
          />
        </FloatingField>

        <FloatingField
          label="Recipients"
          required
          filled={recipients.length > 0}
          error={errors.recipients}
        >
          <Input
            size="lg"
            aria-label="Recipients"
            placeholder="Recipients *"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
          />
        </FloatingField>
      </div>
    </Drawer>
  );
}

/**
 * The reference's outlined field: its label lives inside the control while it is empty
 * (the control's own placeholder) and notches into the top border once it has a value —
 * the treatment the "Send via" field shows.
 */
function FloatingField({
  label,
  required,
  filled,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  filled: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        {filled && (
          <span
            className={cn(
              "pointer-events-none absolute -top-2 left-2.5 z-10 bg-surface px-1 text-xs",
              error ? "text-danger" : "text-ink-muted",
            )}
          >
            {label}
            {required && (
              <span className="text-danger" aria-hidden="true">
                {" *"}
              </span>
            )}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
