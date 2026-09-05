"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCircleX,
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
import { RowsPerPage } from "@/components/ui/RowsPerPage";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { formatDate, formatTime } from "@/lib/format";
import {
  deleteFollowUpType,
  fetchFollowUpTypes,
  type FollowUpType,
} from "@/services/activity-settings-service";
import {
  FollowUpTypeModal,
  type FollowUpTypeFormState,
} from "./follow-up-type-modal";
import type { TableColumn } from "@/types";

/** The reference's footer opens on 05. */
const PAGE_SIZES = [5, 10, 25] as const;
const DEFAULT_PAGE_SIZE = 5;

/**
 * Settings → Activity and Reminders → Follow Up Types.
 *
 * The whole list is one `app_settings` row, so it arrives in one response and is paged in
 * the browser — the opposite of Templates, which is a real collection behind a server
 * page. Every mutation answers with the whole list, so the table redraws from the
 * server's answer rather than a local guess.
 */
export function FollowUpTypesView() {
  const { toast } = useToast();

  const [rows, setRows] = useState<FollowUpType[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const [form, setForm] = useState<FollowUpTypeFormState | null>(null);
  const [deleting, setDeleting] = useState<FollowUpType | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchFollowUpTypes(controller.signal)
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
  const pageCount = Math.max(1, Math.ceil(total / size));
  const shown = (rows ?? []).slice((page - 1) * size, page * size);

  const confirmDelete = async () => {
    const target = deleting;
    if (!target || busy) return;
    setBusy(true);
    try {
      const types = await deleteFollowUpType(target.id);
      setRows(types);
      setDeleting(null);
      toast({ title: `${target.name} deleted`, tone: "success" });
    } catch (error: unknown) {
      // A refusal is the point of the check, so it is reported rather than swallowed.
      toast({
        title:
          error instanceof ApiError
            ? (error.messages[0] ?? error.message)
            : `Couldn't delete ${target.name}`,
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<FollowUpType>[] = [
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
          <span className="flex items-center gap-1.5 text-ink-muted">
            <IconCircleX
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
      render: (row) => <span className="text-ink">{row.createdBy}</span>,
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
              aria-label={`Edit Follow Up Type ${row.name}`}
              onClick={() => setForm({ mode: "edit", type: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Follow Up Type ${row.name}`}
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
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to these settings"
              : "Couldn't load Follow Up Types"
          }
          description={
            failed === "forbidden"
              ? "Activity and reminder settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The follow up types could not be reached. Check your connection and try again."
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
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-hairline p-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Follow Up Types</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Configure follow-up types and manage associated fields
          </p>
        </div>
        <Button
          aria-label="Add Follow Up Type"
          onClick={() => setForm({ mode: "create" })}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Follow Up Type
        </Button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {rows !== null && rows.length === 0 ? (
          <EmptyState
            title="No follow up types yet"
            description="Add a follow up type to configure the fields its follow-up form shows."
          />
        ) : (
          /*
            One bordered, rounded panel holding the table *and* its rows-per-page row —
            the reference draws them inside the same box, not as a card-level footer.
          */
          <div className="overflow-hidden rounded-control border border-hairline">
            <ResponsiveTableContainer label="Follow up types">
              <Table
                columns={columns}
                rows={shown}
                getRowId={(row) => row.id}
                isLoading={rows === null}
              />
            </ResponsiveTableContainer>

            {rows !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                <RowsPerPage
                  value={size}
                  options={PAGE_SIZES}
                  onChange={(next) => {
                    setSize(next);
                    setPage(1);
                  }}
                  aria-label="Rows per page, Follow up types"
                />
                {pageCount > 1 && (
                  <Pagination
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <FollowUpTypeModal
        state={form}
        onClose={() => setForm(null)}
        onSaved={(types, name, mode) => {
          setRows(types);
          setForm(null);
          toast({
            title: mode === "create" ? `${name} added` : `${name} saved`,
            tone: "success",
          });
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        tone="danger"
        title="Delete follow up type?"
        description={
          deleting
            ? `${deleting.name} will no longer be offered on the Add Follow-up form. Follow-ups already filed under it are not deleted.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}
