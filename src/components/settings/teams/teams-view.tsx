"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconEye,
  IconPencil,
  IconPlus,
  IconUserMinus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { ApiError, isAbortError } from "@/lib/api-client";
import { formatAED } from "@/lib/format";
import {
  MAX_TEAM_NAME,
  candidateLabel,
  candidatesFor,
  membersOf,
  movingFrom,
  normalizeTeamName,
  teamNameError,
  type TeamMemberEntry,
  type TeamSummary,
  type TeamsOverview,
} from "@/lib/teams";
import {
  assignToTeam,
  createTeam,
  fetchTeams,
  renameTeam,
} from "@/services/teams-service";
import { userRoleLabel } from "@/services/users-service";

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiError
    ? (caught.messages[0] ?? caught.message)
    : fallback;
}

/**
 * Settings → Users & Access → Teams (Teams v1, client acceptance criterion 11): the BDE teams,
 * their members, managers and monthly targets, and the means to create, rename and staff them.
 *
 * A team is the label its members carry (no Team table yet), which the screen says plainly: a team
 * exists while someone belongs to it, a person is in at most one team, and the target adds up the
 * active members' monthly goals. Every write is the API's (`/api/teams`, Super Admin only), which
 * answers with the fresh overview, so the list always shows what was stored. A new client screen
 * with no Workpex reference, so it reuses the Team Members layout (CLAUDE.md §1A).
 */
