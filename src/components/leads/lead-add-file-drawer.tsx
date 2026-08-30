"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { cn } from "@/lib/cn";
import {
  ACCEPT_ATTR,
  fetchDocuments,
  formatFileSize,
  validateDocumentFile,
  type DocumentListItem,
} from "@/services/documents-service";

/** The two sources the reference's "Attach File" selector offers. */
type Source = "desktop" | "documents";

const SOURCES: { value: Source; label: string }[] = [
  { value: "desktop", label: "Upload From Desktop" },
  { value: "documents", label: "Upload From Documents" },
];

export type LeadAddFilePayload = {
  fileName: string;
  /** Set when the file came from the user's machine. */
  file?: File;
  /** Set when an existing document was picked instead. */
  documentId?: string;
};

export type LeadAddFileDrawerProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LeadAddFilePayload) => Promise<void> | void;
};

/**
 * The Lead Detail page's "Add File" drawer, matched to the supplied reference: a File Name
 * field, an "Attach File" selector whose label floats into its border while active, the two
 * upload sources, and the Cancel / Submit footer.
 *
 * Reuses the Documents module's own file policy — the allowed extensions, the size ceiling
 * and `validateDocumentFile` — so an attachment can never be accepted here that the upload
 * endpoint would reject. "Upload From Documents" lists the caller's scoped documents, so it
 * offers only files they can already see.
 */
export function LeadAddFileDrawer({
  open,
  onClose,
  onSubmit,
}: LeadAddFileDrawerProps) {
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const selector = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(selector, isOpen, close);

  const picked =
    source === "desktop"
      ? (file?.name ?? null)
      : source === "documents"
        ? (documentId ?? null)
        : null;

  const canSubmit =
    fileName.trim().length > 0 && picked !== null && !submitting;

  const chooseSource = (next: Source) => {
    setSource(next);
    setError(null);
    close();
    if (next === "desktop") {
      setDocumentId(null);
      // Let the panel close before the OS dialog steals focus.
      requestAnimationFrame(() => fileInput.current?.click());
    } else {
      setFile(null);
    }
  };

  const chooseFile = (next: File | null) => {
    if (!next) return;
    const problem = validateDocumentFile(next);
    if (problem) {
      setError(problem);
      setFile(null);
      return;
    }
    setError(null);
    setFile(next);
    // The reference's File Name defaults to the chosen file until the user edits it.
    if (!fileName.trim()) setFileName(next.name.replace(/\.[^.]+$/, ""));
  };

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        fileName: fileName.trim(),
        file: file ?? undefined,
        documentId: documentId ?? undefined,
      });
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Couldn’t attach the file. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const Chevron = isOpen ? IconChevronUp : IconChevronDown;
  const selectorLabel =
    source === null
      ? "Select"
      : (SOURCES.find((entry) => entry.value === source)?.label ?? "Select");
  /** The label floats into the border once the control is active, as the reference shows. */
  const floating = isOpen || source !== null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add File"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}

        <Input
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          placeholder="File Name"
          aria-label="File Name"
          size="lg"
        />

        <div ref={selector} className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label="Attach File"
            onClick={toggle}
            className={cn(
              "focus-ring flex h-control-lg w-full items-center justify-between gap-2 rounded-control border bg-surface px-field-x text-sm transition-colors duration-(--duration-shell) ease-shell",
              isOpen ? "border-brand" : "border-hairline hover:border-brand/60",
            )}
          >
            <span className={source ? "text-ink" : "text-ink-subtle"}>
              {selectorLabel}
            </span>
            <Chevron
              size={18}
              stroke={2}
              className="shrink-0 text-ink"
              aria-hidden="true"
            />
          </button>

          {/* Notched into the border, so it reads as one outlined field. */}
          {floating && (
            <span className="pointer-events-none absolute -top-2 left-2.5 bg-surface px-1 text-xs text-ink-muted">
              Attach File
            </span>
          )}

          {isOpen && (
            <div
              role="listbox"
              aria-label="Attach File"
              className="absolute top-[calc(100%+8px)] left-0 z-50 w-full rounded-surface border border-hairline bg-surface py-1 shadow-lg"
            >
              {SOURCES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  role="option"
                  aria-selected={source === entry.value}
                  onClick={() => chooseSource(entry.value)}
                  className="focus-ring-inset flex w-full items-center px-4 py-3 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The native picker the "Upload From Desktop" option drives. */}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />

        {source === "desktop" && file && (
          <ChosenFile
            label={`${file.name} · ${formatFileSize(file.size)}`}
            onClear={() => setFile(null)}
          />
        )}

        {source === "documents" && (
          <DocumentPicker value={documentId} onChange={setDocumentId} />
        )}
      </div>
    </Drawer>
  );
}

function ChosenFile({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-3 py-2 text-sm text-ink">
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        aria-label="Remove file"
        onClick={onClear}
        className="focus-ring flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-danger"
      >
        <IconX size={16} stroke={2} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Picks one of the caller's existing documents for "Upload From Documents". */
function DocumentPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DocumentListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchDocuments(
      { page: 1, size: 25 },
      { search: search.trim() || undefined },
      controller.signal,
    )
      .then((result) => {
        if (active) setRows([...result.rows]);
      })
      .catch((problem: unknown) => {
        if (!active) return;
        if (problem instanceof DOMException && problem.name === "AbortError")
          return;
        setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [search]);

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline p-2">
      <PanelSearch
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search documents"
        aria-label="Search documents"
      />

      <div className="scrollbar-slim max-h-56 overflow-y-auto">
        {failed ? (
          <p className="px-3 py-6 text-center text-sm text-danger">
            Couldn’t load documents.
          </p>
        ) : rows === null ? (
          <p className="px-3 py-6 text-center text-sm text-ink-subtle">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-subtle">
            No documents found
          </p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              role="option"
              aria-selected={value === row.id}
              onClick={() => onChange(row.id)}
              className={cn(
                "focus-ring-inset flex w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors duration-(--duration-shell) ease-shell",
                value === row.id
                  ? "bg-brand-subtle text-ink"
                  : "text-ink hover:bg-canvas",
              )}
            >
              <span className="min-w-0 truncate">{row.title}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {formatFileSize(row.sizeBytes)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
