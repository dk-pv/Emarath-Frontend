/**
 * Teams v1 (Settings → Users & Access → Teams): the shapes `GET /api/teams` returns and the rules
 * the screen applies before it asks. A team is the label its members carry — no Team table — so a
 * team exists while someone belongs to it, a person is in at most one team, and the team target is
 * the sum of its active members' monthly goals. The server enforces every rule here again.
 */

export const TEAMS_PATH = "/teams";

/** Mirrors the backend `MAX_TEAM_NAME` (`users.team` is VARCHAR(120)). */
export const MAX_TEAM_NAME = 120;

/** One live team, mirroring the backend `TeamSummary`. */
export interface TeamSummary {
  name: string;
  memberCount: number;
  activeMemberCount: number;
  /** Σ the active members' monthly goals, AED, as a Decimal string; null when none is set. */
  targetTotal: string | null;
  /** Active Sales Managers in the team. */
  managers: string[];
  /** Whether Tag Permissions has a policy saved under this team's name. */
  tagPermissions: boolean;
}

/** One live account, mirroring the backend `TeamMemberEntry`. */
export interface TeamMemberEntry {
  id: string;
  name: string;
  role: string;
  roleName: string | null;
  team: string | null;
  isActive: boolean;
  monthlyGoalAmount: string | null;
  /** Sales users other than the administrator may join a team. */
  eligible: boolean;
}

export interface TeamsOverview {
  teams: TeamSummary[];
  members: TeamMemberEntry[];
  /** Sales users who belong to no team. */
  unassigned: number;
}

/**
 * The roles a team member may hold — mirrors the backend `TEAM_MEMBER_ROLES`: the sales roles
 * other than the administrator. The member form uses it to say why its Team field is off.
 */
export const TEAM_MEMBER_ROLES: readonly string[] = [
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
];

/** The backend's rule (`normalizeTeamName`): trimmed, runs of whitespace collapsed to one space. */
export function normalizeTeamName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Why a name cannot be used, or null. Names match without regard to case, so "sales" clashes with
 * "Sales"; `current` is the team being renamed, whose own name in another case is allowed.
 */
export function teamNameError(
  raw: string,
  existing: readonly string[],
  current: string | null = null,
): string | null {
  const name = normalizeTeamName(raw);
  if (!name) return "Enter a team name.";
  if (name.length > MAX_TEAM_NAME) {
    return `Team names are at most ${MAX_TEAM_NAME} characters.`;
  }
  const clash = existing.find(
    (team) => team !== current && team.toLowerCase() === name.toLowerCase(),
  );
  return clash ? `A team named "${clash}" already exists.` : null;
}

/** The team's roster, by name. */
export function membersOf(
  members: readonly TeamMemberEntry[],
  team: string,
): TeamMemberEntry[] {
  return members.filter((member) => member.team === team);
}

/**
 * Who can be added to `team`: sales users not already in it. For a new team (null) that is every
 * sales user — those in no team included.
 */
export function candidatesFor(
  members: readonly TeamMemberEntry[],
  team: string | null,
): TeamMemberEntry[] {
  return members.filter(
    (member) => member.eligible && (team === null || member.team !== team),
  );
}

/** A candidate's option label: adding someone moves them out of the team they are in. */
export function candidateLabel(member: TeamMemberEntry): string {
  const status = member.isActive ? "" : ", inactive";
  return member.team
    ? `${member.name} (in ${member.team}${status})`
    : status
      ? `${member.name} (inactive)`
      : member.name;
}

/** How many of the chosen people would leave another team — the move is said before it is made. */
export function movingFrom(
  members: readonly TeamMemberEntry[],
  chosen: readonly string[],
  team: string | null,
): TeamMemberEntry[] {
  return members.filter(
    (member) =>
      chosen.includes(member.id) &&
      member.team !== null &&
      member.team !== team,
  );
}
