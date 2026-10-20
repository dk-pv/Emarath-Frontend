import { apiGet, apiPost } from "@/lib/api-client";
import { TEAMS_PATH, type TeamsOverview } from "@/lib/teams";

/** Every live team and the accounts the Teams screen places in them. Super Admin only. */
export function fetchTeams(signal?: AbortSignal): Promise<TeamsOverview> {
  return apiGet<TeamsOverview>(TEAMS_PATH, undefined, signal);
}

/** A new team with its first members (an empty team is not stored). */
export function createTeam(
  name: string,
  memberIds: string[],
): Promise<TeamsOverview> {
  return apiPost<TeamsOverview>(TEAMS_PATH, { name, memberIds });
}

/** Renames a team on its members and its Tag Permissions. */
export function renameTeam(
  name: string,
  newName: string,
): Promise<TeamsOverview> {
  return apiPost<TeamsOverview>(`${TEAMS_PATH}/rename`, { name, newName });
}

/** Moves people into `team` (out of any other), or out of their team with null. */
export function assignToTeam(
  team: string | null,
  userIds: string[],
): Promise<TeamsOverview> {
  return apiPost<TeamsOverview>(`${TEAMS_PATH}/assign`, { team, userIds });
}
