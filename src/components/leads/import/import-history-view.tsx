"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconDownload, IconFileImport, IconHistory } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import {
  fetchImportErrors,
  fetchImportHistory,
  importErrorsCsvUrl,
  type ImportJob,
  type ImportRowError,
} from "@/services/leads-import-service";
import type { TableColumn } from "@/types";

const STATUS_PILL: Record<ImportJob["status"], string> = {
  COMPLETED: "bg-green-100 text-green-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  PENDING: "bg-canvas text-ink-muted",
  FAILED: "bg-red-100 text-red-800",
};

function StatusPill({ status }: { status: ImportJob["status"] }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_PILL[status],
      )}
    >
      {label}
    </span>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Import History (LEAD-07.1 improvement): the recent import jobs, scoped by role,
 * with each run's counts, timings and importer. "View Details" opens the failed
 * rows for review and "Download Error Report" fetches the CSV — the same two
 * affordances the wizard's final step offers, now available after the fact. Built
 * from the Foundation (PageHeader, Table, Modal) in the existing design language.
 */
export function ImportHistoryView() {
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [isError, setIsError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ImportJob | null>(null);

  // Fetch on mount and whenever `reload` is bumped; state is set only in the async
  // callbacks (the useListData pattern), never synchronously in the effect body.
  useEffect(() => {
    const controller = new AbortController();
    fetchImportHistory(controller.signal)
      .then((loaded) => {
        setJobs(loaded);
        setIsError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setIsError(true);
      });
    return () => controller.abort();
  }, [reload]);

  const retry = () => {
    setJobs(null);
    setIsError(false);
    setReload((value) => value + 1);
  };

  const columns: TableColumn<ImportJob>[] = [
    {
      key: "fileName",
      header: "File Name",
      render: (job) => (
        <span className="font-medium text-ink">{job.fileName}</span>
      ),
    },
    {
      key: "importedCount",
      header: "Imported",
      align: "right",
      render: (job) => job.importedCount,
    },
    {
      key: "failedCount",
      header: "Failed",
      align: "right",
      render: (job) => job.failedCount,
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <StatusPill status={job.status} />,
    },
    {
      key: "startedAt",
      header: "Started At",
      render: (job) => formatDateTime(job.startedAt),
    },
    {
      key: "completedAt",
      header: "Completed At",
      render: (job) => formatDateTime(job.completedAt),
    },
    {
      key: "importedBy",
      header: "Imported By",
      render: (job) => job.importedBy?.name ?? "—",
    },
    {
      key: "actions",
      header: "Actions",
      render: (job) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSelected(job)}
            className="rounded-control px-2 py-1 text-sm font-medium text-brand-strong hover:bg-brand-subtle focus-ring"
          >
            View Details
          </button>
          {job.failedCount + job.skippedCount > 0 && (
            <a
              href={importErrorsCsvUrl(job.id)}
              aria-label={`Download error report for ${job.fileName}`}
              className="inline-flex size-control-sm items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
            >
              <IconDownload size={16} stroke={1.75} aria-hidden="true" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <PageHeader
        title="Import History"
        description="Recent bulk imports, their results, and downloadable error reports."
        actions={
          <Link
            href="/leads/import"
            className="focus-ring inline-flex h-control-md items-center gap-2 rounded-control bg-brand px-field-x text-sm font-medium text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong"
          >
            <IconFileImport size={18} stroke={1.75} />
            New Import
          </Link>
        }
      />

      <div className="overflow-hidden rounded-surface border border-hairline bg-surface">
        <div className="overflow-x-auto scrollbar-slim">
          <Table
            columns={columns}
            rows={jobs ?? []}
            getRowId={(job) => job.id}
            isLoading={jobs === null && !isError}
            emptyState={
              <EmptyState
                icon={IconHistory}
                title="No imports yet"
                description="When you import leads from a spreadsheet, each run appears here."
              />
            }
            errorState={
              isError ? (
                <ErrorState
                  title="Couldn’t load import history"
                  description="Something went wrong while loading your imports. Try again."
                  onRetry={retry}
                />
              ) : undefined
            }
          />
        </div>
      </div>

      {selected && (
        <JobDetailsModal job={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function JobDetailsModal({
  job,
  onClose,
}: {
  job: ImportJob;
  onClose: () => void;
}) {
  const [errors, setErrors] = useState<ImportRowError[] | null>(null);
  const attention = job.failedCount + job.skippedCount;

  useEffect(() => {
    // Nothing to fetch when there are no failed/skipped rows — and the table below
    // is not rendered in that case, so no state needs setting here.
    if (attention === 0) return;
    const controller = new AbortController();
    fetchImportErrors(job.id, controller.signal)
      .then(setErrors)
      .catch(() => setErrors([]));
    return () => controller.abort();
  }, [job.id, attention]);

  return (
    <Modal open onClose={onClose} title={job.fileName} size="lg">
      <div className="flex flex-wrap gap-2 text-sm">
        <Stat label="Total" value={job.totalRows} />
        <Stat label="Imported" value={job.importedCount} tone="success" />
        <Stat label="Skipped" value={job.skippedCount} tone="warning" />
        <Stat label="Failed" value={job.failedCount} tone="danger" />
      </div>

      {attention > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">
              Rows that need attention
            </h3>
            <a
              href={importErrorsCsvUrl(job.id)}
              className="inline-flex h-control-sm items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm font-medium text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring"
            >
              <IconDownload size={16} stroke={1.75} aria-hidden="true" />
              Download CSV
            </a>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-control border border-hairline scrollbar-slim">
            <table className="w-full border-collapse text-sm text-ink">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-muted">
                  <th className="px-4 py-2 whitespace-nowrap">Row</th>
                  <th className="px-4 py-2 whitespace-nowrap">Reason</th>
                </tr>
              </thead>
              <tbody>
                {(errors ?? []).map((error) => (
                  <tr
                    key={error.rowNumber}
                    className="border-b border-hairline last:border-b-0"
                  >
                    <td className="px-4 py-2 align-top whitespace-nowrap text-ink-muted">
                      {error.rowNumber}
                    </td>
                    <td className="px-4 py-2">{error.reason}</td>
                  </tr>
                ))}
                {errors === null && (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-ink-muted">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-ink";
  return (
    <span className="inline-flex items-baseline gap-2 rounded-control border border-hairline bg-surface px-3 py-1.5">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("text-base font-semibold", color)}>{value}</span>
    </span>
  );
}
