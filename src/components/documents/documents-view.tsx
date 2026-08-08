"use client";

import { IconFileText, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useDisclosure } from "@/hooks/use-disclosure";
import { DocumentFormDrawer } from "@/components/documents/document-form-drawer";

/**
 * The Documents screen (DOC-02.2 scope: the Add Document action + upload drawer).
 *
 * The document list, search and type filter are separate backlog tasks (DOC-03.1/06.1) and
 * are not built here, so the body shows the shared EmptyState (an Emarath convention for an
 * area the reference does not yet define). A successful upload confirms via toast; it cannot
 * appear in a list that does not exist yet (AC4 depends on the list task).
 */
export function DocumentsView() {
  const addDocument = useDisclosure();

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        actions={
          <Button size="sm" onClick={addDocument.open}>
            <IconPlus size={18} stroke={2} />
            Add Document
          </Button>
        }
      />

      <div className="min-h-64 rounded-surface border border-hairline bg-surface">
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
      </div>

      {addDocument.isOpen && (
        <DocumentFormDrawer
          open
          onClose={addDocument.close}
          onUploaded={() => {
            // No document list exists yet (DOC-03.1/06.1), so there is nothing to refetch;
            // the success toast confirms the upload. Closing resets the drawer for the next add.
            addDocument.close();
          }}
        />
      )}
    </PageContainer>
  );
}
