"use client";

import { useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { downloadImportErrors } from "@/services/leads-import-service";

/** Visible text, or — icon only — the accessible name, which is then required. */
type ErrorReportButtonProps = { jobId: string } & (
  { label: string } | { "aria-label": string }
);

/**
 * Downloads an import job's failed/skipped rows as CSV. A button over the session-aware
 * Blob download (not a link to the API), so an expired session refreshes instead of
 * opening the API's raw error page; a refusal surfaces as a toast. It stays enabled while
 * busy (a repeat press is ignored): disabling it would drop keyboard focus to the page,
 * out of the Import History modal.
 */
export function ErrorReportButton(props: ErrorReportButtonProps) {
  const { jobId } = props;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadImportErrors(jobId);
    } catch (caught) {
      toast({
        title: "Couldn’t download the error report",
        description: caught instanceof Error ? caught.message : undefined,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  const icon = busy ? (
    <Spinner size="sm" label="Downloading" />
  ) : (
    <IconDownload size={16} stroke={1.75} aria-hidden="true" />
  );

  if ("label" in props) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void download()}
        aria-busy={busy || undefined}
      >
        {icon}
        {props.label}
      </Button>
    );
  }

  return (
    <IconButton
      variant="outline"
      size="lg"
      aria-label={props["aria-label"]}
      onClick={() => void download()}
      aria-busy={busy || undefined}
    >
      {icon}
    </IconButton>
  );
}
