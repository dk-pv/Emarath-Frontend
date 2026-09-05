"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCircleCheckFilled,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import {
  deletePipeline,
  fetchPipelines,
  formatPipelineStamp,
  setDefaultPipeline,
  type PipelineNode,
} from "@/services/pipelines-service";
import type { TableColumn } from "@/types";
import { PipelineWizard } from "./pipeline-wizard";

/**
 * Settings → Sales & CRM Configuration → Sales Pipeline.
 *
 * The catalogue is real, persisted data from `GET /api/pipelines` — the same table
 * `Lead.pipeline`, `Stage.pipeline` and the Kanban board read through, so a pipeline made
 * here is immediately selectable everywhere (ADR-0059). Lead counts are a live server-side
 * aggregate, never a stored number.
 *
 * Every structural rule — one default, delete refused while leads sit on the pipeline —
 * is enforced by the API; this screen shows the server's answer rather than pre-judging it.
 */
export function PipelinesView() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PipelineNode[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  /** Non-null while the wizard is open: the pipeline being edited, or null to create. */
  const [wizard, setWizard] = useState<{ pipeline: PipelineNode | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<PipelineNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The row whose default is being applied — its control shows the pending state. */
  const [defaulting, setDefaulting] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchPipelines(controller.signal)
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

  const makeDefault = async (pipeline: PipelineNode) => {
    if (pipeline.isDefault || defaulting) return;
    setDefaulting(pipeline.id);
    try {
      // The API answers with the whole catalogue, so the previous default clears in the
      // same render as the new one — no window where the table shows two.
      setRows(await setDefaultPipeline(pipeline.id));
      toast({
        title: "Successful",
        description: "Pipeline has been set as the default successfully.",
        tone: "success",
      });
    } catch (error: unknown) {
      toast({
        title: message(error, "Could not set the default pipeline."),
        tone: "danger",
      });
      reload();
    } finally {
      setDefaulting(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deletePipeline(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      reload();
    } catch (error: unknown) {
      setDeleteError(message(error, "Could not delete this pipeline."));
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<PipelineNode>[] = [
      {
        key: "name",
        header: "Name",
        render: (row) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-ink">{row.name}</span>
            {row.isDefault && (
              <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Default
              </span>
            )}
          </span>
        ),
      },
      {
        key: "leads",
        header: "Leads",
        render: (row) => (
          <span className="text-ink">{row.leadCount.toLocaleString()}</span>
        ),
      },
      {
        key: "createdBy",
        header: "Created By",
        render: (row) => (
          <span className="flex min-w-0 items-center gap-2">
            {/* The reference shows the product mark beside each author's name. */}
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-bold text-brand-strong"
            >
              E
            </span>
            <span className="truncate text-ink">
              {row.createdByName ?? "System"}
            </span>
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Date and Time",
        render: (row) => {
          const stamp = formatPipelineStamp(row.createdAt);
          return (
            <span className="flex flex-col leading-tight">
              <span className="text-ink">{stamp.date}</span>
              <span className="text-ink-muted">{stamp.time}</span>
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-36",
        render: (row) => (
          <span className="flex items-center gap-1">
            <Tooltip content="Edit">
              <button
                type="button"
                aria-label={`Edit ${row.name}`}
                onClick={() => setWizard({ pipeline: row })}
                className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
              >
                <IconPencil size={16} stroke={1.75} aria-hidden="true" />
              </button>
            </Tooltip>

            {/*
              The reference shows a filled green check on the default row and a hollow one
              elsewhere, whose tooltip reads "Make Default". The default's own control is
              inert — it already is the default — so it is disabled rather than clickable.
            */}
            <Tooltip content={row.isDefault ? "Default pipeline" : "Make Default"}>
              <button
                type="button"
                aria-label={
                  row.isDefault
                    ? `${row.name} is the default pipeline`
                    : `Make ${row.name} the default pipeline`
                }
                aria-pressed={row.isDefault}
                disabled={row.isDefault || defaulting !== null}
                onClick={() => void makeDefault(row)}
                className="focus-ring flex size-7 items-center justify-center rounded-control transition-colors duration-(--duration-shell) ease-shell disabled:cursor-default enabled:hover:bg-canvas"
              >
                {row.isDefault ? (
                  <IconCircleCheckFilled
                    size={20}
                    aria-hidden="true"
                    className="text-green-500"
                  />
                ) : (
                  <IconCircleCheck
                    size={20}
                    stroke={1.75}
                    aria-hidden="true"
                    className="text-ink-muted"
                  />
                )}
              </button>
            </Tooltip>

            <Tooltip content="Delete">
              <button
                type="button"
                aria-label={`Delete ${row.name}`}
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(row);
                }}
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
              ? "You don't have access to sales pipelines"
              : "Couldn't load pipelines"
          }
          description={
            failed === "forbidden"
              ? "Pipeline management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The pipeline catalogue could not be reached. Check your connection and try again."
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

  const blockedReason = deleting?.isDefault
    ? "is the default pipeline. Make another pipeline the default before deleting it."
    : deleting && deleting.leadCount > 0
      ? `holds ${deleting.leadCount.toLocaleString()} lead${deleting.leadCount === 1 ? "" : "s"}. Move them before deleting it.`
      : null;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Sales Pipeline</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Manage and organize your sales pipelines to track leads effectively
          </p>
        </div>
        {wizard === null && (
          <Button onClick={() => setWizard({ pipeline: null })}>
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add Pipeline
          </Button>
        )}
      </div>

      {wizard ? (
        <PipelineWizard
          pipeline={wizard.pipeline}
          onClose={() => setWizard(null)}
          onSaved={reload}
        />
      ) : (
        <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
          <Table
            columns={columns}
            rows={rows ?? []}
            getRowId={(row) => row.id}
            isLoading={rows === null}
            emptyState={
              <EmptyState
                className="py-16"
                title="No pipelines yet"
                description="Create the first pipeline to start routing leads."
              />
            }
          />
        </div>
      )}

      <Modal
        open={deleting !== null}
        onClose={busy ? () => {} : () => setDeleting(null)}
        title="Delete Pipeline"
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              onClick={
                blockedReason ? () => setDeleting(null) : () => void confirmDelete()
              }
              isLoading={busy}
              aria-label={
                blockedReason ? "Okay, close" : `Delete ${deleting?.name ?? ""}`
              }
            >
              Okay
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {deleteError && <FormError>{deleteError}</FormError>}
          {/* The reference tints the whole callout, not just its icon. */}
          <Alert tone="warning" className="items-center [&_p]:text-warning">
            <p>
              <b className="font-semibold">{deleting?.name}</b>{" "}
              {blockedReason ?? (
                <>
                  will be permanently deleted, along with its stages. This cannot
                  be undone.
                </>
              )}
            </p>
          </Alert>
        </div>
      </Modal>
    </Card>
  );
}
