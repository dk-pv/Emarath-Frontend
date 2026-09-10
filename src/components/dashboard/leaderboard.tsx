import { IconInfoCircle, IconUser } from "@tabler/icons-react";
import { formatAEDCompact } from "@/lib/format";
import type { SalesLeaderboardEntry } from "@/services/dashboard-service";

const COUNT = new Intl.NumberFormat("en-US");
/** No thousands separator: the reference renders 4846.35%, not 4,846.35%. */
const PERCENT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/**
 * A percentage, or `NA` when the API could not compute one.
 *
 * Never clamped: an agent who beats their target reads 1200.38 %, exactly as the
 * reference does. `NA` is a real value in the reference — the fourth card in
 * dashboard-leaderboard-call-activity-board-alerts-empty-state.png shows it — and
 * means "no target set", which is a different statement from 0 %.
 */
function percent(value: number | null): string {
  return value === null ? "NA" : `${PERCENT.format(value)}%`;
}

/** Label + value on one line, the shape both the body and the footer use. */
function MetricRow({
  label,
  value,
  info = false,
  className = "",
}: {
  label: string;
  value: string;
  info?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1 truncate">
          {label}
          {info && (
            <IconInfoCircle
              size={13}
              stroke={2}
              aria-hidden="true"
              className="shrink-0 opacity-80"
            />
          )}
        </span>
        {!info && <span className="shrink-0 font-medium">{value}</span>}
      </div>
      {info && (
        <p className="mt-1 text-[19px] leading-none font-bold">{value}</p>
      )}
    </div>
  );
}

/**
 * One agent's leaderboard card: photo, green name bar, pale metrics body, green
 * performance footer — the four bands the reference draws, in that order.
 *
 * 238×— at the product's density (reference 264 wide, ADR-0076 ×0.9); the photo is
 * 175px tall against the reference's 195. No rank number, medal or sort control is
 * drawn, because none appears anywhere in the reference.
 */
function LeaderboardCard({ entry }: { entry: SalesLeaderboardEntry }) {
  return (
    <article className="flex w-[14.875rem] flex-col overflow-hidden rounded-surface border border-hairline bg-surface">
      {/* Workpex's no-photo placeholder is the same grey silhouette the rest of the
          product uses for a member without an avatar — not a stock image. */}
      <div className="flex h-[10.9375rem] w-full items-center justify-center bg-gray-300">
        {entry.avatarUrl ? (
          // A plain img for the same reason Avatar uses one: these are signed,
          // user-data origins, unknown at build time, so next/image would need
          // every one of them declared in remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <IconUser
            size={64}
            stroke={1.5}
            aria-hidden="true"
            className="text-gray-500"
          />
        )}
      </div>

      <h4 className="truncate bg-brand px-3 py-2 text-center text-sm font-semibold text-white">
        {entry.agentName}
      </h4>

      <div className="flex flex-col gap-1.5 bg-brand-subtle px-3 py-2.5 text-sm text-ink">
        <MetricRow label="Leads" value={COUNT.format(entry.leads)} />
        <MetricRow label="Calls" value={COUNT.format(entry.calls)} />
        <MetricRow
          label="Converted Amount"
          value={formatAEDCompact(entry.convertedAmount, { digits: 2 })}
        />
      </div>

      <div className="mt-auto flex flex-col bg-brand px-3 py-2.5 text-xs text-white">
        <MetricRow
          label="Total Conversion Rate"
          value={percent(entry.conversionRate)}
          info
        />
        <MetricRow
          label="Total % Revenue Target Achieved"
          value={percent(entry.pctRevenueTargetAchieved)}
          info
          className="mt-2.5 border-t border-white/30 pt-2.5"
        />
      </div>
    </article>
  );
}

/**
 * The Sales Team Activity Board leaderboard (DASH-04.2).
 *
 * The cards scroll sideways on their own rail rather than shrinking to fit — the
 * reference shows roughly four and a half at desktop width with a track underneath,
 * and never a second row. Ordering is the API's (converted value, then leads, then
 * name) and is deliberately not surfaced as a visible rank.
 */
export function Leaderboard({
  rows,
}: {
  rows: readonly SalesLeaderboardEntry[];
}) {
  return (
    <div
      className="scrollbar-rail flex snap-x gap-3.5 overflow-x-auto pb-2.5 [&>*]:shrink-0 [&>*]:snap-start"
      role="group"
      aria-label="Leaderboard"
    >
      {rows.map((entry) => (
        <LeaderboardCard key={entry.agentId} entry={entry} />
      ))}
    </div>
  );
}
