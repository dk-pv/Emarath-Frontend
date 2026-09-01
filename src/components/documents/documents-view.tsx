"use client";

import { useCallback, useMemo, useState } from "react";
import {
  IconFileText,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { useAuth } from "@/components/auth/auth-context";
import { SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";
import { DocumentFormDrawer } from "@/components/documents/document-form-drawer";
import { DocumentEditDrawer } from "@/components/documents/document-edit-drawer";
import { DocumentTypeFilter } from "@/components/documents/document-type-filter";
import { DocumentSearch } from "@/components/documents/document-search";
import { DocumentBulkBar } from "@/components/documents/document-bulk-bar";
import {
  bulkDeleteDocuments,
  deleteDocument,
  fetchDocuments,
  formatFileSize,
  type BulkActionResponse,
  type DocumentListItem,
  type DocumentUserRef,
  type DocumentTypeValue,
} from "@/services/documents-service";
import type { TableColumn } from "@/types";

const PAGE_SIZE = 25;

/** The short "Type" label the reference shows ("png") — the file's own extension. */
function typeLabel(row: DocumentListItem): string {
  const dot = row.fileName.lastIndexOf(".");
  if (dot > 0) return row.fileName.slice(dot + 1).toLowerCase();
  return row.contentType;
}

/**
 * The Documents list (DOC-03.1), built from `documents-list-default-single-row.png`: the six
 * columns the reference shows — File Name, Attachment, Size, Type, Uploaded By, Date and Time —
 * over the shared server-driven Table (paging + sorting travel to the API; the browser never
 * holds the whole set). Search, the type filter, Access and row Actions are their own later
 * tasks. The Attachment is a signed download link (AC2); the Add Document drawer is preserved
 * and refetches the list on success so a new upload appears (DOC-02.2 AC4). DOC-04.1 appends
 * an Actions column with the Edit affordance.
 */
/**
 * The "Access" cell: the reference shows one small circular grey marker per row,
 * not a list of names. Who it covers is named in the tooltip, so the column stays
 * the same width whether a document is private or shared with a whole team.
 */
function AccessCell({ access }: { access: DocumentUserRef[] }) {
  const label =
    access.length === 0
      ? "Owner only"
      : `Shared with ${access.map((user) => user.name).join(", ")}`;
  return (
    <Tooltip content={label} portal>
      <span
        tabIndex={0}
        role="img"
        aria-label={label}
        className="focus-ring inline-flex size-7 items-center justify-center rounded-full bg-canvas text-ink-muted"
      >
        <IconUser size={16} stroke={1.75} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

const DATA_COLUMNS: TableColumn<DocumentListItem>[] = [
  {
    key: "title",
    header: "File Name",
    sortable: true,
    render: (row) => <span className="font-medium text-ink">{row.title}</span>,
  },
  {
    key: "fileName",
    header: "Attachment",
    sortable: true,
    render: (row) => (
      <a
        href={row.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-strong hover:underline focus-ring"
        aria-label={`Open ${row.fileName}`}
      >
        {row.fileName}
      </a>
    ),
  },
  {
    key: "sizeBytes",
    header: "Size",
    align: "right",
    sortable: true,
    render: (row) => formatFileSize(row.sizeBytes),
  },
  {
    key: "contentType",
    header: "Type",
    sortable: true,
    render: (row) => typeLabel(row),
  },
  {
    key: "uploadedBy",
    header: "Uploaded By",
    sortable: true,
    render: (row) => row.uploadedBy.name,
  },
  {
    key: "createdAt",
    header: "Date and Time",
    sortable: true,
    // The reference stacks the date over the time rather than running them
    // together on one line. Same stored instant, two lines.
    render: (row) => (
      <span className="flex flex-col">
        <span className="text-ink">{formatDate(row.createdAt)}</span>
        <span className="text-xs text-ink-muted">
          {formatTime(row.createdAt, { seconds: true })}
        </span>
      </span>
    ),
  },
  {
    key: "access",
    header: "Access",
    align: "center",
    // Who the document is shared with (DOC-01.1 AC3). The reference shows one
    // small circular marker, not a list — the names live in its tooltip.
    render: (row) => <AccessCell access={row.access} />,
  },
];

export function DocumentsView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const addDocument = useDisclosure();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(
    null,
  );
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentTypeValue | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  // The reference gives search the whole toolbar: while it is open (or holds a term) the
  // input takes over and All Documents + Add Document are hidden.
  const searchExpanded = searchOpen || search.length > 0;
  const { query, page, size, sort, setPage, setSize, setSort, resetPage } =
    useListQuery({ size: PAGE_SIZE });

  // Inject the active type filter (DOC-06.1) and name search (DOC-07.1) into the fetch. A
  // new source identity when either changes drives useListData to refetch; both narrow
  // within the caller's scope server-side, so neither can surface a document they otherwise
  // can't see, and they combine on the server.
  const source = useCallback<ListDataSource<DocumentListItem>>(
    (listQuery, signal) =>
      fetchDocuments(
        listQuery,
        { type: docType ?? undefined, search: debouncedSearch || undefined },
        signal,
      ),
    [docType, debouncedSearch],
  );
  const { rows, total, isLoading, isError, refetch } = useListData(
    source,
    query,
  );

  // Bulk selection (DOC-08.1). Ids accumulate across pages (the shared Table's select-all is
  // page-local), matching Workpex's persistent "N Documents Selected" bar. The checkbox is a
  // UX affordance; the server independently enforces which ids the caller may delete.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const confirmBulkDelete = useDisclosure();

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (ids: string[]) =>
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // Reports the per-item result via toast, then clears the selection (AC5) and refetches so the
  // list reflects the deletion. The backend only fails an id it may not delete, so a partial
  // result is surfaced honestly rather than claimed as a clean success.
  const reportBulk = (result: BulkActionResponse) => {
    const { success, failed } = result.summary;
    if (failed === 0) {
      toast({
        title: `${success} document${success === 1 ? "" : "s"} deleted`,
        tone: "success",
      });
    } else if (success === 0) {
      toast({
        title: "Couldn’t delete the selected documents",
        description: "They were outside your permission and left unchanged.",
        tone: "danger",
      });
    } else {
      toast({
        title: `${success} deleted, ${failed} skipped`,
        description: "Some documents were outside your permission.",
        tone: "warning",
      });
    }
    setSelectedIds(new Set());
    refetch();
  };

  const handleBulkDelete = async () => {
    confirmBulkDelete.close();
    setBulkBusy(true);
    try {
      const result = await bulkDeleteDocuments([...selectedIds]);
      reportBulk(result);
    } catch {
      toast({ title: "Couldn’t delete documents", tone: "danger" });
    } finally {
      setBulkBusy(false);
    }
  };

  // Selecting a type returns to page 1 (a filtered result is shorter than the current page).
  const onTypeChange = useCallback(
    (next: DocumentTypeValue | null) => {
      setDocType(next);
      resetPage();
    },
    [resetPage],
  );

  // A new search term starts at page 1 (the same event-handler reset Leads uses — never in
  // an effect). The live value drives the input; the debounced value drives the fetch.
  const onSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      resetPage();
    },
    [resetPage],
  );

  const pageCount = Math.max(1, Math.ceil(total / size));

  // Runs the hard delete once confirmed (DOC-05.1). The dialog is closed first so the
  // confirm button can't fire twice, and the row is marked pending to block a repeat click
  // during the request; on success the list refetches so the row disappears (AC4). The server
  // is the real gate — a 403 here is surfaced, never assumed away.
  async function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setDeletePendingId(target.id);
    try {
      await deleteDocument(target.id);
      toast({ title: `“${target.title}” deleted`, tone: "success" });
      refetch();
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 403
          ? "You do not have permission to delete this document."
          : "Couldn’t delete the document. Please try again.";
      toast({ title: message, tone: "danger" });
    } finally {
      setDeletePendingId(null);
    }
  }

  // Edit and Delete show only for a document the caller may manage — its uploader, or a
  // SUPERADMIN. The server re-checks both on PATCH/DELETE, so hiding the buttons is a UX
  // nicety, never the authorization boundary.
  const columns = useMemo<TableColumn<DocumentListItem>[]>(
    () => [
      ...DATA_COLUMNS,
      {
        key: "actions",
        header: "Actions",
        align: "right",
        render: (row) => {
          const canManage =
            !!user &&
            (row.uploadedBy.id === user.id || user.role === "SUPERADMIN");
          if (!canManage) return null;
          return (
            <div className="inline-flex items-center gap-1">
              <IconButton
                size="lg"
                variant="outline"
                onClick={() => setEditingId(row.id)}
                aria-label={`Edit ${row.title}`}
              >
                <IconPencil size={16} stroke={1.75} aria-hidden="true" />
              </IconButton>
              <IconButton
                size="lg"
                variant="outline"
                tone="danger"
                onClick={() => setDeleteTarget(row)}
                disabled={deletePendingId === row.id}
                aria-label={`Delete ${row.title}`}
              >
                <IconTrash size={16} stroke={1.75} aria-hidden="true" />
              </IconButton>
            </div>
          );
        },
      },
    ],
    [user, deletePendingId],
  );

  return (
    <TablePageLayout
      title="Documents"
      actions={
        <div className="flex items-center gap-2">
          <DocumentSearch
            expanded={searchExpanded}
            value={search}
            onChange={onSearchChange}
            onExpand={() => setSearchOpen(true)}
            onCollapse={() => setSearchOpen(false)}
          />
          {!searchExpanded && (
            <>
              <DocumentTypeFilter
                active={docType}
                onChange={onTypeChange}
                onSortByLastModified={() => {
                  setSort({ key: "createdAt", direction: "desc" });
                  resetPage();
                }}
              />
              <Button size="sm" onClick={addDocument.open}>
                <IconPlus size={18} stroke={2} />
                Add Document
              </Button>
            </>
          )}
        </div>
      }
      pagination={{
        page,
        pageCount,
        total,
        onPageChange: setPage,
        pageSize: size,
        onPageSizeChange: setSize,
      }}
      tableLabel="Documents table"
    >
      <Table
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        selection={{
          selectedIds,
          onToggleRow: toggleRow,
          onToggleAll: toggleAll,
          rowLabel: (row) => `Select ${row.title}`,
          allLabel: "Select all documents on this page",
        }}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={IconFileText}
            title="No documents yet"
            description="Add a document to share it with your team."
            action={
              <Button size="sm" variant="secondary" onClick={addDocument.open}>
                <IconPlus size={18} stroke={2} />
                Add Document
              </Button>
            }
          />
        }
        errorState={
          isError ? (
            <ErrorState
              title="Couldn’t load documents"
              description="The list didn’t load. Check your connection and try again."
              onRetry={refetch}
            />
          ) : undefined
        }
      />

      {addDocument.isOpen && (
        <DocumentFormDrawer
          open
          onClose={addDocument.close}
          onUploaded={() => {
            addDocument.close();
            // Reload so the newly uploaded document appears (DOC-02.2 AC4).
            refetch();
          }}
        />
      )}

      {editingId && (
        <DocumentEditDrawer
          documentId={editingId}
          open
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            // Reflect the new name/access in the list immediately (DOC-04.1 AC4).
            refetch();
          }}
        />
      )}

      {/* Row "Delete" (DOC-05.1) — names the document and warns it's permanent. */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete document"
        description={
          deleteTarget
            ? `Permanently delete “${deleteTarget.title}” and its file? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
      />

      {/* Bulk action bar + confirm (DOC-08.1). The bar floats while any row is selected. */}
      {selectedIds.size > 0 && (
        <DocumentBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onDelete={confirmBulkDelete.open}
          busy={bulkBusy}
        />
      )}

      <ConfirmDialog
        open={confirmBulkDelete.isOpen}
        onCancel={confirmBulkDelete.close}
        onConfirm={() => void handleBulkDelete()}
        title="Delete documents"
        description={`Permanently delete ${selectedIds.size} selected document${
          selectedIds.size === 1 ? "" : "s"
        } and their files? This can't be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </TablePageLayout>
  );
}
