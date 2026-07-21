"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import type { FieldMapping } from "@/components/leads/import/import-data";
import {
  fetchImportErrors,
  fetchImportJob,
  importErrorsCsvUrl,
  startImport,
  type ImportJob,
  type ImportRowError,
} from "@/services/leads-import-service";

const POLL_MS = 1000;

type StepImportProps = {
  file: File;
  mapping: FieldMapping;
  pipeline: string;
  onGoToLeads: () => void;
  onImportAnother: () => void;
};

type Phase = "importing" | "done" | "error";

/**
 * Step 5 — Import (wired to the async backend job). It starts the import once,
 * then polls the job for real progress; on completion it shows the real
 * imported/skipped/failed summary, a review of the rows that need attention, and a
 * CSV error-report download (LEAD-07.1 progress tracking + LEAD-07.2 AC3/AC4). The
 * start is guarded so React's development double-mount cannot launch two imports.
 */
export function StepImport({
  file,
  mapping,
  pipeline,
  onGoToLeads,
  onImportAnother,
}: StepImportProps) {
  const startedRef = useRef(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [phase, setPhase] = useState<Phase>("importing");
  const [message, setMessage] = useState<string | null>(null);

  // Start exactly once. The ref guard survives React's development double-mount,
  // so only one import is ever POSTed. No mounted-flag on the result: under the
  // double-mount the first effect's cleanup would falsify it while the second run
  // is guarded out, and the job id would never be set — the poll effect owns
  // teardown instead (its interval is cleared on unmount).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startImport(file, mapping, pipeline)
      .then((result) => setJobId(result.jobId))
      .catch((caught: unknown) => {
        setPhase("error");
        setMessage(
          caught instanceof Error
            ? caught.message
            : "The import could not start.",
        );
      });
  }, [file, mapping, pipeline]);

  // Poll the job until it settles.
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer = 0;

    const tick = async () => {
      try {
        const current = await fetchImportJob(jobId);
        if (!active) return;
        setJob(current);

        if (current.status === "COMPLETED" || current.status === "FAILED") {
          window.clearInterval(timer);
          if (current.status === "FAILED") {
            setPhase("error");
            setMessage("The import failed while processing. Please try again.");
            return;
          }
          if (current.failedCount + current.skippedCount > 0) {
            const rows = await fetchImportErrors(jobId).catch(() => []);
            if (active) setErrors(rows);
          }
          if (active) setPhase("done");
        }
      } catch {
        // A transient poll failure is ignored; the next tick retries.
      }
    };

    timer = window.setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId]);

  if (phase === "error") {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-red-100 text-danger">
          <IconAlertTriangle size={34} stroke={2} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-ink">Import failed</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {message ?? "Something went wrong while importing."}
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button variant="secondary" onClick={onImportAnother}>
            Start Over
          </Button>
          <Button onClick={onGoToLeads}>Go to Leads</Button>
        </div>
      </div>
    );
  }

  if (phase === "done" && job) {
    const attention = job.failedCount + job.skippedCount;
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-subtle text-brand-strong">
          <IconCheck size={36} stroke={2.5} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-ink">Import Complete</h2>
        <p className="mt-1 text-sm text-ink-muted">
          <span className="font-medium text-ink">{job.importedCount}</span>{" "}
          imported
          {" · "}
          <span className="font-medium text-ink">{job.skippedCount}</span>{" "}
          skipped
          {" · "}
          <span className="font-medium text-ink">{job.failedCount}</span> failed
        </p>

        {attention > 0 && (
          <div className="mt-8 w-full rounded-surface border border-hairline text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">
                Rows that need attention ({attention})
              </h3>
              <a
                href={importErrorsCsvUrl(job.id)}
                className="inline-flex h-control-sm items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm font-medium text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring"
              >
                <IconDownload size={16} stroke={1.75} aria-hidden="true" />
                Download error report
              </a>
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-slim">
              <table className="w-full border-collapse text-sm text-ink">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs text-ink-muted">
                    <th className="px-4 py-2 whitespace-nowrap">Row</th>
                    <th className="px-4 py-2 whitespace-nowrap">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error) => (
                    <tr
                      key={error.rowNumber}
                      className="border-b border-hairline last:border-b-0"
                    >
                      <td className="px-4 py-2 align-top whitespace-nowrap text-ink-muted">
                        {error.rowNumber}
                      </td>
                      <td className="px-4 py-2 text-ink">{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <Button variant="secondary" onClick={onImportAnother}>
            Import Another File
          </Button>
          <Button onClick={onGoToLeads}>Go to Leads</Button>
        </div>
      </div>
    );
  }

  const progress = job
    ? job.totalRows > 0
      ? Math.round((job.processedRows / job.totalRows) * 100)
      : 100
    : 0;

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-10 text-center">
      <h2 className="text-lg font-semibold text-ink">Importing your leads…</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Please keep this page open while we add your records.
      </p>
      <div
        className="mt-8 h-2 w-full overflow-hidden rounded-full bg-canvas"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-shell"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-sm font-medium text-ink">
        {job ? `${job.processedRows} of ${job.totalRows}` : "Starting…"}
      </p>
    </div>
  );
}
