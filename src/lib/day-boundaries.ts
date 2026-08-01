/**
 * The client's own local day boundaries (ADR-0028 §3): the instants of local
 * midnight, tomorrow, and the day after, as ISO strings. Computed on the client
 * and sent to the server so day-window filters follow the user's timezone rather
 * than the server's.
 *
 * Shared by the Activities worklist tabs (ACT-02.1) and the Leads activity Quick
 * Filter presets (LEAD-04.1) so "today"/"overdue" resolve to the same instant in
 * both — the boundaries the backend feeds to `activityBucketWhere`.
 */
export interface DayBoundaries {
  todayStart: string;
  todayEnd: string;
  tomorrowEnd: string;
}

export function dayBoundaries(): DayBoundaries {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
  return {
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString(),
    tomorrowEnd: tomorrowEnd.toISOString(),
  };
}
