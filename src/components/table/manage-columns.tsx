"use client";

import { useCallback, useMemo, useState } from "react";
import { IconColumns3, IconGripVertical } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";
import { moveKey, orderColumns } from "@/lib/columns";
import type { ColumnPrefs, TableColumn } from "@/types";

export type ManageColumnsProps<TRow> = {
  /** Every column the module declares, hidden ones included. */
  columns: readonly TableColumn<TRow>[];
  prefs: ColumnPrefs;
  onChange: (prefs: ColumnPrefs) => void;
};

const ROW_CLASS =
  "flex items-center gap-3 rounded-control px-3 py-3 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";

const HANDLE_CLASS =
  "inline-flex cursor-grab items-center justify-center rounded-control text-ink-subtle transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted focus-ring active:cursor-grabbing";

/**
 * Show, hide and reorder a table's columns (FND-03.1 AC4) — Workpex's Manage Columns
 * drawer, `leads-manage-columns-drawer-open.png`.
 *
 * Edits land in a draft so Cancel is a real escape hatch; only Submit writes back. The
 * draft is seeded when the drawer opens rather than held in sync, which keeps a discarded
 * edit from leaking into the next visit.
 */
export function ManageColumns<TRow>({
  columns,
  prefs,
  onChange,
}: ManageColumnsProps<TRow>) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [dragKey, setDragKey] = useState<string | null>(null);

  const labels = useMemo(
    () => new Map(columns.map((column) => [column.key, column.header])),
    [columns],
  );

  const openDrawer = useCallback(() => {
    setOrder(orderColumns(columns, prefs.order).map((column) => column.key));
    setHidden(new Set(prefs.hidden));
    setOpen(true);
  }, [columns, prefs]);

  const toggle = useCallback((key: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const reorder = useCallback((from: string, to: string) => {
    setOrder((current) => moveKey(current, from, to));
  }, []);

  const nudge = useCallback((key: string, offset: number) => {
    setOrder((current) => {
      const target = current[current.indexOf(key) + offset];
      return target ? moveKey(current, key, target) : current;
    });
  }, []);

  const submit = useCallback(() => {
    // Rebuilding `hidden` from `order` drops keys for columns that no longer exist.
    onChange({ order, hidden: order.filter((key) => hidden.has(key)) });
    setOpen(false);
  }, [onChange, order, hidden]);

  return (
    <>
      <Button variant="ghost" size="md" onClick={openDrawer}>
        <IconColumns3 size={18} stroke={1.75} />
        Manage Columns
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Manage Columns"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Submit</Button>
          </>
        }
      >
        <ul className="flex flex-col">
          {order.map((key, index) => (
            <li
              key={key}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                setDragKey(key);
              }}
              // Reordering as the pointer crosses a row means the list itself is the
              // preview — there is no separate drop indicator to keep in step.
              onDragEnter={() =>
                dragKey && dragKey !== key && reorder(dragKey, key)
              }
              onDragOver={(event) => event.preventDefault()}
              onDragEnd={() => setDragKey(null)}
              className={cn(ROW_CLASS, dragKey === key && "opacity-50")}
            >
              <button
                type="button"
                aria-label={`Reorder ${labels.get(key) ?? key}, position ${index + 1} of ${order.length}`}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                    return;
                  event.preventDefault();
                  nudge(key, event.key === "ArrowUp" ? -1 : 1);
                }}
                className={HANDLE_CLASS}
              >
                <IconGripVertical aria-hidden="true" size={18} stroke={1.75} />
              </button>

              <label className="flex flex-1 items-center gap-3">
                <Checkbox
                  checked={!hidden.has(key)}
                  onChange={() => toggle(key)}
                />
                <span className="text-ink">{labels.get(key) ?? key}</span>
              </label>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}
