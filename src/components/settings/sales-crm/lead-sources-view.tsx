"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCircleMinus,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatTime } from "@/lib/format";
import {
  deleteLeadSource,
  fetchLeadSources,
  type LeadSourceNode,
} from "@/services/lead-sources-service";
import {
  LeadSourceFormDrawer,
  type LeadSourceFormState,
} from "./lead-source-form-drawer";
import type { TableColumn } from "@/types";

/**
 * Settings → Sales & CRM Configuration → Lead Source.
 *
 * The catalogue is real, persisted data from `GET /api/lead-sources` — the same table the
 * New Lead form's Source dropdown reads, so what is managed here is what leads are filed
 * under. Every rule (name uniqueness, delete safety) is enforced by the API; this screen
 * shows the server's answer rather than pre-judging it, which is why a refused delete
 * surfaces the API's own reason and leaves the row exactly where it was.
 *
 * No search box and no pagination controls: the reference screen has neither, and the
 * catalogue is a small bounded list (CLAUDE.md §16.3 — nothing is added that the
 * screenshots do not show).
 */
export function LeadSourcesView() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LeadSourceNode[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<LeadSourceFormState | null>(null);
  const [deleting, setDeleting] = useState<LeadSourceNode | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchLeadSources(controller.signal)
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

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteLeadSource(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      reload();
    } catch (error: unknown) {
      // The API refuses a source that still holds leads; its reason is the useful message,
      // and the row stays exactly where it was.
      toast({
        title: message(error, "Could not delete this lead source."),
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<LeadSourceNode>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => <span className="truncate text-ink">{row.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isActive ? (
          // The reference draws the status as a green check and green text, not as the
          // pill badge the Category rows use.
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
          // No capture shows an inactive source, so this keeps the reference's shape in
          // the project's established muted treatment rather than inventing a new badge.
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
      key: "createdBy",
      header: "Created By",
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar
            name={row.createdByName ?? "System"}
            size="sm"
            className="bg-canvas text-ink-subtle"
          />
          <span className="truncate text-ink">
            {row.createdByName ?? "System"}
          </span>
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Date and Time",
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-ink">{formatDate(row.createdAt)}</span>
          <span className="text-ink-muted">
            {formatTime(row.createdAt, { seconds: true })}
          </span>
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
              aria-label={`Edit Lead Source ${row.name}`}
              onClick={() => setForm({ mode: "edit", source: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Lead Source ${row.name}`}
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

  const body = () => {
    if (failed) {
      return (
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to lead sources"
              : "Couldn't load lead sources"
          }
          description={
            failed === "forbidden"
              ? "Lead source management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The lead source catalogue could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setRows(null);
            setFailed(false);
            reload();
          }}
        />
      );
    }

    return (
      <Table
        columns={columns}
        rows={rows ?? []}
        getRowId={(row) => row.id}
        isLoading={rows === null}
        emptyState={
          <EmptyState
            className="py-16"
            title="No Lead Sources yet"
            description="Create your first Lead Source to start categorizing where leads originate."
          />
        }
      />
    );
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Lead Sources</h2>
          {/* Reference wording, kept verbatim (CLAUDE.md §1). */}
          <p className="mt-0.5 text-sm text-ink-muted">
            Configure your Company&apos;s Basic Settings and Regional Preferences
          </p>
        </div>
        <Button
          aria-label="Add Lead Source"
          onClick={() => setForm({ mode: "create", source: null })}
          disabled={failed !== false}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Lead Source
        </Button>
      </div>

      {/* The card owns the scroll, so a long catalogue never pushes the page sideways. */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {body()}
      </div>

      <LeadSourceFormDrawer
        state={form}
        onClose={() => setForm(null)}
        onSaved={(name, mode) => {
          setForm(null);
          toast({
            title: `Lead Source ${mode === "edit" ? "updated" : "added"}`,
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
        title="Delete Lead Source?"
        description={`Are you sure you want to delete ${deleting?.name ?? "this lead source"}?`}
        confirmLabel="Delete"
        busy={busy}
      />
    </Card>
  );
}
