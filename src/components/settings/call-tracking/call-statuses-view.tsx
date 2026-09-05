"use client";

import { useCallback, useEffect, useState } from "react";
import { IconPencil } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { RowsPerPage } from "@/components/ui/RowsPerPage";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  fetchCallStatuses,
  saveCallStatus,
  type CallStatusRow,
} from "@/services/call-tracking-settings-service";
import type { TableColumn } from "@/types";

/** The reference's footer opens on 10. */
const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

const MAX_CUSTOM_STATUS_NAME = 60;

/**
 * Settings → Call Tracking → Call Status.
 *
 * The six provider statuses with the labels this company gives them. The first column is
 * the provider's own status and has no edit control anywhere in the reference — renaming
 * "ANSWERED" to "Connected" changes what the status is *called*, never what the Call model
 * stores, so the Call Dashboard keeps aggregating on the same `CallOutcome` values
 * (ADR-0070).
 *
 * The set is fixed at six, so the page is paged rather than searched or filtered: the
 * reference's footer carries a rows-per-page control and nothing else.
 */
export function CallStatusesView() {
  const { toast } = useToast();

  const [rows, setRows] = useState<CallStatusRow[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState<CallStatusRow | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchCallStatuses(controller.signal)
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
  // Six statuses fit one page at every offered size; the slice keeps that honest if the
  // provider vocabulary ever grows.
  const shown = (rows ?? []).slice((page - 1) * size, page * size);

  const columns: TableColumn<CallStatusRow>[] = [
    {
      key: "defaultName",
      header: "Default Status Name",
      render: (row) => (
        // The reference prints the ⓘ beside the default status only.
        <SettingLabel className="text-ink">{row.defaultName}</SettingLabel>
      ),
    },
    {
      key: "customName",
      header: "Custom Status Name",
      render: (row) => <span className="text-ink">{row.customName}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      className: "w-24",
      render: (row) => (
        <span className="flex items-center justify-end">
          <Tooltip content="Edit">
            <button
              type="button"
              aria-label={`Edit Call Status ${row.defaultName}`}
              onClick={() => setEditing(row)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={18} stroke={1.75} aria-hidden="true" />
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
              : "Couldn't load call statuses"
          }
          description={
            failed === "forbidden"
              ? "Call tracking settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The call statuses could not be reached. Check your connection and try again."
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
      <div className="shrink-0 border-b border-hairline p-5">
        <h2 className="text-xl font-semibold text-ink">Call Status</h2>
        {/* Reference wording, kept verbatim including its capital "And" (CLAUDE.md §16). */}
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s basic settings And regional preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {/*
          One bordered, rounded panel holding the table *and* its rows-per-page row —
          the reference draws them inside the same box, not as a card-level footer.
        */}
        <div className="overflow-hidden rounded-control border border-hairline">
          <ResponsiveTableContainer label="Call statuses">
            <Table
              columns={columns}
              rows={shown}
              getRowId={(row) => row.providerStatus}
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
                aria-label="Rows per page, Call statuses"
              />
              {/* Page navigation joins it only once six statuses no longer fit. */}
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
      </div>

      <EditCallStatusModal
        status={editing}
        onClose={() => setEditing(null)}
        onSaved={(statuses, name) => {
          setRows(statuses);
          setEditing(null);
          toast({ title: `Call status renamed to ${name}`, tone: "success" });
        }}
      />
    </Card>
  );
}

/**
 * The pencil's edit interaction: one field, the custom label.
 *
 * The default status is shown as read-only context rather than an input, because the
 * reference's first column carries no edit control — the provider's own status is not
 * something this screen is allowed to change.
 */
function EditCallStatusModal({
  status,
  onClose,
  onSaved,
}: {
  status: CallStatusRow | null;
  onClose: () => void;
  onSaved: (statuses: CallStatusRow[], name: string) => void;
}) {
  if (!status) return null;
  return (
    <EditCallStatusForm
      key={status.providerStatus}
      status={status}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function EditCallStatusForm({
  status,
  onClose,
  onSaved,
}: {
  status: CallStatusRow;
  onClose: () => void;
  onSaved: (statuses: CallStatusRow[], name: string) => void;
}) {
  const [name, setName] = useState(status.customName);
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const error =
    name.trim() === ""
      ? "Custom Status Name is required."
      : name.trim().length > MAX_CUSTOM_STATUS_NAME
        ? `Custom Status Name must be ${MAX_CUSTOM_STATUS_NAME} characters or fewer.`
        : undefined;
  const shownError = touched ? error : undefined;

  const submit = async () => {
    if (busy) return;
    if (error) {
      setTouched(true);
      setFormError("Fix the highlighted field and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const statuses = await saveCallStatus(status.providerStatus, name.trim());
      onSaved(statuses, name.trim());
    } catch (apiError: unknown) {
      // The modal stays open: a refused save must not look like a success.
      setFormError(
        apiError instanceof ApiError
          ? (apiError.messages[0] ?? apiError.message)
          : "Could not save this status.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="sm"
      title="Edit Call Status"
      footer={
        <>
          <Button
            variant="ghost"
            aria-label="Cancel"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            aria-label="Save Call Status"
            onClick={() => void submit()}
            isLoading={busy}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {formError && <FormError>{formError}</FormError>}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-muted">Default Status Name</span>
          <p className="text-sm font-medium text-ink">{status.defaultName}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="custom-status-name"
            className="text-sm text-ink-muted"
          >
            Custom Status Name
          </label>
          <Input
            autoFocus
            size="lg"
            id="custom-status-name"
            value={name}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={
              shownError ? "custom-status-name-error" : undefined
            }
            onChange={(event) => {
              setTouched(true);
              setFormError(null);
              setName(event.target.value);
            }}
          />
          {shownError && (
            <p
              id="custom-status-name-error"
              role="alert"
              className="text-sm text-danger"
            >
              {shownError}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
