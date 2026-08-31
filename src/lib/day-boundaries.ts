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

/**
 * The wider window edges the Activities filter popup's quick-date checkboxes need
 * (Yesterday / This Week / This Month), in the same local-midnight, half-open form
 * as `dayBoundaries` — `weekEnd` and `monthEnd` are the first instant *after* the
 * window, so a range comparison stays `gte`/`lt` throughout.
 *
 * The week starts on Monday: Workpex's Activities capture is a Monday-first
 * calendar, and the shared `Calendar` grid already renders Mon-first.
 */
export interface WindowEdges {
  yesterdayStart: string;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
}

export function windowEdges(): WindowEdges {
  const now = new Date();
  const midnight = (year: number, month: number, day: number): Date =>
    new Date(year, month, day);

  const todayStart = midnight(now.getFullYear(), now.getMonth(), now.getDate());

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // getDay() is Sunday-based (0..6); shift so Monday is 0.
  const mondayOffset = (todayStart.getDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = midnight(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = midnight(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    yesterdayStart: yesterdayStart.toISOString(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
  };
}