export function TeamsView() {
  const [overview, setOverview] = useState<TeamsOverview | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchTeams(controller.signal)
      .then((result) => {
        if (!active) return;
        setOverview(result);
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

  const team = overview?.teams.find((row) => row.name === selected) ?? null;

  const body = (() => {
    if (failed) {
      return (
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to teams"
              : "Couldn't load teams"
          }
          description={
            failed === "forbidden"
              ? "Team management is limited to Super Admin accounts. Sign in as a Super Admin and try again."
              : "The teams could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setOverview(null);
            setFailed(false);
            reload();
          }}
        />
      );
    }

    if (!overview) {
      return (
        <div className="flex flex-col gap-3 p-4" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (overview.teams.length === 0) {
      return (
        <EmptyState
          className="py-16"
          icon={IconUsersGroup}
          title="No teams yet"
          description="Create a team and choose its first members. Sales users without a team still work as before."
          action={
            <Button onClick={() => setCreating(true)}>
              <IconPlus size={16} stroke={2.5} aria-hidden="true" />
              New Team
            </Button>
          }
        />
      );
    }

    return (
      <ResponsiveTableContainer label="Teams">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-canvas text-left">
              <Th className="min-w-48">Team</Th>
              <Th className="min-w-28 text-right">Members</Th>
              <Th className="min-w-48">Sales Managers</Th>
              <Th className="min-w-40 text-right">Monthly Target</Th>
              <Th className="min-w-36">Tag Permissions</Th>
              <Th className="w-28 text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {overview.teams.map((row) => (
              <tr
                key={row.name}
                className="cursor-pointer border-b border-hairline transition-colors duration-(--duration-shell) ease-shell last:border-b-0 hover:bg-canvas"
                onClick={() => setSelected(row.name)}
              >
                <Td className="font-medium text-ink">{row.name}</Td>
                <Td className="text-right text-ink">
                  {row.activeMemberCount}
                  {row.memberCount !== row.activeMemberCount && (
                    <span className="text-ink-muted">
                      {" "}
                      of {row.memberCount}
                    </span>
                  )}
                </Td>
                <Td className="text-ink">
                  {row.managers.length ? (
                    row.managers.join(", ")
                  ) : (
                    <span className="text-ink-subtle">None</span>
                  )}
                </Td>
                <Td className="text-right text-ink">
                  {row.targetTotal === null ? (
                    <span className="text-ink-muted">No Target Set</span>
                  ) : (
                    formatAED(row.targetTotal)
                  )}
                </Td>
                <Td>
                  {row.tagPermissions ? (
                    <Tag>Custom</Tag>
                  ) : (
                    <span className="text-ink-muted">Default</span>
                  )}
                </Td>
                <Td className="text-right">
                  <Tooltip content="View and manage team" portal>
                    <IconButton
                      size="lg"
                      aria-label={`Manage ${row.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(row.name);
                      }}
                    >
                      <IconEye size={17} stroke={1.75} />
                    </IconButton>
                  </Tooltip>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableContainer>
    );
  })();

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Teams</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Group sales users into teams. A team exists while it has members;
            each person belongs to one team, and the monthly target adds up the
            active members&rsquo; goals.
          </p>
          {overview && overview.unassigned > 0 && (
            <p className="mt-1 text-sm text-ink-muted">
              {overview.unassigned} sales user
              {overview.unassigned === 1 ? " has" : "s have"} no team.
            </p>
          )}
        </div>
        {overview && overview.teams.length > 0 && (
          <Button className="shrink-0" onClick={() => setCreating(true)}>
            <IconPlus size={16} stroke={2.5} aria-hidden="true" />
            New Team
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-hairline">
        {body}
      </div>

      {overview && (
        <CreateTeamDialog
          key={creating ? "open" : "closed"}
          open={creating}
          overview={overview}
          onClose={() => setCreating(false)}
          onCreated={(next, name) => {
            setOverview(next);
            setCreating(false);
            setSelected(name);
          }}
        />
      )}

      {overview && (
        <TeamDrawer
          key={team?.name ?? "none"}
          team={team}
          overview={overview}
          onClose={() => setSelected(null)}
          onChanged={(next, name) => {
            setOverview(next);
            setSelected(
              name && next.teams.some((row) => row.name === name) ? name : null,
            );
          }}
        />
      )}
    </Card>
  );
}

/** A team's name, members and the means to change them. */
function TeamDrawer({
  team,
  overview,
  onClose,
  onChanged,
}: {
  team: TeamSummary | null;
  overview: TeamsOverview;
  onClose: () => void;
  /** The fresh overview, and the team to keep open (null when it no longer exists). */
  onChanged: (next: TeamsOverview, team: string | null) => void;
}) {
  const { toast } = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team?.name ?? "");
  const [adding, setAdding] = useState<string[]>([]);
  const [removing, setRemoving] = useState<TeamMemberEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = overview.teams.map((row) => row.name);
  const members = team ? membersOf(overview.members, team.name) : [];
  const candidates = team ? candidatesFor(overview.members, team.name) : [];
  const moving = team ? movingFrom(overview.members, adding, team.name) : [];
  const nameError =
    renaming && team ? teamNameError(name, names, team.name) : null;

  const run = async (
    action: () => Promise<TeamsOverview>,
    keep: string | null,
    done: string,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      toast({ title: done, tone: "success" });
      onChanged(next, keep);
    } catch (caught: unknown) {
      setError(messageOf(caught, "The change could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const lastOne = removing !== null && members.length === 1;

  return (
    <Drawer
      open={team !== null}
      onClose={onClose}
      width="max-w-2xl"
      title={team?.name ?? "Team"}
    >
      {team && (
        <div className="flex flex-col gap-6">
          {error && <FormError>{error}</FormError>}

          <section aria-labelledby="team-name-heading">
            <h3
              id="team-name-heading"
              className="text-base font-semibold text-ink"
            >
              Team name
            </h3>
            {renaming ? (
              <div className="mt-3 flex flex-col gap-3">
                <FormField
                  label="New name"
                  htmlFor="team-rename"
                  required
                  error={nameError ?? undefined}
                  hint="Members and the team's tag permissions take the new name."
                >
                  <Input
                    id="team-rename"
                    value={name}
                    maxLength={MAX_TEAM_NAME + 20}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormField>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setRenaming(false);
                      setName(team.name);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    isLoading={busy}
                    disabled={
                      nameError !== null ||
                      normalizeTeamName(name) === team.name
                    }
                    onClick={() => {
                      const next = normalizeTeamName(name);
                      void run(
                        () => renameTeam(team.name, next),
                        next,
                        `Renamed to ${next}`,
                      );
                    }}
                  >
                    Save name
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm text-ink">{team.name}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setName(team.name);
                    setRenaming(true);
                  }}
                >
                  <IconPencil size={16} stroke={1.75} aria-hidden="true" />
                  Rename
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="team-add-heading">
            <h3
              id="team-add-heading"
              className="text-base font-semibold text-ink"
            >
              Add members
            </h3>
            {candidates.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                Every sales user is already in this team.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <MultiSelect
                  searchable
                  aria-label="Choose members to add"
                  options={candidates.map((member) => ({
                    value: member.id,
                    label: candidateLabel(member),
                  }))}
                  value={adding}
                  placeholder="Choose sales users"
                  onChange={setAdding}
                />
                {moving.length > 0 && (
                  <p className="text-sm text-ink-muted">
                    {moving
                      .map((member) => `${member.name} leaves ${member.team}`)
                      .join("; ")}
                    . A person belongs to one team.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    disabled={adding.length === 0}
                    isLoading={busy}
                    onClick={() =>
                      void run(
                        () => assignToTeam(team.name, adding),
                        team.name,
                        `Added to ${team.name}`,
                      )
                    }
                  >
                    Add to team
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="team-members-heading">
            <h3
              id="team-members-heading"
              className="text-base font-semibold text-ink"
            >
              Members ({members.length})
            </h3>
            {/* Confirmed in the panel itself: a dialog over the drawer would count as a press
                outside it and close the drawer before the confirmation could land. */}
            {removing && (
              <Alert
                tone="warning"
                className="mt-3"
                title={
                  lastOne ? "Remove the last member?" : "Remove from team?"
                }
              >
                <p className="text-sm text-ink">
                  {lastOne
                    ? `${removing.name} is the last member of ${team.name}, so the team will no longer exist. Its tag permissions stay saved under the name in Tag Permissions.`
                    : `${removing.name} will no longer be in ${team.name}. Their leads stay assigned to them.`}
                </p>
                <div className="mt-3 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemoving(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={busy}
                    onClick={() => {
                      const person = removing;
                      void run(
                        () => assignToTeam(null, [person.id]),
                        team.name,
                        `${person.name} removed from ${team.name}`,
                      ).then(() => setRemoving(null));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </Alert>
            )}
            <div className="mt-3 rounded-surface border border-hairline">
              <ResponsiveTableContainer label={`${team.name} members`}>
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-canvas text-left">
                      <Th>Name</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Monthly Goal</Th>
                      <Th className="w-16 text-right">
                        <span className="sr-only">Remove</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-hairline last:border-b-0"
                      >
                        <Td className="font-medium text-ink">{member.name}</Td>
                        <Td className="text-ink">
                          {member.roleName ?? userRoleLabel(member.role)}
                        </Td>
                        <Td
                          className={
                            member.isActive ? "text-success" : "text-ink-muted"
                          }
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </Td>
                        <Td className="text-right text-ink">
                          {member.monthlyGoalAmount === null
                            ? "—"
                            : formatAED(member.monthlyGoalAmount)}
                        </Td>
                        <Td className="text-right">
                          <Tooltip content="Remove from team" portal>
                            <IconButton
                              size="lg"
                              tone="danger"
                              aria-label={`Remove ${member.name} from ${team.name}`}
                              onClick={() => setRemoving(member)}
                            >
                              <IconUserMinus size={17} stroke={1.75} />
                            </IconButton>
                          </Tooltip>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTableContainer>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

/** A new team: its name and first members, created in one request. */
function CreateTeamDialog({
  open,
  overview,
  onClose,
  onCreated,
}: {
  open: boolean;
  overview: TeamsOverview;
  onClose: () => void;
  onCreated: (next: TeamsOverview, name: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(
    () => overview.teams.map((row) => row.name),
    [overview],
  );
  const candidates = candidatesFor(overview.members, null);
  const nameError = teamNameError(name, names);
  const moving = movingFrom(overview.members, memberIds, null);

  const submit = async () => {
    const team = normalizeTeamName(name);
    setBusy(true);
    setError(null);
    try {
      const next = await createTeam(team, memberIds);
      toast({ title: `${team} created`, tone: "success" });
      onCreated(next, team);
    } catch (caught: unknown) {
      setError(messageOf(caught, "The team could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New team"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={nameError !== null || memberIds.length === 0}
            isLoading={busy}
          >
            Create team
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}
        <FormField
          label="Team name"
          htmlFor="team-new-name"
          required
          error={touched ? (nameError ?? undefined) : undefined}
        >
          <Input
            id="team-new-name"
            value={name}
            placeholder="e.g. UAE Team"
            maxLength={MAX_TEAM_NAME + 20}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        </FormField>
        <FormField
          label="Members"
          required
          hint="A team exists while it has members, so choose at least one."
        >
          {(control) =>
            candidates.length === 0 ? (
              <p className="text-sm text-ink-muted" id={control.id}>
                There are no sales users to add yet. Add team members first.
              </p>
            ) : (
              <MultiSelect
                id={control.id}
                searchable
                options={candidates.map((member) => ({
                  value: member.id,
                  label: candidateLabel(member),
                }))}
                value={memberIds}
                placeholder="Choose sales users"
                onChange={setMemberIds}
              />
            )
          }
        </FormField>
        {moving.length > 0 && (
          <p className="text-sm text-ink-muted">
            {moving
              .map((member) => `${member.name} leaves ${member.team}`)
              .join("; ")}
            . A person belongs to one team.
          </p>
        )}
      </div>
    </Modal>
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
