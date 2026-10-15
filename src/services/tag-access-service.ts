import { apiDelete, apiGet, apiPut } from "@/lib/api-client";
import { announce, TAGS_CHANGED } from "@/lib/catalog-events";
import type { LookupOption } from "@/services/lookups-service";

/**
 * Tag Permissions (ADR-0091): which tags a team or a single user may select, and who
 * may create tags. A team is a `User.team` label — the only grouping users carry.
 *
 * `fetchMyTagAccess` is what the pickers read; everything else is the Admin's matrix on
 * Settings → Sales & CRM Configuration → Tags, and is refused for every other role.
 */

export type TagAccessMode = "ALL" | "LISTED";

/** `GET /api/tag-access/me` — the caller's effective permissions, ready to render. */
export interface MyTagAccess {
  canCreate: boolean;
  /** True when the caller may select only some tags. */
  restricted: boolean;
  /** The active tags the caller may select, in name order. */
  tags: LookupOption[];
}

/** One team's default. `configured: false` means nobody has saved it: as before. */
export interface TeamTagAccess {
  team: string;
  memberCount: number;
  configured: boolean;
  canCreate: boolean;
  tagAccess: TagAccessMode;
  tagIds: string[];
}

export interface UserTagAccess {
  userId: string;
  name: string;
  role: string;
  team: string | null;
  /** Null fields inherit the team; a null override means the user inherits everything. */
  override: {
    canCreate: boolean | null;
    tagAccess: TagAccessMode | null;
    tagIds: string[];
  } | null;
  /** What the user ends up with once the team and the override meet. */
  effective: {
    canCreate: boolean;
    tagAccess: TagAccessMode;
    tagIds: string[];
  };
}

export interface TagAccessOverview {
  teams: TeamTagAccess[];
  users: UserTagAccess[];
}

export interface SaveTeamTagAccessInput {
  team: string;
  canCreate: boolean;
  tagAccess: TagAccessMode;
  tagIds: string[];
}

export interface SaveUserTagAccessInput {
  /** Null inherits the team's value. */
  canCreate: boolean | null;
  /** Null inherits the team's value. */
  tagAccess: TagAccessMode | null;
  tagIds: string[];
}

export function fetchMyTagAccess(signal?: AbortSignal): Promise<MyTagAccess> {
  return apiGet<MyTagAccess>("/tag-access/me", undefined, signal);
}

export function fetchTagAccessOverview(
  signal?: AbortSignal,
): Promise<TagAccessOverview> {
  return apiGet<TagAccessOverview>("/tag-access", undefined, signal);
}

/** A saved change reaches every open picker in this session, the Admin's own included. */
function changed<T>(write: Promise<T>): Promise<T> {
  return write.then((result) => {
    announce(TAGS_CHANGED);
    return result;
  });
}

export function saveTeamTagAccess(
  input: SaveTeamTagAccessInput,
): Promise<TagAccessOverview> {
  return changed(apiPut<TagAccessOverview>("/tag-access/teams", input));
}

export function resetTeamTagAccess(team: string): Promise<TagAccessOverview> {
  return changed(
    apiDelete<TagAccessOverview>(
      `/tag-access/teams?team=${encodeURIComponent(team)}`,
    ),
  );
}

export function saveUserTagAccess(
  userId: string,
  input: SaveUserTagAccessInput,
): Promise<TagAccessOverview> {
  return changed(
    apiPut<TagAccessOverview>(`/tag-access/users/${userId}`, input),
  );
}

export function resetUserTagAccess(userId: string): Promise<TagAccessOverview> {
  return changed(apiDelete<TagAccessOverview>(`/tag-access/users/${userId}`));
}
