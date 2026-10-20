"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconEye, IconHistory } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { JourneyItem } from "@/components/leads/customer-journey";
import { PAGE_SIZE_OPTIONS } from "@/constants/table";
import { ApiError, isAbortError } from "@/lib/api-client";
import { humanize } from "@/lib/audit-journey";
import {
  NO_AUDIT_LOG_FILTERS,
  auditActorLabel,
  auditActorNames,
  auditLogRangeError,
  entityTypeLabel,
  isAuditLogFiltered,
  type AuditLogFilterOptions,
  type AuditLogFilters,
  type AuditLogRow,
} from "@/lib/audit-log";
import { formatDateTime } from "@/lib/format";
import {
  fetchAuditLog,
  fetchAuditLogFilterOptions,
} from "@/services/audit-log-service";

const ALL = "all";
const INITIAL_PAGE_SIZE = PAGE_SIZE_OPTIONS[1];

/**
 * Settings → Users & Access → Audit Log (AUD-02): every change the system recorded — users,
 * roles, permissions, settings, documents, the lead/Logistics/Accounts journey, exports and
 * emails — newest first, for the Super Admin during UAT and after.
 *
 * Read-only: no row can be edited or removed. Filtering and paging are server-side
 * (`GET /api/audit/log`), and the API decides both who may read it (Super Admin; anyone else gets
 * a 403, shown as such) and what is shown — credentials, storage paths, email addresses and
 * search text arrive already hidden. A new client screen, so it reuses the Team Members layout
 * and the Journey's own event rendering rather than a Workpex reference (CLAUDE.md §1A).
 */
export function AuditLogView() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [options, setOptions] = useState<AuditLogFilterOptions | null>(null);

  const [filters, setFilters] = useState<AuditLogFilters>(NO_AUDIT_LOG_FILTERS);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(INITIAL_PAGE_SIZE);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const rangeError = auditLogRangeError(filters);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // A narrower filter can have fewer pages than the current one, so it always starts at 1.
  const narrow = (patch: Partial<AuditLogFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAuditLogFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // The list reports the failure; the filters simply offer "All" until it is retried.
      });
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    // An inverted range would be refused; nothing is asked until it is fixed.
    if (rangeError) return;
    const controller = new AbortController();
    let active = true;

    fetchAuditLog(filters, page, size, controller.signal)
      .then((result) => {
        if (!active) return;
        setRows([...result.rows]);
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
  }, [filters, page, size, reloadToken, rangeError]);

  const typeOptions = useMemo(
    () => [
      { label: "All record types", value: ALL },
      ...(options?.entityTypes ?? []).map((type) => ({
        label: entityTypeLabel(type),
        value: type,
      })),
    ],
    [options],
  );
  const actorOptions = useMemo(
    () => [
      { label: "All users", value: ALL },
      ...(options?.actors ?? []).map((actor) => ({
        label: actor.name,
        value: actor.id,
      })),
    ],
    [options],
  );
  const actorNames = useMemo(() => auditActorNames(rows ?? []), [rows]);

  const isLoading = rows === null && !failed;
  const pageCount = Math.max(1, Math.ceil(total / size));

  const body = (() => {
    if (failed) {
      return (
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to the audit log"
              : "Couldn't load the audit log"
          }
          description={
            failed === "forbidden"
              ? "The audit log is limited to Super Admin accounts. Sign in as a Super Admin and try again."
              : "The audit log could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setRows(null);
            setFailed(false);
            reload();
          }}
        />
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col gap-3 p-4" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      );
    }

    if (rows && rows.length === 0) {
      const filtered = isAuditLogFiltered(filters);
      return (
        <EmptyState
          className="py-16"
          icon={IconHistory}
          title={filtered ? "No matching events" : "No events recorded yet"}
          description={
            filtered
              ? "No recorded change matches these filters. Widen the dates or clear a filter."
              : "Changes appear here as soon as anyone makes one."
          }
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(NO_AUDIT_LOG_FILTERS);
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <ResponsiveTableContainer label="Audit log">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-canvas text-left">
              <Th className="min-w-44">When</Th>
              <Th className="min-w-40">User</Th>
              <Th className="min-w-40">Action</Th>
              <Th className="min-w-56">Record</Th>
              <Th className="min-w-44">Source</Th>
              <Th className="w-16 text-right">
                <span className="sr-only">Details</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-hairline transition-colors duration-(--duration-shell) ease-shell last:border-b-0 hover:bg-canvas"
                onClick={() => setSelected(row)}
              >
                <Td className="text-ink">{formatDateTime(row.createdAt)}</Td>
                <Td className="text-ink">{auditActorLabel(row)}</Td>
                <Td className="font-medium text-ink">
                  {humanize(row.action) || row.action}
                </Td>
                <Td>
                  <span className="flex min-w-0 items-center gap-2">
                    <Tag>{entityTypeLabel(row.entityType)}</Tag>
                    <span className="truncate text-ink">
                      {row.entityLabel ?? "—"}
                    </span>
                  </span>
                </Td>
                <Td className="text-ink-muted">{row.source}</Td>
                <Td className="text-right">
                  <IconButton
                    size="lg"
                    aria-label={`View details of ${humanize(row.action)} on ${row.entityLabel ?? entityTypeLabel(row.entityType)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(row);
                    }}
                  >
                    <IconEye size={17} stroke={1.75} />
                  </IconButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableContainer>
    );
  })();

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Audit Log</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Every recorded change, newest first
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,13rem))_auto] xl:items-center">
          <Select
            aria-label="Filter by record type"
            options={typeOptions}
            value={filters.entityType ?? ALL}
            onChange={(event) =>
              narrow({
                entityType:
                  event.target.value === ALL ? null : event.target.value,
              })
            }
          />
          <Select
            aria-label="Filter by user"
            options={actorOptions}
            value={filters.actorId ?? ALL}
            onChange={(event) =>
              narrow({
                actorId: event.target.value === ALL ? null : event.target.value,
              })
            }
          />
          <DatePicker
            aria-label="From date"
            placeholder="From date"
            value={filters.from}
            onChange={(from) => narrow({ from })}
          />
          <DatePicker
            aria-label="To date"
            placeholder="To date"
            value={filters.to}
            onChange={(to) => narrow({ to })}
          />
          {isAuditLogFiltered(filters) && (
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(NO_AUDIT_LOG_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        {rangeError && (
          <p role="alert" className="text-sm text-danger">
            {rangeError}
          </p>
        )}
      </div>

      {/* The settings frame is bounded to the viewport, so a full page of events scrolls here,
          above the pager, instead of running underneath it. */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-hairline">
        {body}
      </div>

      {!failed && (
        <div className="border-t border-hairline p-4">
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            pageSize={size}
            onPageSizeChange={(next) => {
              setSize(next);
              setPage(1);
            }}
            total={total}
          />
        </div>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Event details"
      >
        {selected && (
          <ol className="flex flex-col gap-4">
            <JourneyItem event={selected} labels={{ users: actorNames }} />
          </ol>
        )}
      </Drawer>
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap text-ink-muted ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className ?? ""}`}>
      {children}
    </td>
  );
}
