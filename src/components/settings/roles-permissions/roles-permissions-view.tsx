"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  buildRoleTree,
  createRole,
  deleteRole,
  fetchRoles,
  moveRole,
  updateRole,
  type RoleNode,
  type RoleTreeNode,
} from "@/services/roles-service";
import { USER_ROLE_LABELS, type UserRole } from "@/services/users-service";
import { TreeMoveDrawer } from "@/components/settings/tree-move-drawer";
import { HIERARCHY_LEGEND, MAX_HIERARCHY_LEVEL } from "./hierarchy-levels";
import { RoleDeleteDialog } from "./role-delete-dialog";
import { RoleRow } from "./role-row";

const BASE_ROLE_OPTIONS = (Object.keys(USER_ROLE_LABELS) as UserRole[]).map(
  (value) => ({ value, label: USER_ROLE_LABELS[value] }),
);

interface FormState {
  mode: "create" | "edit";
  parent: RoleTreeNode | null;
  role: RoleTreeNode | null;
  name: string;
  baseRole: UserRole;
}

/**
 * Settings → Users & Access → Roles & Permissions (ADR-0056).
 *
 * The hierarchy is real, persisted data from `GET /api/roles`: level, assigned counts and
 * authorship all come from the server, so nothing here is a screenshot reproduction. Every
 * structural rule (depth, cycles, delete safety) is enforced by the API — this screen shows
 * the server's answer rather than pre-judging it, which is why a rejected drag simply
 * reloads the tree and surfaces the reason.
 */
