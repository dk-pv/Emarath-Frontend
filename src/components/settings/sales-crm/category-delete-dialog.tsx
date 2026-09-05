"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import type { CategoryTreeNode } from "@/services/categories-service";

/** Live leads carried by everything beneath a category — the row counts, summed. */
function descendantLeads(node: CategoryTreeNode): number {
  return node.children.reduce(
    (total, child) => total + child.leadCount + descendantLeads(child),
    0,
  );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const subCategories = (count: number) =>
  `${count} sub-categor${count === 1 ? "y" : "ies"}`;

export interface CategoryDeleteDialogProps {
  node: CategoryTreeNode | null;
  /** A refusal from `DELETE /api/categories/:id`, shown above the warning. */
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Delete Category confirmation, in the same shape as the Roles one.
 *
 * The counts are the API's own `leadCount`, summed over the branch, so the sentence states
 * exactly which of the two server-side blocks is in the way — leads still filed under the
 * category, or sub-categories beneath it.
 *
 * When the delete cannot succeed, Okay only dismisses: firing a request the server is known
 * to refuse would trade a clear explanation for a toast. Nothing here cascades — deleting
 * business data or silently clearing every lead's category is never the safe default.
 */
export function CategoryDeleteDialog({
  node,
  error,
  busy,
  onClose,
  onConfirm,
}: CategoryDeleteDialogProps) {
  const direct = node?.leadCount ?? 0;
  const below = node ? descendantLeads(node) : 0;
  const children = node?.children.length ?? 0;
  const blocked = children > 0 || direct > 0;

  return (
    <Modal
      open={node !== null}
      onClose={busy ? () => {} : onClose}
      title="Delete Category"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            onClick={blocked ? onClose : onConfirm}
            isLoading={busy}
            aria-label={blocked ? "Okay, close" : `Delete ${node?.name ?? ""}`}
          >
            Okay
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}

        {/* The reference tints the whole callout, not just its icon. */}
        <Alert tone="warning" className="items-center [&_p]:text-warning">
          <p>
            <b className="font-semibold">{node?.name}</b>{" "}
            {children > 0 ? (
              <>
                cannot be deleted. It has{" "}
                <b className="font-semibold">{subCategories(children)}</b>{" "}
                beneath it
                {below > 0 && (
                  <>
                    {" "}
                    holding <b className="font-semibold">
                      {plural(below, "lead")}
                    </b>
                  </>
                )}
                . Move or delete them first.
              </>
            ) : direct > 0 ? (
              <>
                cannot be deleted. It is used by{" "}
                <b className="font-semibold">{plural(direct, "lead")}</b>.
                Recategorise them before deleting it.
              </>
            ) : (
              <>will be permanently deleted. This cannot be undone.</>
            )}
          </p>
        </Alert>
      </div>
    </Modal>
  );
}
