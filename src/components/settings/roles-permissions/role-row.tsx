"use client";

import {
  IconArrowsMove,
  IconChevronUp,
  IconGripVertical,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import type { RoleTreeNode } from "@/services/roles-service";
import { levelStyle } from "./hierarchy-levels";

/** Reference format: "04/02/2026, 06:31:45 pm". */
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

export interface RoleRowProps {
  node: RoleTreeNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onAddChild: (parent: RoleTreeNode) => void;
  onEdit: (node: RoleTreeNode) => void;
  onMove: (node: RoleTreeNode) => void;
  onDelete: (node: RoleTreeNode) => void;
  onDragStart: (node: RoleTreeNode) => void;
  onDropOn: (target: RoleTreeNode, mode: "into" | "before") => void;
  dragging: boolean;
  isDropTarget: boolean;
  onDragOverRow: (id: string | null) => void;
}

/**
 * One row of the hierarchy, matching the Workpex reference: a level-tinted pill carrying a
 * drag handle, the role name, a divider, "+ Add Role", the assigned badge when anyone holds
 * the role, and the four right-hand actions (move, edit, delete, info).
 *
 * The collapse control sits outside the pill on the left, where the reference draws it, and
 * only for a role that actually has children.
 */
export function RoleRow({
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
}: RoleRowProps) {
  const style = levelStyle(node.level);

  return (
    <div className="relative flex items-center gap-2">
      {/*
        Collapse control, drawn only when there is a subtree to hide — keyed off the
        children actually rendered rather than the server's `hasChildren`, so the control
        can never appear on a row with nothing under it to toggle.

        The reference fills the circle while collapsed and outlines it while expanded, so
        a closed branch reads as closed without following the connector lines.
      */}
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
          "flex min-h-12 flex-1 items-center gap-3 rounded-lg border px-3 py-2 transition-shadow duration-(--duration-shell) ease-shell",
          style.row,
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

        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-ink-muted/30" />

        <button
          type="button"
          onClick={() => onAddChild(node)}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors duration-(--duration-shell) ease-shell hover:bg-blue-200"
        >
          <IconPlus size={12} stroke={2.5} aria-hidden="true" />
          Add Role
        </button>

        {/* Only shown when someone actually holds the role, as in the reference. */}
        {node.assignedCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            <IconUsers size={12} stroke={2} aria-hidden="true" />
            {node.assignedCount} Assigned
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip content="Move">
            <button
              type="button"
              aria-label={`Move ${node.name}`}
              onClick={() => onMove(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-surface hover:text-ink"
            >
              <IconArrowsMove size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Edit">
            <button
              type="button"
              aria-label={`Edit ${node.name}`}
              onClick={() => onEdit(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-surface hover:text-ink"
            >
              <IconPencil size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete ${node.name}`}
              onClick={() => onDelete(node)}
              className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-surface hover:text-danger"
            >
              <IconTrash size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Portalled so the card's overflow cannot crop it and it flips near the edge. */}
          <Popover
            portal
            align="end"
            triggerClassName="rounded-control"
            trigger={
              <span
                aria-label={`Details for ${node.name}`}
                className="flex size-7 items-center justify-center rounded-control text-green-600 transition-colors duration-(--duration-shell) ease-shell hover:bg-surface"
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
                <dd className="min-w-0 text-ink">{formatCreated(node.createdAt)}</dd>
              </div>
            </dl>
          </Popover>
        </div>
      </div>
    </div>
  );
}
