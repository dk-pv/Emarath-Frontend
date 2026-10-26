"use client";

import { useState } from "react";
import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import { formatCount, pipelineInitials } from "@/lib/sales-reports";
import type { SalesFunnelStageRow } from "@/services/sales-funnel-report-service";

const MONEY_HEAD = "Total Value (د.إ)";
const WEIGHTED_HEAD = "Weighted Value (د.إ)";
/** Workpex opens the table at 100 rows a page (Oct 2026 captures). */
const DEFAULT_PAGE_SIZE = 100;
/** The columns' summed widths: wider than the panel, so the table scrolls sideways. */
const TABLE_MIN_WIDTH = "min-w-[733px]";

const LINK_CLASS =
  "focus-ring rounded-sm underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted";

function Money({ value }: { value: string }) {
  return <bdi dir="ltr">{formatAED(value)}</bdi>;
}

/**
 * Stage Metrics (Oct and July 2026 captures): one row per stage — dot, name and the pipeline's
 * code; its probability; lead count; value; the probability-weighted value in amber — under a
 * header that stays put while the rows scroll, with the rows-per-page footer and the sideways
 * scrollbar below. Empty stages are tinted, as the Full view tints them.
 *
 * `total` adds the Total row, pinned to the bottom as Live draws it; `leadsHref` turns each
 * name and count into Live's underlined link to those leads; `fill` makes the box take the
 * panel's height so its rows scroll inside it.
 */
export function StageMetricsTable({
  rows,
  pipeline,
  total,
  leadsHref,
  fill = false,
}: {
  rows: readonly SalesFunnelStageRow[];
  pipeline: string;
  total?: { leads: number; totalValue: string; weightedValue: string };
  leadsHref?: (stage: string) => string;
  fill?: boolean;
}) {
  const code = pipelineInitials(pipeline);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);

  const linked = (stage: string, text: string, label: string) =>
    leadsHref ? (
      <Link
        href={leadsHref(stage)}
        target="_blank"
        rel="noopener"
        aria-label={label}
        className={LINK_CLASS}
      >
        {text}
      </Link>
    ) : (
      text
    );

  return (
    <div
      className={cn(
        "m-5 flex min-h-0 flex-col overflow-hidden rounded-xl border border-hairline",
        fill && "flex-1",
      )}
    >
      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden">
        <div
          className={cn(
            "scrollbar-none min-h-0 flex-1 overflow-y-auto",
            TABLE_MIN_WIDTH,
          )}
        >
          <table className="w-full table-fixed border-collapse text-[11.5px] text-ink-soft">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[142px]" />
              <col className="w-[111px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-canvas text-ink">
              {/* A sticky row's collapsed border scrolls away, so the rule is each cell's shadow. */}
              <tr className="h-[41px] [&>th]:shadow-[inset_0_-1px_0_var(--color-hairline)]">
                <th
                  scope="col"
                  className="border-r border-hairline px-4 text-left font-medium"
                >
                  Stage Name
                </th>
                <th scope="col" className="px-4 text-center font-medium">
                  Probability %
                </th>
                <th scope="col" className="px-4 text-right font-medium">
                  Lead Count
                </th>
                <th scope="col" className="px-4 text-right font-medium">
                  {MONEY_HEAD}
                </th>
                <th scope="col" className="px-4 text-right font-medium">
                  {WEIGHTED_HEAD}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.stage.id}
                  className={cn(
                    "h-[39px] border-b border-hairline transition-colors duration-(--duration-shell) ease-shell hover:bg-amber-50",
                    row.count === 0 && "bg-amber-50",
                  )}
                >
                  <th
                    scope="row"
                    className="border-r border-hairline px-4 text-left font-normal"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          stageColorClasses(row.stage.color).swatch,
                        )}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="truncate leading-4"
                          title={row.stage.name}
                        >
                          {linked(
                            row.stage.name,
                            row.stage.name,
                            `Open the leads in ${row.stage.name} in a new tab`,
                          )}
                        </span>
                        <span className="text-[9px] leading-3 text-ink-subtle">
                          {code}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="px-4 text-center">
                    <span className="inline-flex h-[22px] min-w-9 items-center justify-center rounded-md bg-ink/5 px-1.5">
                      {row.stage.probability}%
                    </span>
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {linked(
                      row.stage.name,
                      formatCount(row.count),
                      `Open the ${formatCount(row.count)} leads in ${row.stage.name} in a new tab`,
                    )}
                  </td>
                  <td className="truncate px-4 text-right tabular-nums">
                    <Money value={row.totalValue} />
                  </td>
                  <td className="truncate px-4 text-right text-warning tabular-nums">
                    <Money value={row.weightedValue} />
                  </td>
                </tr>
              ))}
            </tbody>
            {total && (
              <tfoot className="sticky bottom-0 z-10 bg-canvas font-semibold text-ink">
                <tr className="h-[45px] [&>*]:shadow-[inset_0_1px_0_var(--color-hairline)]">
                  <th
                    scope="row"
                    className="border-r border-hairline px-4 text-left font-semibold"
                  >
                    Total
                  </th>
                  <td className="px-4 text-center">--</td>
                  <td className="px-4 text-right tabular-nums">
                    {formatCount(total.leads)}
                  </td>
                  <td className="truncate px-4 text-right tabular-nums">
                    <Money value={total.totalValue} />
                  </td>
                  <td className="truncate px-4 text-right text-warning tabular-nums">
                    <Money value={total.weightedValue} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div
          className={cn(
            "shrink-0 border-t border-hairline px-5 py-2.5",
            TABLE_MIN_WIDTH,
          )}
        >
          <Pagination
            page={current}
            pageCount={pageCount}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            total={rows.length}
            hideNavWhenSingle
          />
        </div>
      </div>
    </div>
  );
}
