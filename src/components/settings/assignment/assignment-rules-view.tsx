"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCircleMinus,
  IconFileText,
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
import { SearchInput } from "@/components/ui/SearchInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { formatDate, formatTime } from "@/lib/format";
import {
  DEFAULT_RULE_PAGE_SIZE,
  RULE_PAGE_SIZES,
  RULE_STATUS_FILTERS,
  deleteAssignmentRule,
  fetchAssignmentRules,
  type AssignmentRule,
  type RuleStatusFilter,
} from "@/services/assignment-rules-service";
import {
  AssignmentRuleWizard,
  type RuleWizardState,
} from "./assignment-rule-wizard";
import type { TableColumn } from "@/types";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Settings → Assignment → Assignment Rules.
 *
 * Search, the status filter and paging all travel to the API — filtering a fetched page in
 * the browser would silently hide matches sitting on page two. Every mutation refetches the
 * current page, so the total, the ordering and the row itself are the server's answer.
 */
export function AssignmentRulesView() {
  const { toast } = useToast();

  const [rows, setRows] = useState<AssignmentRule[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<RuleStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_RULE_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [wizard, setWizard] = useState<RuleWizardState | null>(null);
  const [deleting, setDeleting] = useState<AssignmentRule | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /*
    Typing debounces; every other control applies at once. The state change happens in the
    timer callback, never in the effect body, so a keystroke costs one render and one
    request. A narrower result can leave the current page past the end of the list, so this
    resets it — as the filter and page-size handlers do.
  */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchAssignmentRules(
      { search: debouncedSearch, status, page, size },
      controller.signal,
    )
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
  }, [debouncedSearch, status, page, size, reloadToken]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteAssignmentRule(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      if (rows?.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (error: unknown) {
      toast({
        title:
          error instanceof ApiError
            ? (error.messages[0] ?? error.message)
            : "Could not delete this rule.",
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const stamp = (value: string) => (
    <span className="flex flex-col leading-tight">
      <span className="text-ink">{formatDate(value)}</span>
      <span className="text-ink-muted">{formatTime(value)}</span>
    </span>
  );

  const columns: TableColumn<AssignmentRule>[] = [
    {
      key: "name",
      header: "Rule Name",
      render: (row) => <span className="truncate text-ink">{row.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.status === "ACTIVE" ? (
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
        <span className="truncate text-ink">{row.createdByName ?? "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created Date",
      render: (row) => stamp(row.createdAt),
    },
    {
      key: "updatedAt",
      header: "Last Edited Date",
      render: (row) => stamp(row.updatedAt),
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
              aria-label={`Edit Rule ${row.name}`}
              onClick={() => setWizard({ mode: "edit", rule: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Rule ${row.name}`}
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
              ? "You don't have access to assignment rules"
              : "Couldn't load assignment rules"
          }
          description={
            failed === "forbidden"
              ? "Assignment rules are limited to administrator accounts. Sign in as an administrator and try again."
              : "The rule list could not be reached. Check your connection and try again."
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
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Assignment Rule</h2>
          {/* Reference wording, kept verbatim (CLAUDE.md §16). */}
          <p className="mt-0.5 text-sm text-ink-muted">
            View assignment conditions and user distribution for this rule.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            aria-label="Search rules"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            /* Borderless at rest, as the reference draws it; the border is the focus cue. */
            className="border-transparent bg-transparent focus:border-brand sm:w-40"
          />

          <div className="sm:w-40">
            <SearchableSelect
              portal
              id="rule-status-filter"
              aria-label="Rule status filter"
              searchable={false}
              options={[...RULE_STATUS_FILTERS]}
              value={status}
              onChange={(next) => {
                setStatus((next ?? "ALL") as RuleStatusFilter);
                setPage(1);
              }}
            />
          </div>

          <Button
            aria-label="Add New Rule"
            onClick={() => setWizard({ mode: "create", rule: null })}
          >
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add New Rule
          </Button>
        </div>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        <ResponsiveTableContainer label="Assignment rules">
          <Table
            columns={columns}
            rows={rows ?? []}
            getRowId={(row) => row.id}
            isLoading={rows === null}
            emptyState={
              <EmptyState
                className="py-16"
                icon={IconFileText}
                title="No data yet"
                description={
                  debouncedSearch || status !== "ALL"
                    ? "No rules match this search. Try a different name, or clear the status filter."
                    : "You haven't created any records yet. Start by adding your first entry."
                }
              />
            }
          />
        </ResponsiveTableContainer>
      </div>

      {rows !== null && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline p-4">
          <RowsPerPage
            value={size}
            options={RULE_PAGE_SIZES}
            onChange={(next) => {
              setSize(next);
              setPage(1);
            }}
            aria-label="Rows per page, Assignment rules"
          />
          {/* Page navigation joins the footer only once there is more than one page. */}
          {pageCount > 1 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <AssignmentRuleWizard
        state={wizard}
        onClose={() => setWizard(null)}
        onSaved={(name, mode) => {
          setWizard(null);
          toast({
            title: mode === "edit" ? `${name} updated` : `${name} created`,
            tone: "success",
          });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this assignment rule?"
        description={
          deleting
            ? `${deleting.name} will stop assigning leads and leave the rule list. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
