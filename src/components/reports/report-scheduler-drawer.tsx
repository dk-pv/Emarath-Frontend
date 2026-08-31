"use client";

import { useId, useMemo, useState } from "react";
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
      // The reference panel is ~512px wide with a hairline under its title.
      width="max-w-lg"
      header={
        <header className="border-b border-hairline p-5">
          <h2 className="text-lg font-medium text-ink">Scheduler</h2>
        </header>
      }
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
      {/* 12px + each field's own 8px label overhang = the reference's 20px rhythm. */}
      <div className="flex flex-col gap-3 pt-2">
        {apiError && <FormError>{apiError}</FormError>}

        <FloatingField
          label="Report Type"
          required
          filled={Boolean(reportSlug)}
          error={errors.reportSlug}
        >
          <Select
            aria-label="Report Type"
            placeholder=""
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
          labelInset="left-9"
        >
          <DatePicker value={startDate} onChange={setStartDate} numeric />
        </FloatingField>

        <div className="pt-2">
          <p className="text-sm text-ink-muted">
            Start Time
            <span className="text-danger" aria-hidden="true">
              {" *"}
            </span>
          </p>
          {/* The parts are outlined fields like the rest, so their labels float the same way. */}
          <div className="grid grid-cols-3 gap-2.5">
            <FloatingField label="HH" required filled={Boolean(hour)}>
              <Select
                aria-label="Start hour"
                placeholder=""
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                options={HOUR_OPTIONS}
              />
            </FloatingField>
            <FloatingField label="MM" required filled={Boolean(minute)}>
              <Select
                aria-label="Start minute"
                placeholder=""
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                options={MINUTE_OPTIONS}
              />
            </FloatingField>
            <FloatingField label="AM/PM" required filled={Boolean(ampm)}>
              <Select
                aria-label="Start meridiem"
                placeholder=""
                value={ampm}
                onChange={(event) => setAmpm(event.target.value)}
                options={AMPM_OPTIONS}
              />
            </FloatingField>
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
            aria-label="Repeat Duration"
            placeholder=""
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
          labelInset="left-9"
        >
          <DatePicker value={endDate} onChange={setEndDate} numeric />
        </FloatingField>

        <FloatingField
          label="Send via"
          required
          filled={Boolean(sendVia)}
          error={errors.sendVia}
        >
          <Select
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
            aria-label="Recipients"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
          />
        </FloatingField>
      </div>
    </Drawer>
  );
}

/**
 * The reference's outlined field: one label that sits inside the control while it is
 * empty (where a placeholder would, but with the red asterisk a native placeholder can't
 * show) and notches into the top border once there is a value — the treatment "Send via"
 * shows. The 8px the notched label rises above the control is reserved by the field's
 * own top padding, so no scrolling ancestor can clip it — which is what cut off the
 * pre-filled "Report Type", the first field in the drawer's padless scroll body.
 */
function FloatingField({
  label,
  required,
  filled,
  error,
  labelInset = "left-field-x",
  children,
}: {
  label: string;
  required?: boolean;
  filled: boolean;
  error?: string;
  /** Where the resting label starts — after the DatePicker's calendar icon, for one. */
  labelInset?: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="pt-2">
      <div role="group" aria-labelledby={labelId} className="relative">
        <span
          id={labelId}
          className={cn(
            "pointer-events-none absolute z-10 whitespace-nowrap",
            filled
              ? "-top-2 left-2.5 bg-surface px-1 text-xs"
              : cn("top-1/2 -translate-y-1/2 text-sm", labelInset),
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
