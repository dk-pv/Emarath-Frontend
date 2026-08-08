"use client";

import { useMemo, useState } from "react";
import {
  IconFileText,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { useAuth } from "@/components/auth/auth-context";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { ApiError } from "@/lib/api-client";
import { DocumentFormDrawer } from "@/components/documents/document-form-drawer";
import { DocumentEditDrawer } from "@/components/documents/document-edit-drawer";
import {
  deleteDocument,
  fetchDocuments,
  formatFileSize,
  type DocumentListItem,
} from "@/services/documents-service";
import type { TableColumn } from "@/types";

const PAGE_SIZE = 25;

/** "12-06-2026, 11:56:24 AM" — the Workpex timestamp format (matches the other lists). */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${dd}-${mm}-${date.getFullYear()}, ${time}`;
}

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
    render: (row) => formatDateTime(row.createdAt),
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
  const { query, page, size, sort, setPage, setSize, setSort } = useListQuery({
    size: PAGE_SIZE,
  });
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchDocuments,
    query,
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
              <button
                type="button"
                onClick={() => setEditingId(row.id)}
                aria-label={`Edit ${row.title}`}
                className="focus-ring inline-flex size-control-sm items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
              >
                <IconPencil size={16} stroke={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(row)}
                disabled={deletePendingId === row.id}
                aria-label={`Delete ${row.title}`}
                className="focus-ring inline-flex size-control-sm items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconTrash size={16} stroke={1.75} aria-hidden="true" />
              </button>
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
      description="Files shared across the team."
      actions={
        <Button size="sm" onClick={addDocument.open}>
          <IconPlus size={18} stroke={2} />
          Add Document
        </Button>
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
    </TablePageLayout>
  );
}
