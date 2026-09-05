"use client";

import {
  IconArrowsMove,
  IconChevronUp,
  IconGripVertical,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import type { CategoryTreeNode } from "@/services/categories-service";

/** The project's row-info format: "04/02/2026, 06:31:45 pm". */
function formatCreated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = date.getHours();
  const suffix = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ` +
    `${pad(twelve)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${suffix}`
  );
}

export interface CategoryRowProps {
  node: CategoryTreeNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onAddChild: (parent: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onMove: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onDragStart: (node: CategoryTreeNode) => void;
  onDropOn: (target: CategoryTreeNode, mode: "into" | "before") => void;
  dragging: boolean;
  isDropTarget: boolean;
  onDragOverRow: (id: string | null) => void;
}

/**
 * One row of the Category catalogue, matching the Workpex reference: a white pill carrying
 * a drag handle, the name, the inline "+ Add Category", the status badge, and the four
 * right-hand actions (move, edit, delete, info).
 *
 * Unlike the role tree, the rows carry no level tint — the reference draws every category
 * on the same white surface, whatever its depth — and the badge shows status rather than a
 * count. The collapse control appears only where there is a subtree to hide.
 */
export function CategoryRow({
  node,
  collapsed,
  onToggle,
  onAddChild,
  onEdit,
  onMove,
  onDelete,
  onDragStart,
  onDropOn,
  dragging,
  isDropTarget,
  onDragOverRow,
}: CategoryRowProps) {
  return (
    <div className="relative flex items-center gap-2">
      {/* Collapse control, drawn only when there is a subtree to hide. */}
      <div className="flex size-7 shrink-0 items-center justify-center">
        {node.children.length > 0 && (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.name}`}
            onClick={() => onToggle(node.id)}
            className={cn(
              "focus-ring flex size-6 items-center justify-center rounded-full border transition-colors duration-(--duration-shell) ease-shell",
              collapsed
                ? "border-green-500 bg-green-500 text-white hover:bg-green-600"
                : "border-green-400 bg-surface text-green-600 hover:bg-green-50",
            )}
          >
            <IconChevronUp
              size={14}
              stroke={2.5}
              aria-hidden="true"
              className={cn(
                "transition-transform duration-(--duration-shell) ease-shell",
                collapsed && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          // Firefox needs data set for a drag to start at all.
          event.dataTransfer.setData("text/plain", node.id);
          onDragStart(node);
        }}
        onDragEnd={() => onDragOverRow(null)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDragOverRow(node.id);
        }}
        onDragLeave={() => onDragOverRow(null)}
        onDrop={(event) => {
          event.preventDefault();
          // Dropping on the left third reorders before the row; anywhere else nests into it.
          const box = event.currentTarget.getBoundingClientRect();
          const mode =
            event.clientX - box.left < box.width / 3 ? "before" : "into";
          onDropOn(node, mode);
          onDragOverRow(null);
        }}
        className={cn(
          "flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2 transition-shadow duration-(--duration-shell) ease-shell",
          dragging && "opacity-50",
          isDropTarget && "ring-2 ring-brand ring-offset-1",
        )}
      >
        <IconGripVertical
          size={16}
          stroke={2}
          aria-hidden="true"
          className="shrink-0 cursor-grab text-ink-muted"
        />

        <span className="min-w-0 truncate text-sm font-medium text-ink">
          {node.name}
        </span>

        <button
          type="button"
          onClick={() => onAddChild(node)}
          aria-label={`Add a category under ${node.name}`}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors duration-(--duration-shell) ease-shell hover:bg-blue-200"
        >
          <IconPlus size={12} stroke={2.5} aria-hidden="true" />
          Add Category
        </button>

        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium",
            node.isActive
              ? "bg-green-100 text-green-700"
              : "bg-canvas text-ink-muted",
          )}
        >
          {node.isActive ? "Active" : "Inactive"}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip content="Move">
            <button
              type="button"
              aria-label={`Move ${node.name}`}
              onClick={() => onMove(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconArrowsMove size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Edit">
            <button
              type="button"
              aria-label={`Edit ${node.name}`}
              onClick={() => onEdit(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete ${node.name}`}
              onClick={() => onDelete(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
            >
              <IconTrash size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          {/*
            The reference shows the icon but never its open panel, so no business copy is
            invented for it: it carries the same authorship detail the role rows' info
            popover shows, which is this project's established behaviour for this control.
            Portalled so the card's overflow cannot crop it.
          */}
          <Popover
            portal
            align="end"
            triggerClassName="rounded-control"
            trigger={
              <span
                aria-label={`Details for ${node.name}`}
                className="flex size-7 items-center justify-center rounded-control text-green-600 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
              >
                <IconInfoCircle size={16} stroke={1.75} aria-hidden="true" />
              </span>
            }
            className="w-64 p-3"
          >
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex gap-1">
                <dt className="text-ink-muted">Created by :</dt>
                <dd className="min-w-0 truncate font-medium text-ink">
                  {node.createdByName ?? "System"}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-ink-muted">Created date :</dt>
                <dd className="min-w-0 text-ink">
                  {formatCreated(node.createdAt)}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-ink-muted">Leads :</dt>
                <dd className="min-w-0 text-ink">{node.leadCount}</dd>
              </div>
            </dl>
          </Popover>
        </div>
      </div>
    </div>
  );
}
