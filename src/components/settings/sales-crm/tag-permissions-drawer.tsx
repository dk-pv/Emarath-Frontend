"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { Radio } from "@/components/ui/Radio";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
  fetchTagAccessOverview,
  resetTeamTagAccess,
  resetUserTagAccess,
  saveTeamTagAccess,
  saveUserTagAccess,
  type TeamTagAccess,
  type TagAccessMode,
  type TagAccessOverview,
  type UserTagAccess,
} from "@/services/tag-access-service";
import type { TagNode } from "@/services/tags-service";

type Tab = "teams" | "users";
type Inherit<T> = T | "inherit";
type SavedHandler = (next: TagAccessOverview, message: string) => void;

const TABS = [
  { value: "teams", label: "Teams" },
  { value: "users", label: "Users" },
] as const;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

export interface TagPermissionsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The live catalogue the Tags screen already holds (retired tags included). */
  tags: TagNode[];
}

/**
 * Settings → Sales & CRM Configuration → Tags → Tag Permissions (ADR-0091).
 *
 * The Admin decides, per team and per user, which tags may be selected and whether tags
 * may be created. A team is the Team set on a team member (`User.team`) — the only grouping
 * users carry; there is no separate department. A user override beats their team, field by
 * field. Nothing here is enforced by the screen — it only edits the
 * stored rules; the server applies them to every create, edit and tag request.
 */
export function TagPermissionsDrawer({
  open,
  onClose,
  tags,
}: TagPermissionsDrawerProps) {
  // Mounted only while open, so each opening reads the current rules.
  if (!open) return null;
  return <TagPermissionsPanel onClose={onClose} tags={tags} />;
}

