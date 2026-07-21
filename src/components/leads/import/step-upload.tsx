"use client";

import { useRef, useState } from "react";
import { IconFileCheck } from "@tabler/icons-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  parseImportFile,
  type ParseResult,
} from "@/services/leads-import-service";

const ACCEPT = ".csv,.xlsx";
const MAX_BYTES = 10 * 1024 * 1024;
const VALID_EXT = /\.(csv|xlsx)$/i;

type StepUploadProps = {
  onParsed: (file: File, result: ParseResult) => void;
};

/**
 * Step 1 — Upload File, matching `leads-import-wizard-step1-upload-file.png`: a
 * centred heading over a large dashed drop zone with the CSV/XLSX illustration,
 * constraints and sample-file links. A valid pick is parsed by the backend (header
 * detection + preview); the "Parsing…" spinner and the invalid-file message are the
 * states the video does not show, in the same design language.
 */
export function StepUpload({ onParsed }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!VALID_EXT.test(file.name)) {
      setError("File must be a CSV or XLSX.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File exceeds the 10MB limit.");
      return;
    }
    setError(null);
    setName(file.name);
    setBusy(true);
    try {
      const result = await parseImportFile(file);
      onParsed(file, result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The file could not be read.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-6">
      <h2 className="text-center text-2xl font-semibold text-ink">
        Upload Your File
      </h2>
      <p className="mt-1 text-center text-sm text-ink-muted">
        Upload a CSV or Excel file containing lead data
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV or XLSX file"
        aria-busy={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!busy && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={cn(
          "mt-8 flex w-full cursor-pointer flex-col items-center rounded-surface border-2 border-dashed px-8 py-14 text-center transition-colors duration-(--duration-shell) ease-shell focus-ring",
          dragging ? "border-brand bg-brand-subtle" : "border-hairline",
          busy && "pointer-events-none opacity-80",
        )}
      >
        {busy ? (
          <Spinner size="lg" label="Parsing your file" className="text-brand" />
        ) : (
          <FileGlyph />
        )}

        <p className="mt-6 text-sm text-ink-muted">
          {busy
            ? "Parsing your file…"
            : "Drop a single file or click to upload"}
        </p>
        {!busy && (
          <p className="mt-1 text-sm font-semibold text-ink">(CSV or XLSX)</p>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          Maximum File Size upto 10MB
        </p>

        {name && (
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-sm font-medium text-brand-strong">
            <IconFileCheck size={16} stroke={1.75} aria-hidden="true" />
            {name}
          </span>
        )}

        <span className="my-6 h-px w-full max-w-md bg-hairline" />

        <p className="text-sm text-ink-muted">
          You can download sample importing files below
        </p>
        <p className="mt-1 text-sm">
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="font-medium text-brand-strong hover:underline"
          >
            CSV Sample
          </button>
          <span className="mx-2 text-ink-subtle">|</span>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="font-medium text-brand-strong hover:underline"
          >
            XLSX Sample
          </button>
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => void accept(event.target.files?.[0])}
      />
    </div>
  );
}

/** The overlapping CSV (orange) / XLSX (blue) file badges from the reference. */
function FileGlyph() {
  return (
    <span className="relative block h-16 w-20" aria-hidden="true">
      <span className="absolute top-1 left-2 flex h-14 w-11 -rotate-12 items-end justify-center rounded-md bg-orange-400 pb-2 text-[10px] font-bold text-white shadow-sm">
        CSV
      </span>
      <span className="absolute top-0 right-1 flex h-14 w-11 rotate-6 items-end justify-center rounded-md bg-blue-500 pb-2 text-[10px] font-bold text-white shadow-sm">
        XLSX
      </span>
    </span>
  );
}
