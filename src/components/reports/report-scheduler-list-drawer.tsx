"use client";

import { IconCircleX, IconFolder } from "@tabler/icons-react";
import { Drawer } from "@/components/ui/Drawer";

export type ReportSchedulerListDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** The panel width; `max-w-xl` unless a shell draws another. */
  width?: string;
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
  width = "max-w-xl",
}: ReportSchedulerListDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Report Scheduler List"
      width={width}
      // A hairline under the title, as under the Scheduler's (both Oct 2026 captures).
      header={
        <header className="border-b border-hairline p-5">
          <h2 className="text-lg font-medium text-ink">
            Report Scheduler List
          </h2>
        </header>
      }
    >
      {/* The capture's drawing — an open folder with a red ✕ badge — from the nearest Tabler
          glyphs, over its 16px title and the line under it. */}
      <div className="flex min-h-full flex-col items-center justify-center gap-2 pb-16 text-center">
        <span aria-hidden="true" className="relative mb-4 inline-flex">
          <IconFolder size={112} stroke={1.1} className="text-ink" />
          <IconCircleX
            size={48}
            stroke={1.5}
            className="absolute -right-2 -bottom-1 rounded-full bg-surface text-danger"
          />
        </span>
        <p className="text-base font-semibold text-ink">
          No scheduled reports yet.
        </p>
        <p className="text-sm text-ink-soft">
          Nothing to show. Add a scheduler to view the report scheduler list.
        </p>
      </div>
    </Drawer>
  );
}
