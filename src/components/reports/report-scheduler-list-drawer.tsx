"use client";

import { IconFolderX } from "@tabler/icons-react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";

export type ReportSchedulerListDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * The Report Scheduler List, matched to the supplied reference: the saved schedules for
 * this report, over the empty state when there are none.
 *
 * There are none, and there is no store for them — Emarath has no scheduling backend, so
 * nothing can have been saved. The reference's own screen is that empty state, so this is
 * the complete screen rather than a placeholder standing in for a table; the moment a
 * scheduler API exists this grows a list above the same empty state.
 */
export function ReportSchedulerListDrawer({
  open,
  onClose,
}: ReportSchedulerListDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Report Scheduler List"
      width="max-w-xl"
    >
      <div className="flex min-h-96 items-center justify-center">
        <EmptyState
          icon={IconFolderX}
          title="No scheduled reports yet."
          description="Nothing to show. Add a scheduler to view the report scheduler list."
        />
      </div>
    </Drawer>
  );
}
