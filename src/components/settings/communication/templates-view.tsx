"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCircleX,
  IconPencil,
  IconPlus,
  IconTemplate,
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
import {
  DEFAULT_TEMPLATE_PAGE_SIZE,
  TEMPLATE_FILTERS,
  TEMPLATE_PAGE_SIZES,
  deleteMessageTemplate,
  fetchMessageTemplates,
  type MessageTemplate,
  type TemplateFilter,
} from "@/services/message-templates-service";
import {
  TemplateFormModal,
  type TemplateFormState,
} from "./template-form-modal";
import type { TableColumn } from "@/types";

/** Long enough that typing does not fire a request per keystroke, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

const TYPE_LABELS: Record<MessageTemplate["type"], string> = {
  EMAIL: "Email",
  WHATSAPP: "Whatsapp",
};

/**
 * Settings → Communication → Templates.
 *
 * Search, the type filter and paging all travel to the API — the list is a real
 * collection, so filtering a fetched page in the browser would silently hide matches
 * sitting on page two. Every mutation refetches the current page, so the total, the
 * ordering and the row itself are always the server's answer rather than a local guess.
 */
export function TemplatesView() {
  const { toast } = useToast();

  const [rows, setRows] = useState<MessageTemplate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_TEMPLATE_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<TemplateFormState | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /*
    Typing debounces; every other control applies at once. The state change happens in the
    timer callback, never in the effect body, so a keystroke costs one render and one
    request rather than a cascade. A narrower result can leave the current page past the
    end of the list, so each of these resets it.
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

    fetchMessageTemplates(
      { search: debouncedSearch, filter, page, size },
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
  }, [debouncedSearch, filter, page, size, reloadToken]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteMessageTemplate(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      // Stepping back off a page that just emptied keeps the list from showing nothing.
      if (rows?.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (error: unknown) {
      toast({
        title:
          error instanceof ApiError
            ? (error.messages[0] ?? error.message)
            : "Could not delete this template.",
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<MessageTemplate>[] = [
    {
      key: "name",
      header: "Template Name",
      render: (row) => <span className="truncate text-ink">{row.name}</span>,
    },
    {
      key: "type",
      header: "Template Type",
      render: (row) => (
        <span className="text-ink">{TYPE_LABELS[row.type]}</span>
      ),
    },
    {
      key: "attachments",
      // The reference's own spelling, and its own placeholder in every captured row:
      // templates carry no attachments yet (ADR-0068).
      header: "Attachements",
      render: () => <span className="text-ink-subtle">– –</span>,
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
          <span className="flex items-center gap-1.5 text-danger">
            <IconCircleX
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
            Verification Pending
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
              aria-label={`Edit Template ${row.name}`}
              onClick={() => setForm({ mode: "edit", template: row })}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete Template ${row.name}`}
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
              ? "You don't have access to templates"
              : "Couldn't load templates"
          }
          description={
            failed === "forbidden"
              ? "Template management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The template list could not be reached. Check your connection and try again."
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
      {/*
        The title block and the three controls sit side by side only from 1280 up. At 1024
        the row still "fits" by the page's reckoning — nothing overflows the document —
        but the card clips its own right edge, which put the Add Template button out of
        reach. Measured, not guessed: its right edge landed at 1087 in a 1024 viewport.
      */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Templates</h2>
          {/* Reference wording, kept verbatim (CLAUDE.md §16). */}
          <p className="mt-0.5 text-sm text-ink-muted">
            Configure your Company&apos;s Basic Settings and Regional Preferences
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            aria-label="Search templates"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            /*
              The reference draws the search borderless at rest — a magnifier and the
              word "Search", no box — so the border only appears on focus, where it is
              the focus affordance rather than decoration.
            */
            className="border-transparent bg-transparent focus:border-brand sm:w-40"
          />

          <div className="sm:w-36">
            <SearchableSelect
              portal
              id="template-filter"
              aria-label="Template type filter"
              searchable={false}
              options={[...TEMPLATE_FILTERS]}
              value={filter}
              onChange={(next) => {
                setFilter((next ?? "ALL") as TemplateFilter);
                setPage(1);
              }}
            />
          </div>

          <Button
            aria-label="Add Template"
            onClick={() => setForm({ mode: "create", template: null })}
          >
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add Template
          </Button>
        </div>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        <ResponsiveTableContainer label="Templates">
          <Table
            columns={columns}
            rows={rows ?? []}
            getRowId={(row) => row.id}
            isLoading={rows === null}
            emptyState={
              <EmptyState
                className="py-16"
                icon={IconTemplate}
                title={
                  debouncedSearch || filter !== "ALL"
                    ? "No templates match this search"
                    : "No templates yet"
                }
                description={
                  debouncedSearch || filter !== "ALL"
                    ? "Try a different name, or clear the type filter."
                    : "Create your first template to reuse a message across leads."
                }
              />
            }
          />
        </ResponsiveTableContainer>
      </div>

      {/*
        The reference's footer is the "Rows per page 05" control alone. Page navigation
        joins it only once there is more than one page — without it every row past the
        first page would be unreachable.
      */}
      {rows !== null && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline p-4">
          <RowsPerPage
            value={size}
            options={TEMPLATE_PAGE_SIZES}
            onChange={(next) => {
              setSize(next);
              setPage(1);
            }}
            aria-label="Rows per page, Templates"
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

      <TemplateFormModal
        state={form}
        onClose={() => setForm(null)}
        onSaved={(name, mode) => {
          setForm(null);
          toast({
            title: mode === "edit" ? `${name} updated` : `${name} created`,
            tone: "success",
          });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this template?"
        description={
          deleting
            ? `${deleting.name} will be removed from the template list. This cannot be undone.`
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
