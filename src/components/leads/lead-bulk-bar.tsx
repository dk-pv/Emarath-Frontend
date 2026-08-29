"use client";

import {
  IconHistory,
  IconListCheck,
  IconTag,
  IconTrash,
  IconUserShare,
} from "@tabler/icons-react";
import { BulkActionBar, type BulkAction } from "@/components/ui/BulkActionBar";

type LeadBulkBarProps = {
  count: number;
  onClear: () => void;
  /** Opens the reassign flow (Workpex "Assignee"). LEAD-09.2. */
  onReassign: () => void;
  /** Opens the delete confirmation (Workpex "Delete"). LEAD-09.2. */
  onDelete: () => void;
  /** True while a bulk action runs; the wired actions disable to prevent re-entry. */
  busy?: boolean;
  /** Managers/admins only see reassignment (AUTH-02.2); false hides the Assignee action. */
  canReassign: boolean;
};

/**
 * The bulk action bar shown while leads are selected (LEAD-09.2), traced from
 * `leads-list-all-rows-selected-bulk-action-bar.png`: a count block
 * ("100 / Lead Selected"), a divider, then Update, Delete, Assignee, Status and
 * Tags, over the shared `BulkActionBar` shell.
 *
 * Delete and Assignee are wired (LEAD-09.1 API). Update, Status and Tags are shown
 * because Workpex shows them, but they are out of LEAD-09.2's scope (export/reassign/
 * delete) and have no API yet, so they stay inert. Assignee is additionally role-gated:
 * only managers and admins see reassignment (AUTH-02.2). There is deliberately no Export
 * here — the Workpex bar has none (ADR-0011).
 */
export function LeadBulkBar({
  count,
  onClear,
  onReassign,
  onDelete,
  busy = false,
  canReassign,
}: LeadBulkBarProps) {
  const actions: BulkAction[] = [
    { key: "update", label: "Update", Icon: IconHistory, onClick: undefined },
    { key: "delete", label: "Delete", Icon: IconTrash, onClick: onDelete },
    {
      key: "assignee",
      label: "Assignee",
      Icon: IconUserShare,
      onClick: onReassign,
    },
    { key: "status", label: "Status", Icon: IconListCheck, onClick: undefined },
    { key: "tags", label: "Tags", Icon: IconTag, onClick: undefined },
  ].filter((action) => action.key !== "assignee" || canReassign);

  return (
    <BulkActionBar
      count={count}
      label="Lead Selected"
      actions={actions}
      onClear={onClear}
      busy={busy}
    />
  );
}
