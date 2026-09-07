"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCategory2,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Popover } from "@/components/ui/Popover";
import { RowsPerPage } from "@/components/ui/RowsPerPage";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { cn } from "@/lib/cn";
import {
  CUSTOM_FIELD_PAGE_SIZES,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPE_OPTIONS,
  DEFAULT_CUSTOM_FIELD_PAGE_SIZE,
  deleteCustomField,
  fetchCustomFieldPage,
} from "@/services/data-schema-service";
import type {
  LeadCustomField,
  LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";
import {
  CustomFieldDrawer,
  type CustomFieldFormState,
} from "./custom-field-drawer";
import type { TableColumn } from "@/types";

/** Long enough that typing does not fire a request per keystroke, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

/** The reference prints three option chips and rolls the rest into a +N badge. */
const INLINE_OPTIONS = 3;

/**
 * Settings → Data & Schema Management → Custom Field.
 *
 * Search, the Field Type filter and paging all travel to the API: the reference's own
 * data has a field with 800 options, so filtering or slicing a fetched page in the
 * browser would silently hide matches sitting on page two.
 */
export function CustomFieldsView() {
  const { toast } = useToast();

  const [rows, setRows] = useState<LeadCustomField[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<LeadCustomFieldType | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_CUSTOM_FIELD_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<CustomFieldFormState | null>(null);
  const [deleting, setDeleting] = useState<LeadCustomField | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  // Typing debounces; the type filter applies at once. The state change happens in the
  // timer callback, never in the effect body, so a keystroke costs one render.
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

    fetchCustomFieldPage(
      { search: debouncedSearch, type, page, size },
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
  }, [debouncedSearch, type, page, size, reloadToken]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  const confirmDelete = async () => {
    const target = deleting;
    if (!target || busy) return;
    setBusy(true);
    try {
      await deleteCustomField(target.id);
      setDeleting(null);
      toast({ title: `${target.name} deleted`, tone: "success" });
      reload();
    } catch (error: unknown) {
      // The in-use refusal is the point of the guard, so it is shown rather than swallowed.
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

  const columns: TableColumn<LeadCustomField>[] = [
    {
      key: "name",
      header: "Field",
      render: (row) => (
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-ink">{row.name}</span>
          {row.options.length > 0 && <OptionChips options={row.options} />}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <span className="whitespace-nowrap text-ink">
          {CUSTOM_FIELD_TYPE_LABELS[row.type]}
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
      key: "actions",
      header: "Actions",
      className: "w-24",
      render: (row) => (
        <span className="flex items-center gap-1">
          <Tooltip content="Edit">
            <button
              type="button"
              aria-label={`Edit Custom Field ${row.name}`}
              onClick={() => setForm({ mode: "edit", field: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Custom Field ${row.name}`}
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
              : "Couldn't load Custom Fields"
          }
          description={
            failed === "forbidden"
              ? "Schema management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The custom fields could not be reached. Check your connection and try again."
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
          <h2 className="text-xl font-semibold text-ink">Custom Field</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Manage your custom field management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/*
            The reference draws Search collapsed to a label; no capture shows it open, so
            it expands into the app's own search box rather than a control invented for it.
          */}
          {searchOpen || search !== "" ? (
            <span className="w-56">
              <SearchInput
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                aria-label="Search custom fields"
                onBlur={() => {
                  if (search === "") setSearchOpen(false);
                }}
              />
            </span>
          ) : (
            <button
              type="button"
              aria-label="Search custom fields"
              onClick={() => setSearchOpen(true)}
              className="focus-ring flex h-control items-center gap-2 rounded-control px-2 text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
            >
              <IconSearch size={16} stroke={1.75} aria-hidden="true" />
              Search
            </button>
          )}

          <Popover
            portal
            align="end"
            trigger={
              <span
                className={cn(
                  "flex h-control items-center gap-2 rounded-control px-2 text-sm transition-colors duration-(--duration-shell) ease-shell",
                  type ? "text-brand-strong" : "text-ink-muted hover:text-ink",
                )}
              >
                <IconCategory2 size={16} stroke={1.75} aria-hidden="true" />
                {type ? CUSTOM_FIELD_TYPE_LABELS[type] : "Field Type"}
                <IconChevronDown size={16} stroke={2} aria-hidden="true" />
              </span>
            }
            triggerClassName="focus-ring rounded-control"
            className="w-52 p-1.5"
          >
            {(close) => (
              <ul role="listbox" aria-label="Field Type">
                {/*
                  The reference's list is the six types. "All Field Types" is added so an
                  applied filter can be cleared — no capture shows how Workpex clears it.
                */}
                <FilterOption
                  label="All Field Types"
                  selected={type === null}
                  onSelect={() => {
                    setType(null);
                    setPage(1);
                    close();
                  }}
                />
                {CUSTOM_FIELD_TYPE_OPTIONS.map((option) => (
                  <FilterOption
                    key={option.value}
                    label={option.label}
                    selected={type === option.value}
                    onSelect={() => {
                      setType(option.value);
                      setPage(1);
                      close();
                    }}
                  />
                ))}
              </ul>
            )}
          </Popover>

          <Button
            aria-label="Add Custom Field"
            onClick={() => setForm({ mode: "create" })}
          >
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add Custom Field
          </Button>
        </div>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {rows !== null && rows.length === 0 ? (
          <EmptyState
            title={
              debouncedSearch || type
                ? "No custom field matches those filters"
                : "No custom fields yet"
            }
            description={
              debouncedSearch || type
                ? "Clear the search or the Field Type filter to see every field."
                : "Add a custom field to capture information the standard lead form does not."
            }
          />
        ) : (
          /* One bordered panel holding the table and its rows-per-page row. */
          <div className="overflow-hidden rounded-control border border-hairline">
            <ResponsiveTableContainer label="Custom fields">
              <Table
                columns={columns}
                rows={rows ?? []}
                getRowId={(row) => row.id}
                isLoading={rows === null}
              />
            </ResponsiveTableContainer>

            {rows !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                <RowsPerPage
                  value={size}
                  options={CUSTOM_FIELD_PAGE_SIZES}
                  onChange={(next) => {
                    setSize(next);
                    setPage(1);
                  }}
                  aria-label="Rows per page, Custom fields"
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

      <CustomFieldDrawer
        state={form}
        onClose={() => setForm(null)}
        onSaved={(field, mode) => {
          setForm(null);
          toast({
            title: mode === "create" ? `${field.name} added` : `${field.name} saved`,
            tone: "success",
          });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        tone="danger"
        title="Delete custom field?"
        description={
          deleting
            ? `${deleting.name} will no longer be available on any form. A field that already holds lead values cannot be deleted — deactivate it instead.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}

function FilterOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "focus-ring-inset flex w-full items-center rounded-control px-3 py-2 text-left text-sm transition-colors duration-(--duration-shell) ease-shell",
          selected
            ? "bg-brand-subtle font-medium text-ink"
            : "text-ink hover:bg-canvas",
        )}
      >
        {label}
      </button>
    </li>
  );
}

/**
 * A dropdown field's options under its name: the first few as chips, the rest behind the
 * reference's dark `+N` badge.
 *
 * Rendering every option would put 800 chips in one table cell — the reference's own CITY
 * field has that many, which is exactly why it draws the badge.
 */
function OptionChips({
  options,
}: {
  options: { id: string; label: string }[];
}) {
  const shown = options.slice(0, INLINE_OPTIONS);
  const rest = options.slice(INLINE_OPTIONS);

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {shown.map((option) => (
        <span
          key={option.id}
          className="max-w-[min(16rem,45vw)] truncate rounded-full bg-canvas px-2.5 py-0.5 text-xs text-ink-muted"
        >
          {option.label}
        </span>
      ))}

      {rest.length > 0 && (
        <Popover
          portal
          align="start"
          trigger={
            <span className="flex size-6 items-center justify-center rounded-full bg-ink px-1 text-xs font-medium text-white">
              +{rest.length}
            </span>
          }
          triggerClassName="focus-ring rounded-full"
          className="max-h-64 w-64 overflow-auto p-2"
        >
          <span className="flex flex-wrap gap-1.5">
            {/* Bounded: a field can carry a thousand options, and a panel must stay a panel. */}
            {rest.slice(0, 200).map((option) => (
              <span
                key={option.id}
                className="max-w-full truncate rounded-full bg-canvas px-2.5 py-0.5 text-xs text-ink-muted"
              >
                {option.label}
              </span>
            ))}
            {rest.length > 200 && (
              <span className="px-1 py-0.5 text-xs text-ink-subtle">
                and {rest.length - 200} more
              </span>
            )}
          </span>
        </Popover>
      )}
    </span>
  );
}
