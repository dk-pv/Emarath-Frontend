"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconLock,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { ApiError, isAbortError } from "@/lib/api-client";
import {
  deleteTeamMember,
  fetchTeamMembers,
  userRoleLabel,
  type TeamMember,
  type UserRole,
} from "@/services/users-service";
import { TeamMemberFormDrawer } from "./team-member-form-drawer";
import { ChangePasswordDialog } from "./change-password-dialog";
import { formatLastLogin, formatRelative } from "./format";

const ALL = "all";
/** The reference opens the roster at 10 rows; the sizes themselves are the shared list set. */
const INITIAL_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** The Role dropdown's options. Fixed by the seeded enum, so no request is needed. */
const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Role", value: ALL },
  ...(
    [
      "SUPERADMIN",
      "SALES_MANAGER",
      "SALES_AGENT",
      "CUSTOMER_SERVICE_AGENT",
      "MARKETING_ANALYST",
    ] as UserRole[]
  ).map((role) => ({ label: userRoleLabel(role), value: role })),
];

/**
 * Settings → Users & Access → Team Members, from the Workpex reference: a card headed
 * "Team Members / Control team access and responsibilities" with search, a Role filter and
 * "Add New Team Member" on the right, over a roster table and a rows-per-page pager.
 *
 * Search, role filter, sort and paging are all **server-side** (`GET /api/users`) — the
 * roster is the real account list, not a client-side array, so the same records appear here
 * as everywhere else and a growing team never ships every row to the browser. Search is
 * debounced so typing does not fire a request per keystroke, and page resets to 1 whenever
 * the query narrows, or the user could be left stranded on a page that no longer exists.
 */
export function TeamMembersView() {
  const [rows, setRows] = useState<TeamMember[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(INITIAL_PAGE_SIZE);

  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [passwordFor, setPasswordFor] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const { toast } = useToast();

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // Narrowing the result set is done in the handler, not an effect: a narrowed set can be
  // shorter than the current page, and resetting here avoids a render that fetches a page
  // that is about to be discarded.
  const narrow = (apply: () => void) => {
    apply();
    setPage(1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchTeamMembers(
      { page, size, search: debouncedSearch || undefined },
      { role: role === ALL ? null : (role as UserRole) },
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        setRows([...result.rows]);
        setTotal(result.total);
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
  }, [page, size, debouncedSearch, role, reloadToken]);

  const isLoading = rows === null && !failed;
  const pageCount = Math.max(1, Math.ceil(total / size));

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteTeamMember(deleting.id);
      toast({ title: `${deleting.name} removed`, tone: "success" });
      setDeleting(null);
      // Stepping back off a page that just lost its last row avoids an empty final page.
      if (rows?.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (error: unknown) {
      setDeleteError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not remove this team member.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const body = useMemo(() => {
    if (failed) {
      return (
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to team members"
              : "Couldn't load team members"
          }
          description={
            failed === "forbidden"
              ? "Team member management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The team roster could not be reached. Check your connection and try again."
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
        <div className="flex flex-col gap-3 p-4" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (rows && rows.length === 0) {
      const narrowed = debouncedSearch.trim() !== "" || role !== ALL;
      return (
        <EmptyState
          className="py-16"
          icon={IconUsers}
          title={narrowed ? "No team members found" : "No team members yet"}
          description={
            narrowed
              ? "No team members match your search or role filter."
              : "Add your first team member to get started."
          }
        />
      );
    }

    return (
      <ResponsiveTableContainer label="Team members">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-canvas text-left">
              <Th className="min-w-56">User &amp; Role</Th>
              <Th className="min-w-28">Job Title</Th>
              <Th className="min-w-28">App Access</Th>
              <Th className="min-w-56">Email</Th>
              <Th className="min-w-40">Phone</Th>
              <Th className="min-w-32">Last Seen</Th>
              <Th className="min-w-36">Last Login</Th>
              <Th className="min-w-28 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((member) => (
              <tr
                key={member.id}
                className="border-b border-hairline transition-colors duration-(--duration-shell) ease-shell last:border-b-0 hover:bg-canvas"
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={member.name}
                      src={member.avatarUrl ?? undefined}
                      size="md"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {member.name}
                      </span>
                      <span className="block truncate text-[13px] text-ink-muted">
                        {member.roleName ?? userRoleLabel(member.role)}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td className="text-ink">{member.jobTitle ?? "—"}</Td>
                <Td>
                  <AccessBadge active={member.isActive} />
                </Td>
                <Td className="text-ink">{member.email}</Td>
                <Td className="text-ink">{member.phone ?? "—"}</Td>
                <Td className="text-ink-muted">
                  {formatRelative(member.lastSeenAt)}
                </Td>
                <Td className="text-ink-muted">
                  {formatLastLogin(member.lastLoginAt)}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Edit team member" portal>
                      <IconButton
                        size="lg"
                        aria-label={`Edit ${member.name}`}
                        onClick={() => setEditing(member)}
                      >
                        <IconPencil size={17} stroke={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Delete team member" portal>
                      <IconButton
                        size="lg"
                        tone="danger"
                        aria-label={`Delete ${member.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(member);
                        }}
                      >
                        <IconTrash size={17} stroke={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Change password" portal>
                      <IconButton
                        size="lg"
                        aria-label={`Change password for ${member.name}`}
                        onClick={() => setPasswordFor(member)}
                      >
                        <IconLock size={17} stroke={1.75} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableContainer>
    );
  }, [failed, isLoading, rows, debouncedSearch, role, reload]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Team Members</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Control team access and responsibilities
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-60">
            <SearchInput
              aria-label="Search team members"
              placeholder="Search"
              value={search}
              onChange={(event) => narrow(() => setSearch(event.target.value))}
            />
          </div>
          <div className="sm:w-44">
            <Select
              aria-label="Filter team members by role"
              options={ROLE_OPTIONS}
              value={role}
              onChange={(event) => narrow(() => setRole(event.target.value))}
            />
          </div>
          <Button onClick={() => setCreating(true)}>
            <IconPlus size={16} stroke={2.5} aria-hidden="true" />
            Add New Team Member
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 border-t border-hairline">{body}</div>

      {!failed && (
        <div className="border-t border-hairline p-4">
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            pageSize={size}
            onPageSizeChange={(next) => narrow(() => setSize(next))}
            total={total}
          />
        </div>
      )}

      <TeamMemberFormDrawer
        key={editing?.id ?? "new"}
        open={creating || editing !== null}
        member={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reload();
        }}
      />

      <ChangePasswordDialog
        key={passwordFor?.id ?? "none"}
        member={passwordFor}
        onClose={() => setPasswordFor(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Remove team member?"
        description={
          deleteError ??
          `${deleting?.name ?? "This user"} will lose access immediately and any active session will end. This cannot be undone from here.`
        }
        confirmLabel="Remove"
        tone="danger"
        busy={deleteBusy}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap text-ink-muted ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className ?? ""}`}>
      {children}
    </td>
  );
}

/** The reference shows a green check + "Active" for an account that may sign in. */
function AccessBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1.5 text-sm font-medium text-success"
          : "inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted"
      }
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${active ? "bg-success" : "bg-ink-subtle"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
