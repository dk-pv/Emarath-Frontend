"use client";

import { useEffect, useRef, useState } from "react";
import { IconCloudUpload, IconFileCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  ACCEPT_ATTR,
  formatFileSize,
  uploadDocument,
  validateDocumentFile,
  type DocumentResponse,
} from "@/services/documents-service";
import type { SelectOption } from "@/types";

type DocumentFormDrawerProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: (document: DocumentResponse) => void;
};

/**
 * The Add Document drawer (DOC-02.2), built from `documents-add-document-drawer-open-empty-form.png`:
 * a File name field, a Select Users access dropdown and a dashed file drop zone, with
 * Cancel/Submit in the footer. The reference drawer captures no category field, so none is
 * shown (CLAUDE §16); the DOC-02.1 API still accepts one for future modules.
 *
 * File type and size are validated on selection (AC5) before any upload; the backend
 * StorageService is the authoritative gate. Upload runs through the shared DOC-02.1 endpoint
 * (AC3), Submit is disabled while it is in flight (no duplicate submission), and success/
 * failure surface as a toast.
 */
export function DocumentFormDrawer({
  open,
  onClose,
  onUploaded,
}: DocumentFormDrawerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [users, setUsers] = useState<SelectOption[]>([]);

  // Populate the Select Users options from the existing assignable-agents API (reused,
  // not re-invented). Leaving it empty must not break the upload.
  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then((list) =>
        setUsers(list.map((user) => ({ value: user.id, label: user.name }))),
      )
      .catch(() => {
        /* an unreachable users list still allows an owner-only upload */
      });
    return () => controller.abort();
  }, []);

  const pickFile = (candidate: File | undefined) => {
    if (!candidate || submitting) return;
    const error = validateDocumentFile(candidate);
    if (error) {
      setFile(null);
      setFileError(error);
      return;
    }
    setFileError(null);
    setFile(candidate);
  };

  async function submit() {
    setApiError(null);
    const trimmedTitle = title.trim();
    const missingTitle = trimmedTitle === "" ? "File name is required" : null;
    const missingFile = file ? null : "A file is required.";
    setTitleError(missingTitle);
    if (!file) setFileError(missingFile);
    if (missingTitle || !file) return;

    setSubmitting(true);
    try {
      const created = await uploadDocument({
        file,
        title: trimmedTitle,
        userIds: userIds.length ? userIds : undefined,
      });
      toast({ title: `“${created.title}” uploaded`, tone: "success" });
      onUploaded(created);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Something went wrong while uploading. Please try again.";
      setApiError(message);
      toast({ title: "Couldn’t upload document", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add Document"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={submitting}
            disabled={submitting}
          >
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
        {apiError && (
          <p
            role="alert"
            className="rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {apiError}
          </p>
        )}

        <FormField label="File name" required error={titleError ?? undefined}>
          {(control) => (
            <Input
              {...control}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="File name"
            />
          )}
        </FormField>

        <FormField label="Select Users">
          <MultiSelect
            searchable
            options={users}
            value={userIds}
            onChange={setUserIds}
            placeholder="Select Users"
          />
        </FormField>

        <FormField label="Attachment" required error={fileError ?? undefined}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop a file to attach, or browse"
            aria-busy={submitting}
            onClick={() => !submitting && inputRef.current?.click()}
            onKeyDown={(event) => {
              if (!submitting && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!submitting) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center rounded-surface border-2 border-dashed px-6 py-10 text-center transition-colors duration-(--duration-shell) ease-shell focus-ring",
              dragging ? "border-brand bg-brand-subtle" : "border-hairline",
              submitting && "pointer-events-none opacity-80",
            )}
          >
            <IconCloudUpload
              aria-hidden="true"
              stroke={1.5}
              className="size-8 text-ink-muted"
            />
            <p className="mt-3 text-sm text-ink-muted">
              Drop files to attach, or{" "}
              <span className="font-medium text-brand-strong">browse</span>.
            </p>

            {file && (
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-sm font-medium text-brand-strong">
                <IconFileCheck size={16} stroke={1.75} aria-hidden="true" />
                <span className="max-w-56 truncate">{file.name}</span>
                <span className="text-brand">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="inline-flex text-brand-strong hover:text-danger focus-ring"
                >
                  <IconX size={14} stroke={2} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </FormField>
      </form>
    </Drawer>
  );
}
