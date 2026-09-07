"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  DEFAULT_FORM_PAGE_SIZE,
  FORM_PAGE_SIZES,
  deleteLeadForm,
  fetchLeadForms,
  type LeadForm,
} from "@/services/data-schema-service";
import type { TableColumn } from "@/types";

/** The builder lives on its own route, as the reference gives it (ADR-0073). */
const BUILDER = "/settings/data-schema/form-customization";

/**
 * Settings → Data & Schema Management → Form Customization.
 *
 * A form is an arrangement of fields, never a second field catalogue: this screen decides
 * which fields the Lead form shows, in what order, and which are hidden (ADR-0072).
 */
export function FormCustomizationView() {
  const { toast } = useToast();
  const router = useRouter();

  const [rows, setRows] = useState<LeadForm[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);

  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_FORM_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [deleting, setDeleting] = useState<LeadForm | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchLeadForms({ page, size }, controller.signal)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
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
  }, [page, size, reloadToken]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  const confirmDelete = async () => {
    const target = deleting;
    if (!target || busy) return;
    setBusy(true);
    try {
      await deleteLeadForm(target.id);
      setDeleting(null);
      toast({ title: `${target.name} deleted`, tone: "success" });
      reload();
    } catch (error: unknown) {
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

  const columns: TableColumn<LeadForm>[] = [
    {
      key: "name",
      header: "Form Name",
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-ink">{row.name}</span>
          {row.isDefault && (
            <span className="shrink-0 rounded-full bg-canvas px-2.5 py-0.5 text-xs text-ink-muted">
              Default
            </span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isActive ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-brand-strong">
            <IconCircleCheck
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
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
      key: "module",
      header: "Module",
      render: (row) => (
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
          {row.module === "LEAD" ? "Lead" : row.module}
        </span>
      ),
    },
    {
      key: "createdByName",
      header: "Created By",
      render: (row) => (
        <span className="truncate text-ink">{row.createdByName ?? "—"}</span>
      ),
    },
    {
      key: "updatedAt",
      header: "Last Edited Date",
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-ink">{formatDate(row.updatedAt)}</span>
          <span className="text-ink-muted">
            {formatTime(row.updatedAt, { seconds: true })}
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
              aria-label={`Edit Lead Form ${row.name}`}
              onClick={() => router.push(`${BUILDER}/${row.id}`)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          {/* The reference draws no delete on the default row, and the API refuses one. */}
          {!row.isDefault && (
            <Tooltip content="Delete">
              <button
                type="button"
                aria-label={`Delete Lead Form ${row.name}`}
                onClick={() => setDeleting(row)}
                className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
              >
                <IconTrash size={16} stroke={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
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
              : "Couldn't load Form Customization"
          }
          description={
            failed === "forbidden"
              ? "Schema management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The forms could not be reached. Check your connection and try again."
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
          <h2 className="text-xl font-semibold text-ink">Form Customization</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Control form fields, layout, and visibility
          </p>
        </div>
        <Button
          aria-label="Add Lead Form"
          onClick={() => router.push(`${BUILDER}/create`)}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Lead Form
        </Button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {rows !== null && rows.length === 0 ? (
          <EmptyState
            title="No forms yet"
            description="Add a lead form to control which fields it shows and in what order."
          />
        ) : (
          <div className="overflow-hidden rounded-control border border-hairline">
            <ResponsiveTableContainer label="Lead forms">
              <Table
                columns={columns}
                rows={rows ?? []}
                getRowId={(row) => row.id}
                isLoading={rows === null}
              />
            </ResponsiveTableContainer>

            {rows !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                <span className="flex flex-wrap items-center gap-3">
                  <RowsPerPage
                    value={size}
                    options={FORM_PAGE_SIZES}
                    onChange={(next) => {
                      setSize(next);
                      setPage(1);
                    }}
                    aria-label="Rows per page, Lead forms"
                  />
                  {/* The reference prints the range beside the control. */}
                  <span className="text-sm text-ink-muted">
                    Showing {total === 0 ? 0 : (page - 1) * size + 1} to{" "}
                    {Math.min(page * size, total)} of {total} rows
                  </span>
                </span>
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

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        tone="danger"
        title="Delete form?"
        description={
          deleting
            ? `${deleting.name} will no longer be available to assign. A form team members are still assigned to cannot be deleted.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}