function TagPermissionsPanel({
  onClose,
  tags,
}: Omit<TagPermissionsDrawerProps, "open">) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<TagAccessOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("teams");
  const [team, setTeam] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchTagAccessOverview(controller.signal)
      .then((result) => {
        setOverview(result);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setFailed(true);
      });
    return () => controller.abort();
  }, [reload]);

  // The first entry until the Admin picks one, so the editor is never blank once loaded.
  const selectedTeam =
    overview?.teams.find((d) => d.team === team) ?? overview?.teams[0] ?? null;
  const selectedUser =
    overview?.users.find((u) => u.userId === userId) ??
    overview?.users[0] ??
    null;

  const saved: SavedHandler = (next, message) => {
    setOverview(next);
    toast({ title: message, tone: "success" });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      overlay
      title="Tag Permissions"
      width="max-w-2xl"
      header={
        <header className="flex flex-col gap-3 border-b border-hairline p-5">
          <h2 className="text-lg font-medium text-ink">Tag Permissions</h2>
          <SegmentedControl
            aria-label="Configure by"
            options={TABS}
            value={tab}
            onChange={setTab}
          />
        </header>
      }
      footer={
        <Button variant="ghost" onClick={onClose} aria-label="Close">
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-5">
        <Alert tone="info">
          Until a setting is saved, every team can select all active tags and
          only administrators can create tags. A user’s own setting takes
          precedence over their team’s. Administrators are never restricted.
        </Alert>

        {failed ? (
          <ErrorState
            title="Couldn’t load tag permissions"
            description="The permissions could not be reached. Check your connection and try again."
            onRetry={() => {
              setOverview(null);
              setFailed(false);
              setReload((token) => token + 1);
            }}
          />
        ) : overview === null ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : tab === "teams" ? (
          overview.teams.length === 0 ? (
            <EmptyState
              title="No teams yet"
              description="A team is the Team value on a team member. No team member has one yet, so there is nothing to configure here."
            />
          ) : (
            <>
              <SearchableSelect
                aria-label="Team"
                searchable={overview.teams.length > 8}
                options={overview.teams.map((d) => ({
                  value: d.team,
                  label: `${d.team} (${d.memberCount})`,
                }))}
                value={selectedTeam?.team ?? null}
                onChange={setTeam}
                placeholder="Team"
              />
              {selectedTeam && (
                <TeamEditor
                  key={`${selectedTeam.team}|${selectedTeam.configured}|${selectedTeam.canCreate}|${selectedTeam.tagAccess}|${selectedTeam.tagIds.join(",")}`}
                  node={selectedTeam}
                  tags={tags}
                  onSaved={saved}
                />
              )}
            </>
          )
        ) : overview.users.length === 0 ? (
          <EmptyState
            title="No users to configure"
            description="Sales users appear here once they have been added."
          />
        ) : (
          <>
            <SearchableSelect
              aria-label="User"
              searchable
              options={overview.users.map((u) => ({
                value: u.userId,
                label: `${u.name} · ${u.team ?? "No team"}`,
              }))}
              value={selectedUser?.userId ?? null}
              onChange={setUserId}
              placeholder="User"
            />
            {selectedUser && (
              <UserEditor
                key={`${selectedUser.userId}|${JSON.stringify(selectedUser.override)}|${JSON.stringify(selectedUser.effective)}`}
                node={selectedUser}
                tags={tags}
                onSaved={saved}
              />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

/** Where the rules for the current selection stand — the screen's "has this been saved?" answer. */
function StatusLine({
  dirty,
  saved,
  savedLabel,
  defaultLabel,
}: {
  dirty: boolean;
  saved: boolean;
  savedLabel: string;
  defaultLabel: string;
}) {
  return (
    <p
      role="status"
      className={dirty ? "text-sm text-warning" : "text-sm text-ink-muted"}
    >
      {dirty ? "Unsaved changes" : saved ? savedLabel : defaultLabel}
    </p>
  );
}

/** A searchable list of the catalogue with a tick per tag, for a "only these tags" rule. */
function TagChecklist({
  tags,
  selected,
  onChange,
}: {
  tags: TagNode[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [tags, query]);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((current) => current !== id)
        : [...selected, id],
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PanelSearch
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find tags"
            aria-label="Find tags"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([...new Set([...selected, ...shown.map((t) => t.id)])])
          }
        >
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>

      <ul
        aria-label="Tags this rule allows"
        className="scrollbar-slim max-h-64 overflow-y-auto rounded-control border border-hairline"
      >
        {shown.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            {tags.length === 0 ? "No tags yet" : "No results found"}
          </li>
        ) : (
          shown.map((tag) => (
            <li
              key={tag.id}
              className="border-b border-hairline last:border-b-0"
            >
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-canvas">
                <Checkbox
                  checked={selected.includes(tag.id)}
                  onChange={() => toggle(tag.id)}
                />
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                {!tag.isActive && (
                  <span className="text-xs text-ink-subtle">Inactive</span>
                )}
              </label>
            </li>
          ))
        )}
      </ul>
      <p className="text-xs text-ink-muted">
        {selected.length} of {tags.length} selected
      </p>
    </div>
  );
}

function TeamEditor({
  node,
  tags,
  onSaved,
}: {
  node: TeamTagAccess;
  tags: TagNode[];
  onSaved: SavedHandler;
}) {
  // A saved list can still name a tag that has since been deleted; the server refuses those,
  // so the draft starts from the tags that still exist.
  const known = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const initial = useMemo(
    () => node.tagIds.filter((id) => known.has(id)),
    [node.tagIds, known],
  );

  const [canCreate, setCanCreate] = useState(node.canCreate);
  const [mode, setMode] = useState<TagAccessMode>(node.tagAccess);
  const [selected, setSelected] = useState<string[]>(initial);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    canCreate !== node.canCreate ||
    mode !== node.tagAccess ||
    (mode === "LISTED" && !sameSet(selected, initial));

  const run = async (
    kind: "save" | "reset",
    action: () => Promise<TagAccessOverview>,
    message: string,
  ) => {
    setBusy(kind);
    setError(null);
    try {
      onSaved(await action(), message);
    } catch (caught: unknown) {
      setError(messageOf(caught, "Could not save these permissions."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label={`${node.team} tag permissions`}
      className="flex flex-col gap-5 rounded-surface border border-hairline p-4"
    >
      {error && <FormError>{error}</FormError>}

      <div className="flex items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-3">
        <label
          htmlFor="team-can-create"
          className="cursor-pointer text-sm text-ink"
        >
          Can create new tags
          <span className="block text-xs text-ink-muted">
            {canCreate ? "Allowed" : "Not allowed"}
          </span>
        </label>
        <Switch
          id="team-can-create"
          checked={canCreate}
          onChange={(event) => setCanCreate(event.target.checked)}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-ink">
          Tags this team can select
        </legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
          <Radio
            name="team-tag-access"
            checked={mode === "ALL"}
            onChange={() => setMode("ALL")}
          />
          <span>
            All tags
            <span className="block text-xs text-ink-muted">
              Includes tags created later.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
          <Radio
            name="team-tag-access"
            checked={mode === "LISTED"}
            onChange={() => setMode("LISTED")}
          />
          <span>
            Only the tags I choose
            <span className="block text-xs text-ink-muted">
              A tag created later is not included unless you add it.
            </span>
          </span>
        </label>
        {mode === "LISTED" && (
          <TagChecklist
            tags={tags}
            selected={selected}
            onChange={setSelected}
          />
        )}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <StatusLine
          dirty={dirty}
          saved={node.configured}
          savedLabel="Saved"
          defaultLabel="Not configured — using the default"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={!node.configured || busy !== null}
            isLoading={busy === "reset"}
            onClick={() =>
              void run(
                "reset",
                () => resetTeamTagAccess(node.team),
                `${node.team} reset to the default`,
              )
            }
          >
            Reset to default
          </Button>
          <Button
            disabled={!dirty || busy !== null}
            isLoading={busy === "save"}
            onClick={() =>
              void run(
                "save",
                () =>
                  saveTeamTagAccess({
                    team: node.team,
                    canCreate,
                    tagAccess: mode,
                    tagIds: mode === "LISTED" ? selected : [],
                  }),
                `${node.team} permissions saved`,
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

function UserEditor({
  node,
  tags,
  onSaved,
}: {
  node: UserTagAccess;
  tags: TagNode[];
  onSaved: SavedHandler;
}) {
  const known = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const override = node.override;

  const [create, setCreate] = useState<Inherit<"allow" | "deny">>(
    override?.canCreate == null
      ? "inherit"
      : override.canCreate
        ? "allow"
        : "deny",
  );
  const [access, setAccess] = useState<Inherit<TagAccessMode>>(
    override?.tagAccess ?? "inherit",
  );
  // Switching to "only these" starts from what the user can select today, so the Admin edits
  // the current list instead of rebuilding it.
  const [selected, setSelected] = useState<string[]>(
    (override?.tagAccess === "LISTED"
      ? override.tagIds
      : node.effective.tagIds
    ).filter((id) => known.has(id)),
  );
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedSelected = (override?.tagIds ?? []).filter((id) => known.has(id));
  const savedCreate: Inherit<"allow" | "deny"> =
    override?.canCreate == null
      ? "inherit"
      : override.canCreate
        ? "allow"
        : "deny";
  const savedAccess: Inherit<TagAccessMode> = override?.tagAccess ?? "inherit";
  const dirty =
    create !== savedCreate ||
    access !== savedAccess ||
    (access === "LISTED" && !sameSet(selected, savedSelected));

  const run = async (
    kind: "save" | "reset",
    action: () => Promise<TagAccessOverview>,
    message: string,
  ) => {
    setBusy(kind);
    setError(null);
    try {
      onSaved(await action(), message);
    } catch (caught: unknown) {
      setError(messageOf(caught, "Could not save these permissions."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label={`${node.name} tag permissions`}
      className="flex flex-col gap-5 rounded-surface border border-hairline p-4"
    >
      {error && <FormError>{error}</FormError>}

      <p className="text-sm text-ink-muted">
        {node.team ? (
          <>
            Team: <span className="text-ink">{node.team}</span>.
          </>
        ) : (
          "No team, so the default applies."
        )}{" "}
        Currently{" "}
        <span className="text-ink">
          {node.effective.canCreate ? "can create tags" : "cannot create tags"}
        </span>{" "}
        and{" "}
        <span className="text-ink">
          {node.effective.tagAccess === "ALL"
            ? "can select all tags"
            : `can select ${node.effective.tagIds.length} tag${node.effective.tagIds.length === 1 ? "" : "s"}`}
        </span>
        .
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Create new tags</span>
        <SegmentedControl
          aria-label="Create new tags"
          options={[
            { value: "inherit", label: "Use team" },
            { value: "allow", label: "Allow" },
            { value: "deny", label: "Don’t allow" },
          ]}
          value={create}
          onChange={setCreate}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Select tags</span>
        <SegmentedControl
          aria-label="Select tags"
          options={[
            { value: "inherit", label: "Use team" },
            { value: "ALL", label: "All tags" },
            { value: "LISTED", label: "Only these" },
          ]}
          value={access}
          onChange={setAccess}
        />
        {access === "LISTED" && (
          <TagChecklist
            tags={tags}
            selected={selected}
            onChange={setSelected}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <StatusLine
          dirty={dirty}
          saved={override !== null}
          savedLabel="Saved — overrides the team"
          defaultLabel="No override — follows the team"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={override === null || busy !== null}
            isLoading={busy === "reset"}
            onClick={() =>
              void run(
                "reset",
                () => resetUserTagAccess(node.userId),
                `${node.name} now follows the team`,
              )
            }
          >
            Remove override
          </Button>
          <Button
            disabled={!dirty || busy !== null}
            isLoading={busy === "save"}
            onClick={() =>
              void run(
                "save",
                () =>
                  saveUserTagAccess(node.userId, {
                    canCreate: create === "inherit" ? null : create === "allow",
                    tagAccess: access === "inherit" ? null : access,
                    tagIds: access === "LISTED" ? selected : [],
                  }),
                `${node.name}’s permissions saved`,
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
