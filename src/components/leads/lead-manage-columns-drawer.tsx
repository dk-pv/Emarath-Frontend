"use client";

import { useMemo, useState } from "react";
import { IconGripVertical } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";

export type ManageableColumn = { key: string; label: string };

type LeadManageColumnsDrawerProps = {
  open: boolean;
  columns: readonly ManageableColumn[];
  order: readonly string[];
  hidden: readonly string[];
  onClose: () => void;
  onApply: (order: string[], hidden: string[]) => void;
};

/**
 * The Manage Columns drawer (LEAD-05.1), from `leads-manage-columns-drawer-open.png`:
 * a right drawer listing the data columns, each with a drag handle and a green
 * checkbox, over a Cancel / Submit footer. Reorder by dragging; toggle to show or
 * hide. Edits are held as a draft so Cancel discards and only Submit applies —
 * Customer Name and the row actions are the fixed identifier/action columns and are
 * not listed, matching Workpex.
 */
export function LeadManageColumnsDrawer({
  open,
  columns,
  order,
  hidden,
  onClose,
  onApply,
}: LeadManageColumnsDrawerProps) {
  const labelOf = useMemo(
    () => new Map(columns.map((column) => [column.key, column.label])),
    [columns],
  );

  const [draftOrder, setDraftOrder] = useState<string[]>([...order]);
  const [draftHidden, setDraftHidden] = useState<Set<string>>(
    () => new Set(hidden),
  );
  const [dragKey, setDragKey] = useState<string | null>(null);

  const toggle = (key: string) =>
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reorderOver = (overKey: string) => {
    if (!dragKey || dragKey === overKey) return;
    setDraftOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragKey);
      const to = next.indexOf(overKey);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragKey);
      return next;
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Manage Columns"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(draftOrder, [...draftHidden]);
              onClose();
            }}
          >
            Submit
          </Button>
        </>
      }
    >
      <ul className="flex flex-col">
        {draftOrder.map((key) => (
          <li
            key={key}
            draggable
            onDragStart={() => setDragKey(key)}
            onDragEnd={() => setDragKey(null)}
            onDragOver={(event) => {
              event.preventDefault();
              reorderOver(key);
            }}
            className={cn(
              "flex items-center gap-3 rounded-control px-1 py-2.5 transition-colors duration-(--duration-shell) ease-shell",
              dragKey === key ? "bg-canvas" : "hover:bg-canvas",
            )}
          >
            <IconGripVertical
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 cursor-grab text-ink-subtle"
            />
            <Checkbox
              checked={!draftHidden.has(key)}
              onChange={() => toggle(key)}
              aria-label={labelOf.get(key) ?? key}
            />
            <span className="text-sm text-ink">{labelOf.get(key) ?? key}</span>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
