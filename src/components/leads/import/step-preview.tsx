"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { Loading } from "@/components/ui/Loading";
import { cn } from "@/lib/cn";
import type {
  RowStatus,
  ValidateResult,
} from "@/services/leads-import-service";

/** The Preview step's validation state, owned by the wizard and passed down. */
export type ValidationState =
  | { status: "loading" }
  | { status: "done"; result: ValidateResult }
  | { status: "error"; message: string };

type StepPreviewProps = {
  pipeline: string;
  columns: string[];
  validation: ValidationState | null;
};

const STATUS_PILL: Record<RowStatus, string> = {
  valid: "bg-green-100 text-green-800",
  duplicate: "bg-amber-100 text-amber-800",
  invalid: "bg-red-100 text-red-800",
};

const ROW_TINT: Record<RowStatus, string> = {
  valid: "",
  duplicate: "bg-amber-50",
  invalid: "bg-red-50",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  valid: "Valid",
  duplicate: "Duplicate",
  invalid: "Error",
};

/**
 * Step 4 — Preview Data (validated against the backend). A summary of the whole
 * file plus a table of the parsed rows: invalid and duplicate rows are tinted and
 * carry their reason (LEAD-07.2 AC2). The table window is what the API returns
 * (bounded); the counts above it are exact for the whole file.
 */
export function StepPreview({
  pipeline,
  columns,
  validation,
}: StepPreviewProps) {
  if (!validation || validation.status === "loading") {
    return <Loading label="Validating your file" />;
  }

  if (validation.status === "error") {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center"
      >
        <IconAlertTriangle
          stroke={1.5}
          className="size-8 text-danger"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-ink">
          Couldn’t validate the file
        </p>
        <p className="text-sm text-ink-muted">{validation.message}</p>
        <p className="text-sm text-ink-muted">
          Go back to Map Fields and check your mapping, then try again.
        </p>
      </div>
    );
  }

  const { total, valid, invalid, duplicates, rows } = validation.result;

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-lg font-semibold text-ink">Preview Data</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Review the records before importing. Showing {rows.length} of {total}{" "}
        record{total === 1 ? "" : "s"} to be added to{" "}
        <span className="font-medium text-ink">
          {pipeline || "Lead Pipeline"}
        </span>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Summary label="Total records" value={total} />
        <Summary label="Valid" value={valid} tone="success" />
        <Summary label="Invalid" value={invalid} tone="danger" />
        <Summary label="Duplicates" value={duplicates} tone="warning" />
      </div>

      <div className="mt-5 overflow-x-auto rounded-surface border border-hairline scrollbar-slim">
        <table className="w-full border-collapse text-sm text-ink">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-ink-muted">
              <th className="px-4 py-3 whitespace-nowrap">Row</th>
              <th className="px-4 py-3 whitespace-nowrap">Status</th>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 whitespace-nowrap">
                  {column}
                </th>
              ))}
              <th className="px-4 py-3 whitespace-nowrap">Issue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rowNumber}
                className={cn(
                  "border-b border-hairline last:border-b-0",
                  ROW_TINT[row.status],
                )}
              >
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {row.rowNumber}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_PILL[row.status],
                    )}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 whitespace-nowrap">
                    {row.values[column] ?? ""}
                  </td>
                ))}
                <td className="px-4 py-3 text-danger">
                  {row.error?.reason ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-ink";
  return (
    <span className="inline-flex items-baseline gap-2 rounded-control border border-hairline bg-surface px-4 py-2">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("text-base font-semibold", valueColor)}>{value}</span>
    </span>
  );
}
