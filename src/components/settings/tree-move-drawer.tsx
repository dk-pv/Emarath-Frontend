"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { SelectOption } from "@/types";

/** What the drawer needs of a node; both settings trees satisfy it. */
export interface TreeMoveNode<T> {
  id: string;
  name: string;
  /** 1-based depth, used against `maxLevel`. */
  level: number;
  children: T[];
}

/** Tallest branch below and including a node — mirrors the server's depth guard. */
function heightOf<T extends TreeMoveNode<T>>(node: T): number {
  return node.children.length === 0
    ? 1
    : 1 + Math.max(...node.children.map(heightOf));
}

/**
 * The nodes a branch may legally be re-parented onto, in tree order.
 *
 * Pruning is by subtree: returning early at an invalid node drops everything under it
 * too, which is exactly right for both rules — a node's descendants are all invalid once
 * the node itself is, and a parent that would overflow the level cap has children that
 * would overflow it further.
 */
function parentOptions<T extends TreeMoveNode<T>>(
  nodes: T[],
  movingId: string,
  height: number,
  maxLevel: number | undefined,
  depth = 0,
): SelectOption[] {
  return nodes.flatMap((node) => {
    if (node.id === movingId) return [];
    if (maxLevel !== undefined && node.level + height > maxLevel) return [];
    return [
      { value: node.id, label: node.name, depth },
      ...parentOptions(node.children, movingId, height, maxLevel, depth + 1),
    ];
  });
}

export interface TreeMoveDrawerProps<T extends TreeMoveNode<T>> {
  /** The node being moved; `null` keeps the drawer closed. */
  node: T | null;
  tree: T[];
  currentParentName: string | null;
  /** The noun in the header, alert and submit button — "Role", "Category". */
  entityLabel: string;
  /** The alert's second line; each screen states its own consequence. */
  description: string;
  /** Deepest level the tree allows; omitted means the tree has no cap. */
  maxLevel?: number;
  onClose: () => void;
  /** Performs the move. Throwing keeps the drawer open and shows the reason. */
  onSubmit: (nodeId: string, parentId: string) => Promise<void>;
}

/**
 * The settings trees' shared Move drawer (Roles & Permissions, Category).
 *
 * Re-parenting is expressed as "put this under that" — the drawer has no sibling index to
 * offer, so the caller's endpoint appends server-side and ordering keeps one source of
 * truth. Drag/drop remains the path that carries an explicit index.
 *
 * The option list is filtered to legal targets, but it is not the guard: the server
 * re-checks every structural rule, and its refusal is surfaced here rather than swallowed.
 */
export function TreeMoveDrawer<T extends TreeMoveNode<T>>({
  node,
  tree,
  currentParentName,
  entityLabel,
  description,
  maxLevel,
  onClose,
  onSubmit,
}: TreeMoveDrawerProps<T>) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      node ? parentOptions(tree, node.id, heightOf(node), maxLevel) : [],
    [tree, node, maxLevel],
  );

  const close = () => {
    setParentId(null);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!node || !parentId) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(node.id, parentId);
      setParentId(null);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : `Could not move this ${entityLabel.toLowerCase()}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const heading = `Move ${entityLabel}`;
  const fieldId = `${entityLabel.toLowerCase()}-move-parent`;

  return (
    <Drawer
      open={node !== null}
      onClose={close}
      overlay
      title={heading}
      width="max-w-2xl"
      header={
        <header className="border-b border-hairline p-5">
          <h2 className="text-lg font-medium text-ink">{heading}</h2>
        </header>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={busy}
            disabled={!parentId}
          >
            {heading}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-5">
        {error && <FormError>{error}</FormError>}

        {/* The reference tints the whole callout, not just its icon. */}
        <Alert
          tone="warning"
          title={`Moving ${entityLabel}: ${node?.name ?? ""}`}
          className="[&_p]:text-warning"
        >
          <p>{description}</p>
        </Alert>

        <div className="flex h-control-lg items-center gap-1.5 overflow-hidden rounded-control border border-hairline bg-canvas px-field-x text-sm">
          <span className="shrink-0 text-ink">Current Parent</span>
          <span className="truncate text-ink-muted">
            – {currentParentName ?? "None"}
          </span>
        </div>

        <FormField label={`Select ${entityLabel}`} htmlFor={fieldId} required>
          <SearchableSelect
            id={fieldId}
            options={options}
            value={parentId}
            onChange={setParentId}
            placeholder={`Select ${entityLabel}`}
            searchable
          />
        </FormField>
      </div>
    </Drawer>
  );
}
