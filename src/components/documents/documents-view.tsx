"use client";

import { IconFileText, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { DocumentFormDrawer } from "@/components/documents/document-form-drawer";
import {
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
 * and refetches the list on success so a new upload appears (DOC-02.2 AC4).
 */
const COLUMNS: TableColumn<DocumentListItem>[] = [
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
  const addDocument = useDisclosure();
  const { query, page, size, sort, setPage, setSize, setSort } = useListQuery({
    size: PAGE_SIZE,
  });
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchDocuments,
    query,
  );

  const pageCount = Math.max(1, Math.ceil(total / size));

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
        columns={COLUMNS}
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
    </TablePageLayout>
  );
}
