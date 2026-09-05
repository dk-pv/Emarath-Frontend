"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCircleCheck,
  IconCircleMinus,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { deleteTag, fetchTags, type TagNode } from "@/services/tags-service";
import { TagFormDrawer, type TagFormState } from "./tag-form-drawer";
import type { TableColumn } from "@/types";

/** The reference footer opens on 10, the first of the shared `PAGE_SIZE_OPTIONS`. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Settings → Sales & CRM Configuration → Tags.
 *
 * Real, persisted data from `GET /api/tags` — the same table the lead Tags picker reads
 * through `GET /api/lookups/tags`, so what is managed here is what leads can be tagged
 * with. "Lead Count" is a live server-side aggregate over the lead-tag join, not a stored
 * number, so it tracks tagging and untagging without anything to keep in step.
 *
 * The catalogue is small and bounded, so it is fetched once and paged in the browser —
 * the reference's own "Rows per page" footer, with no extra request per page turn.
 */
export function TagsView() {
  const { toast } = useToast();
  const [rows, setRows] = useState<TagNode[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<TagFormState | null>(null);
  const [deleting, setDeleting] = useState<TagNode | null>(null);
  const [busy, setBusy] = useState(false);

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchTags(controller.signal)
      .then((result) => {
        if (!active) return;
        setRows(result);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed(
          error instanceof ApiError && error.status === 403
            ? "forbidden"
            : "error",
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const total = rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamped rather than reset: deleting the last row of the last page should land on the
  // new last page, not send the user back to the first.
  const current = Math.min(page, pageCount);
  const shown = useMemo(
    () => (rows ?? []).slice((current - 1) * pageSize, current * pageSize),
    [rows, current, pageSize],
  );

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteTag(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      reload();
    } catch (error: unknown) {
      toast({
        title: message(error, "Could not delete this tag."),
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<TagNode>[] = [
    {
      key: "name",
      header: "Tags name",
      render: (row) => <span className="truncate text-ink">{row.name}</span>,
    },
    {
      key: "leadCount",
      header: "Lead Count",
      // The reference carries an ⓘ on this header alone.
      headerAccessory: (
        <IconInfoCircle
          size={14}
          stroke={1.75}
          aria-hidden="true"
          className="shrink-0 text-ink-subtle"
        />
      ),
      render: (row) => (
        <span className="text-ink">{row.leadCount.toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isActive ? (
          <span className="flex items-center gap-1.5 text-brand-strong">
            <IconCircleCheck
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
            Active
          </span>
        ) : (
          // No capture shows an inactive tag, so this keeps the reference's shape in the
          // muted treatment the Lead Source catalogue already established.
          <span className="flex items-center gap-1.5 text-ink-muted">
            <IconCircleMinus
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
            Inactive
          </span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-24",
      render: (row) => (
        <span className="flex items-center gap-1">
          <Tooltip content="Edit">
            <button
              type="button"
              aria-label={`Edit Tag ${row.name}`}
              onClick={() => setForm({ mode: "edit", tag: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Tag ${row.name}`}
              onClick={() => setDeleting(row)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
            >
              <IconTrash size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </span>
      ),
    },
  ];

  if (failed) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to tags"
              : "Couldn't load tags"
          }
          description={
            failed === "forbidden"
              ? "Tag management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The tag catalogue could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setRows(null);
            setFailed(false);
            reload();
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Tags</h2>
          {/* Reference wording, kept verbatim including its capital "And" (CLAUDE.md §1). */}
          <p className="mt-0.5 text-sm text-ink-muted">
            Configure your company&apos;s basic settings And regional preferences
          </p>
        </div>
        <Button
          aria-label="Add Tags"
          onClick={() => setForm({ mode: "create", tag: null })}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Tags
        </Button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        <Table
          columns={columns}
          rows={shown}
          getRowId={(row) => row.id}
          isLoading={rows === null}
          emptyState={
            <EmptyState
              className="py-16"
              title="No tags yet"
              description="Create your first tag to start labelling leads."
            />
          }
        />
      </div>

      {/*
        The reference's "Rows per page" footer, which the shared `Pagination` already
        draws — the same control the Calls and Reports lists use. It carries the page
        navigation too: a page-size selector on its own would leave every row past the
        first page unreachable. Hidden while loading, so it never sits under a skeleton
        table with nothing to page.
      */}
      {rows !== null && total > 0 && (
        <div className="shrink-0 border-t border-hairline p-4">
          <Pagination
            page={current}
            pageCount={pageCount}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
            total={total}
          />
        </div>
      )}

      <TagFormDrawer
        state={form}
        onClose={() => setForm(null)}
        onSaved={(name, mode) => {
          setForm(null);
          toast({
            title: `Tag ${mode === "edit" ? "updated" : "added"}`,
            description: name,
            tone: "success",
          });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete Tag?"
        description={`Are you sure you want to delete ${deleting?.name ?? "this tag"}?`}
        confirmLabel="Delete"
        busy={busy}
      />
    </Card>
  );
}
