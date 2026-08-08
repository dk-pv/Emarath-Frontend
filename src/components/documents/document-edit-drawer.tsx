"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  fetchDocument,
  updateDocument,
  type DocumentResponse,
} from "@/services/documents-service";
import type { SelectOption } from "@/types";

type DocumentEditDrawerProps = {
  documentId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (document: DocumentResponse) => void;
};

/**
 * The Edit Document drawer (DOC-04.1): rename a document and change its access whitelist. It
 * loads the document's current title + access on open (a 404 becomes a load-error state), then
 * reuses the same primitives as the Add drawer — File name and Select Users, no file field
 * (the bytes are never changed here). Save PATCHes the changes; the server re-checks
 * permission (owner/SUPERADMIN), so a forbidden response is surfaced, not assumed away.
 */
export function DocumentEditDrawer({
  documentId,
  open,
  onClose,
  onSaved,
}: DocumentEditDrawerProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);

  // Load the document's current values plus the assignable users, together. The options are
  // the union of assignable agents and the users already granted access, so a current grantee
  // who is not an assignable agent still shows as a chip and is not silently dropped on save.
  // State is set only in the async callbacks (the useListData pattern), never synchronously in
  // the effect body; the retry handler resets to the loading state.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchDocument(documentId, controller.signal),
      fetchAssignableAgents(controller.signal).catch(
        () => [] as { id: string; name: string }[],
      ),
    ])
      .then(([document, agents]) => {
        setTitle(document.title);
        setUserIds(document.access.map((user) => user.id));
        const byId = new Map<string, SelectOption>();
        for (const user of [...agents, ...document.access]) {
          byId.set(user.id, { value: user.id, label: user.name });
        }
        setUsers([...byId.values()]);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoadError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [documentId, reload]);

  async function submit() {
    setApiError(null);
    const trimmed = title.trim();
    if (trimmed === "") {
      setTitleError("File name is required");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateDocument(documentId, {
        title: trimmed,
        userIds,
      });
      toast({ title: `“${updated.title}” updated`, tone: "success" });
      onSaved(updated);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 403
            ? "You do not have permission to edit this document."
            : error.messages.join(" · ") || error.message
          : "Something went wrong while saving. Please try again.";
      setApiError(message);
      toast({ title: "Couldn’t update document", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit Document"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={submitting}
            disabled={submitting || loading || loadError}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size="lg" label="Loading document" className="text-brand" />
        </div>
      ) : loadError ? (
        <ErrorState
          title="Couldn’t load the document"
          description="It may have been removed, or is not in your scope. Try again."
          onRetry={() => {
            setLoadError(false);
            setLoading(true);
            setReload((value) => value + 1);
          }}
        />
      ) : (
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
        </form>
      )}
    </Drawer>
  );
}
