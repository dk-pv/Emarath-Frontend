"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import type { RoleTreeNode } from "@/services/roles-service";

/** Live team members held by everything beneath a role — the badge counts, summed. */
function descendantAssigned(node: RoleTreeNode): number {
  return node.children.reduce(
    (total, child) => total + child.assignedCount + descendantAssigned(child),
    0,
  );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export interface RoleDeleteDialogProps {
  /** The role being removed; `null` keeps the dialog closed. */
  node: RoleTreeNode | null;
  /** A refusal from `DELETE /api/roles/:id`, shown above the warning. */
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Settings → Users & Access → Roles & Permissions: the Delete Role confirmation.
 *
 * The counts are the same `assignedCount` values the row badges show, summed over the
 * branch — so the sentence is the API's own data, and it says exactly which of the two
 * server-side blocks (assigned members, child roles) is in the way.
 *
 * When the delete cannot succeed, Okay only dismisses: firing a request we already know
 * the server will refuse would trade a clear explanation for a toast.
 */
export function RoleDeleteDialog({
  node,
  error,
  busy,
  onClose,
  onConfirm,
}: RoleDeleteDialogProps) {
  const direct = node?.assignedCount ?? 0;
  const below = node ? descendantAssigned(node) : 0;
  const children = node?.children.length ?? 0;
  const blocked = direct + below > 0 || children > 0;

  return (
    <Modal
      open={node !== null}
      onClose={busy ? () => {} : onClose}
      title="Delete Role"
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
            {direct + below > 0 ? (
              <>
                cannot be deleted.{" "}
                {direct > 0 ? (
                  <>
                    It has{" "}
                    <b className="font-semibold">{plural(direct, "user")}</b>{" "}
                    directly
                    {below > 0 && (
                      <>
                        {" "}
                        and its sub-roles have{" "}
                        <b className="font-semibold">{below} more</b> (
                        {direct + below} total)
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>
                    Its sub-roles have{" "}
                    <b className="font-semibold">{plural(below, "user")}</b>{" "}
                    assigned.
                  </>
                )}{" "}
                Please unassign all users before deleting.
              </>
            ) : children > 0 ? (
              <>
                cannot be deleted. It has{" "}
                <b className="font-semibold">{plural(children, "sub-role")}</b>{" "}
                beneath it. Please move or delete them first.
              </>
            ) : (
              <>will be permanently removed. This cannot be undone.</>
            )}
          </p>
        </Alert>
      </div>
    </Modal>
  );
}
