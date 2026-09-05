"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconMinus, IconPlus } from "@tabler/icons-react";
import { useMounted } from "@/components/ui/Modal";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { cn } from "@/lib/cn";
import type { TeamMember } from "@/services/users-service";

/** One member and the members reporting to them. */
export interface UserTreeNode {
  id: string;
  name: string;
  children: UserTreeNode[];
}

/**
 * The roster as a reporting tree, built from `reportingToId`.
 *
 * A member whose manager is not in the given set is treated as a root, so nobody can be
 * hidden by a paged roster — every fetched member is reachable in the panel. Siblings keep
 * the order the API returned them in.
 */
export function buildUserTree(members: readonly TeamMember[]): UserTreeNode[] {
  const nodes = new Map<string, UserTreeNode>(
    members.map((member) => [
      member.id,
      { id: member.id, name: member.name, children: [] },
    ]),
  );

  const roots: UserTreeNode[] = [];
  for (const member of members) {
    const node = nodes.get(member.id);
    if (!node) continue;
    const parent = member.reportingToId
      ? nodes.get(member.reportingToId)
      : undefined;
    // Self-reference would build a node that contains itself; the API forbids it, and
    // trusting that here would hang the walk below.
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** One rendered line: a node plus how deep it sits. */
type Row = { node: UserTreeNode; depth: number };

/**
 * Keeps a node when it matches, or when anything beneath it does — searching narrows the
 * tree without cutting a match off from the branch that explains where it sits.
 */
function filterTree(nodes: UserTreeNode[], term: string): UserTreeNode[] {
  if (!term) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, term);
    const hit = node.name.toLowerCase().includes(term);
    if (!hit && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

/** The visible lines, in tree order; a collapsed node contributes only itself. */
function flatten(
  nodes: UserTreeNode[],
  isExpanded: (id: string) => boolean,
  depth = 0,
): Row[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(isExpanded(node.id) ? flatten(node.children, isExpanded, depth + 1) : []),
  ]);
}

/** The reference's panel height — roughly the seven rows and search box it shows. */
const PANEL_MAX_HEIGHT = 320;

const PANEL_CLASS =
  "fixed z-50 flex min-w-56 flex-col overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg";

export interface UserTreeSelectProps {
  id?: string;
  "aria-label": string;
  members: readonly TeamMember[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * The reference's hierarchical "Select User" — a search box over the reporting tree,
 * children indented under their manager, each branch expandable.
 *
 * Not a `SearchableSelect`: that renders a flat list, and the reference shows the branch
 * toggles and the tree guides, which a `depth`-indented list drops (CLAUDE.md §16.3). It
 * reuses the same panel anatomy — the shared search box, the anchoring hook that keeps a
 * fixed panel pinned and inside the viewport, and the shared dismiss behaviour — so it
 * cannot be cropped by the wizard's scrolling body.
 */
export function UserTreeSelect({
  id,
  "aria-label": ariaLabel,
  members,
  value,
  onChange,
  placeholder = "Select User",
  disabled,
  loading,
}: UserTreeSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null);
  const mounted = useMounted();

  // Stable: the anchoring hook memoises on its callbacks, so a fresh closure each render
  // would re-run its effect on every render that effect itself causes.
  const dismiss = useCallback(() => {
    close();
    setQuery("");
  }, [close]);

  const position = useCallback((style: React.CSSProperties) => {
    setAnchor({
      ...style,
      // The hook offers all the room the viewport has; the reference's panel is a compact
      // scroller, not a full-height column, so the smaller of the two wins. It has to be
      // applied here rather than as a class: the hook's value is inline, and inline beats
      // a `max-h-*` class every time.
      maxHeight: Math.min(Number(style.maxHeight) || PANEL_MAX_HEIGHT, PANEL_MAX_HEIGHT),
      width: triggerRef.current?.getBoundingClientRect().width,
    });
  }, []);

  useDismissable([root, panelRef], isOpen, dismiss);
  useAnchoredPosition({
    enabled: isOpen,
    triggerRef,
    align: "start",
    onPosition: position,
    onDetach: dismiss,
  });

  const tree = useMemo(() => buildUserTree(members), [members]);
  const term = query.trim().toLowerCase();
  const shown = useMemo(() => filterTree(tree, term), [tree, term]);

  // Branches are open by default, as the reference's root is; a search opens every
  // surviving branch so a deep match is never hidden behind a collapsed parent.
  const rows = useMemo(
    () => flatten(shown, (nodeId) => term !== "" || !collapsed.has(nodeId)),
    [shown, collapsed, term],
  );

  const selected = members.find((member) => member.id === value);

  const toggleBranch = (nodeId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(nodeId)) next.add(nodeId);
      return next;
    });

  const panel = (
    <div ref={panelRef} className={PANEL_CLASS} style={anchor ?? undefined}>
      <div className="shrink-0 border-b border-hairline p-2">
        <PanelSearch
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search users"
        />
      </div>

      <ul role="tree" className="scrollbar-slim overflow-y-auto py-1">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            No results found
          </li>
        ) : (
          rows.map(({ node, depth }) => {
            const branch = node.children.length > 0;
            const open = term !== "" || !collapsed.has(node.id);
            return (
              <li
                key={node.id}
                role="treeitem"
                aria-selected={node.id === value}
                aria-expanded={branch ? open : undefined}
                className="flex items-center gap-1 pr-2"
                // A measurement rather than a palette value, so it stays inline instead
                // of becoming a set of padding classes only this tree would ever use.
                style={{ paddingLeft: `${0.5 + depth}rem` }}
              >
                {branch ? (
                  <button
                    type="button"
                    aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
                    onClick={() => toggleBranch(node.id)}
                    className="focus-ring flex size-4 shrink-0 items-center justify-center rounded-xs bg-brand text-white"
                  >
                    {open ? (
                      <IconMinus size={12} stroke={3} aria-hidden="true" />
                    ) : (
                      <IconPlus size={12} stroke={3} aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span aria-hidden="true" className="size-4 shrink-0" />
                )}

                {/* The reference's dashed guide running into each child's name. */}
                {depth > 0 && (
                  <span
                    aria-hidden="true"
                    className="w-3 shrink-0 border-t border-dashed border-hairline"
                  />
                )}

                <button
                  type="button"
                  onClick={() => {
                    onChange(node.id);
                    dismiss();
                  }}
                  className={cn(
                    "focus-ring min-w-0 flex-1 cursor-pointer rounded-control px-2 py-1.5 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
                    node.id === value && "bg-sidebar-active/40",
                  )}
                >
                  <span className="block truncate">{node.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="tree"
        aria-expanded={isOpen}
        onClick={toggle}
        className="focus-ring flex h-control-lg w-full items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm transition-colors duration-(--duration-shell) ease-shell disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selected && "text-ink-subtle",
          )}
        >
          {loading ? "Loading…" : (selected?.name ?? placeholder)}
        </span>
        <IconChevronDown
          aria-hidden="true"
          stroke={1.75}
          className={cn(
            "size-4 shrink-0 text-ink-muted transition-transform duration-(--duration-shell) ease-shell",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Portalled once anchored, so it never flashes at 0,0 on the first frame. */}
      {isOpen && mounted && anchor !== null && createPortal(panel, document.body)}
    </div>
  );
}
