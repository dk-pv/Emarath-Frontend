"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { TreeMoveDrawer } from "@/components/settings/tree-move-drawer";
import {
  buildCategoryTree,
  deleteCategory,
  fetchCategories,
  moveCategory,
  updateCategory,
  type CategoryNode,
  type CategoryTreeNode,
} from "@/services/categories-service";
import { CategoryDeleteDialog } from "./category-delete-dialog";
import {
  CategoryFormDrawer,
  type CategoryFormState,
} from "./category-form-drawer";
import { CategoryRow } from "./category-row";

/**
 * Settings → Sales & CRM Configuration → Category.
 *
 * The catalogue is real, persisted data from `GET /api/categories` — the same table the
 * Add Lead form's Category dropdown reads, so what is managed here is what leads are filed
 * under. Every structural rule (name uniqueness, cycles, delete safety) is enforced by the
 * API; this screen shows the server's answer rather than pre-judging it, which is why a
 * rejected drag simply reloads the tree and surfaces the reason.
 */
export function CategoriesView() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CategoryNode[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [deleting, setDeleting] = useState<CategoryTreeNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<CategoryTreeNode | null>(null);

  const [dragged, setDragged] = useState<CategoryTreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchCategories(controller.signal)
      .then((result) => {
        if (!active) return;
        setRows(result);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed(
          error instanceof ApiError && error.status === 403
            ? "forbidden"
            : "error",
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const tree = useMemo(() => (rows ? buildCategoryTree(rows) : []), [rows]);
  const isLoading = rows === null && !failed;

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteCategory(deleting.id);
      toast({ title: `${deleting.name} deleted`, tone: "success" });
      setDeleting(null);
      reload();
    } catch (error: unknown) {
      setDeleteError(message(error, "Could not delete this category."));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sends a drag result to the API and re-reads the tree.
   *
   * The server owns the rules, so a refused move (a cycle) surfaces as a toast and the tree
   * reloads to the truth — no optimistic local reshuffle to unwind.
   */
  const applyDrop = async (target: CategoryTreeNode, mode: "into" | "before") => {
    const source = dragged;
    setDragged(null);
    setDropTarget(null);
    if (!source || source.id === target.id) return;

    try {
      await moveCategory(
        source.id,
        mode === "into"
          ? { parentId: target.id, position: target.children.length }
          : { parentId: target.parentId, position: target.position },
      );
      reload();
    } catch (error: unknown) {
      toast({
        title: message(error, "Could not move this category."),
        tone: "danger",
      });
      reload();
    }
  };

  const renderNodes = (nodes: CategoryTreeNode[]) =>
    nodes.map((node, index) => {
      const isCollapsed = collapsed[node.id] === true;
      const last = index === nodes.length - 1;

      return (
        <li key={node.id} className="relative">
          {/*
            The reference draws the dashed trunk at every level, roots included — unlike
            the role tree, where roots sit flush. The elbow reaches into this row; the
            trunk continues only while later siblings follow.
          */}
          <span
            aria-hidden="true"
            className="absolute -left-5 top-6 h-px w-5 border-t border-dashed border-hairline"
          />
          <span
            aria-hidden="true"
            className={
              last
                ? "absolute -left-5 -top-2 h-8 w-px border-l border-dashed border-hairline"
                : "absolute -left-5 -top-2 bottom-[-0.5rem] w-px border-l border-dashed border-hairline"
            }
          />

          <CategoryRow
            node={node}
            collapsed={isCollapsed}
            onToggle={(id) =>
              setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
            }
            onAddChild={(parent) =>
              setForm({ mode: "create", parent, category: null })
            }
            onEdit={(category) =>
              setForm({ mode: "edit", parent: null, category })
            }
            onMove={setMoving}
            onDelete={(category) => {
              setDeleteError(null);
              setDeleting(category);
            }}
            onDragStart={setDragged}
            onDropOn={(target, mode) => void applyDrop(target, mode)}
            dragging={dragged?.id === node.id}
            isDropTarget={dropTarget === node.id && dragged?.id !== node.id}
            onDragOverRow={setDropTarget}
          />

          {node.children.length > 0 && !isCollapsed && (
            <ul className="relative ml-12 mt-2 flex flex-col gap-2">
              {renderNodes(node.children)}
            </ul>
          )}
        </li>
      );
    });

  const body = () => {
    if (failed) {
      return (
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to categories"
              : "Couldn't load categories"
          }
          description={
            failed === "forbidden"
              ? "Category management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The category catalogue could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setRows(null);
            setFailed(false);
            reload();
          }}
        />
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col gap-3 py-2" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (tree.length === 0) {
      return (
        <EmptyState
          className="py-16"
          title="No categories yet"
          description="Create the first category to start organising enquiries."
        />
      );
    }

    // The left padding is the trunk's gutter: the connectors are drawn at -left-5.
    // `min-w-max` keeps a row at its natural width instead of letting the four actions be
    // squeezed off the edge on a narrow screen — the scroller below takes the overflow, so
    // the icons stay reachable rather than clipped. On a wide card the ul simply fills it.
    return (
      <ul className="flex min-w-max flex-col gap-2 pl-5">{renderNodes(tree)}</ul>
    );
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Category</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Organize enquiries by defining clear categories
          </p>
        </div>
        <Button
          onClick={() => setForm({ mode: "create", parent: null, category: null })}
          disabled={failed !== false}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Category
        </Button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {body()}
      </div>

      <CategoryFormDrawer
        state={form}
        onClose={() => setForm(null)}
        onSaved={(name, mode) => {
          toast({
            title: `${name} ${mode === "edit" ? "updated" : "added"}`,
            tone: "success",
          });
          setForm(null);
          reload();
        }}
      />

      <TreeMoveDrawer
        node={moving}
        tree={tree}
        currentParentName={
          rows?.find((row) => row.id === moving?.parentId)?.name ?? null
        }
        entityLabel="Category"
        description="Select a new parent category. This changes where it sits in the hierarchy."
        onClose={() => setMoving(null)}
        onSubmit={async (id, parentId) => {
          await updateCategory(id, { parentId });
          toast({
            title: `${moving?.name ?? "Category"} moved`,
            tone: "success",
          });
          setMoving(null);
          reload();
        }}
      />

      <CategoryDeleteDialog
        node={deleting}
        error={deleteError}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}