export function RolesPermissionsView() {
  const { toast } = useToast();
  const [rows, setRows] = useState<RoleNode[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState<RoleTreeNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [moving, setMoving] = useState<RoleTreeNode | null>(null);

  const [dragged, setDragged] = useState<RoleTreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchRoles(controller.signal)
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

  const tree = useMemo(() => (rows ? buildRoleTree(rows) : []), [rows]);
  const isLoading = rows === null && !failed;

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

  const submitForm = async () => {
    if (!form || !form.name.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      if (form.mode === "create") {
        await createRole({
          name: form.name.trim(),
          baseRole: form.baseRole,
          ...(form.parent ? { parentId: form.parent.id } : {}),
        });
        toast({ title: `${form.name.trim()} added`, tone: "success" });
      } else if (form.role) {
        await updateRole(form.role.id, {
          name: form.name.trim(),
          baseRole: form.baseRole,
        });
        toast({ title: `${form.name.trim()} updated`, tone: "success" });
      }
      setForm(null);
      reload();
    } catch (error: unknown) {
      setFormError(message(error, "Could not save this role."));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteRole(deleting.id);
      toast({ title: `${deleting.name} removed`, tone: "success" });
      setDeleting(null);
      reload();
    } catch (error: unknown) {
      setDeleteError(message(error, "Could not remove this role."));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sends a drag result to the API and re-reads the tree.
   *
   * The server owns the rules, so a refused move (cycle, depth cap) surfaces as a toast and
   * the tree simply reloads to the truth — no optimistic local reshuffle to unwind.
   */
  const applyDrop = async (target: RoleTreeNode, mode: "into" | "before") => {
    const moving = dragged;
    setDragged(null);
    setDropTarget(null);
    if (!moving || moving.id === target.id) return;

    try {
      await moveRole(
        moving.id,
        mode === "into"
          ? { parentId: target.id, position: target.children.length }
          : { parentId: target.parentId, position: target.position },
      );
      reload();
    } catch (error: unknown) {
      toast({
        title: message(error, "Could not move this role."),
        tone: "danger",
      });
      reload();
    }
  };

  const renderNodes = (nodes: RoleTreeNode[], depth: number) =>
    nodes.map((node, index) => {
      const isCollapsed = collapsed[node.id] === true;
      const last = index === nodes.length - 1;

      return (
        <li key={node.id} className="relative">
          {depth > 0 && (
            <>
              {/* Elbow into this row, and the trunk continuing to later siblings. */}
              <span
                aria-hidden="true"
                className="absolute -left-5 top-6 h-px w-5 border-t border-dashed border-hairline"
              />
              <span aria-hidden="true" className={cnTrunk(last)} />
            </>
          )}

          <RoleRow
            node={node}
            collapsed={isCollapsed}
            onToggle={(id) =>
              setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
            }
            onAddChild={(parent) => {
              setFormError(null);
              setForm({
                mode: "create",
                parent,
                role: null,
                name: "",
                baseRole: "SALES_AGENT",
              });
            }}
            onEdit={(role) => {
              setFormError(null);
              setForm({
                mode: "edit",
                parent: null,
                role,
                name: role.name,
                baseRole: role.baseRole,
              });
            }}
            onMove={setMoving}
            onDelete={(role) => {
              setDeleteError(null);
              setDeleting(role);
            }}
            onDragStart={setDragged}
            onDropOn={(target, mode) => void applyDrop(target, mode)}
            dragging={dragged?.id === node.id}
            isDropTarget={dropTarget === node.id && dragged?.id !== node.id}
            onDragOverRow={setDropTarget}
          />

          {node.children.length > 0 && !isCollapsed && (
            <ul className="relative ml-12 mt-2 flex flex-col gap-2">
              {renderNodes(node.children, depth + 1)}
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
              ? "You don't have access to roles & permissions"
              : "Couldn't load roles"
          }
          description={
            failed === "forbidden"
              ? "Role management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The role hierarchy could not be reached. Check your connection and try again."
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
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-12 w-full"
              style={{ marginLeft: index * 12 }}
            />
          ))}
        </div>
      );
    }

    if (tree.length === 0) {
      return (
        <EmptyState
          className="py-16"
          title="No roles yet"
          description="Create the first role to start building your access hierarchy."
        />
      );
    }

    return <ul className="flex flex-col gap-2">{renderNodes(tree, 0)}</ul>;
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">
            Roles &amp; Permissions
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Define user roles and control access across your organization
          </p>
        </div>
        <Button
          onClick={() => {
            setFormError(null);
            setForm({
              mode: "create",
              parent: null,
              role: null,
              name: "",
              baseRole: "SALES_AGENT",
            });
          }}
          disabled={failed !== false}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Role
        </Button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-5">
        {body()}
      </div>

      {/* Hierarchy legend, as the reference shows beneath the tree. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline bg-canvas px-5 py-4">
        <span className="text-sm font-medium text-ink">
          Hierarchy Levels <span className="px-1 text-ink-muted">|</span>
        </span>
        {HIERARCHY_LEGEND.map((entry) => (
          <span key={entry.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-4 rounded border ${entry.swatch}`}
            />
            <span className="text-sm text-ink-muted">{entry.label}</span>
          </span>
        ))}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          form?.mode === "edit"
            ? "Edit Role"
            : form?.parent
              ? `Add Role under ${form.parent.name}`
              : "Add Role"
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitForm()}
              isLoading={busy}
              disabled={!form?.name.trim() || busy}
            >
              {form?.mode === "edit" ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && <FormError>{formError}</FormError>}
          <FormField label="Role Name" htmlFor="role-name" required>
            <Input
              id="role-name"
              value={form?.name ?? ""}
              placeholder="Enter role name"
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, name: event.target.value } : prev,
                )
              }
            />
          </FormField>
          <FormField
            label="Access Level"
            htmlFor="role-base"
            required
            hint="The permission level this role grants."
          >
            <Select
              id="role-base"
              value={form?.baseRole ?? "SALES_AGENT"}
              options={BASE_ROLE_OPTIONS}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, baseRole: event.target.value as UserRole }
                    : prev,
                )
              }
            />
          </FormField>
        </div>
      </Modal>

      <TreeMoveDrawer
        node={moving}
        tree={tree}
        currentParentName={
          rows?.find((row) => row.id === moving?.parentId)?.name ?? null
        }
        entityLabel="Role"
        description="Select a new parent role. This will change the reporting structure and may affect data visibility."
        maxLevel={MAX_HIERARCHY_LEVEL}
        onClose={() => setMoving(null)}
        onSubmit={async (id, parentId) => {
          await updateRole(id, { parentId });
          toast({ title: `${moving?.name ?? "Role"} moved`, tone: "success" });
          setMoving(null);
          reload();
        }}
      />

      <RoleDeleteDialog
        node={deleting}
        error={deleteError}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}

/** The dashed trunk beside a child row; the last sibling's stops at its own elbow. */
function cnTrunk(last: boolean): string {
  return last
    ? "absolute -left-5 -top-2 h-8 w-px border-l border-dashed border-hairline"
    : "absolute -left-5 -top-2 bottom-[-0.5rem] w-px border-l border-dashed border-hairline";
}
