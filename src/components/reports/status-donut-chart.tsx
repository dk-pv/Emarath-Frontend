import { stageColorClasses } from "@/lib/stage-palette";
import type { StatusCountRow } from "@/services/leads-by-status-report-service";
import { BreakdownDonutChart } from "./breakdown-donut-chart";

export type StatusDonutChartProps = {
  rows: StatusCountRow[];
  /** The server's distinct-lead total, printed in the centre. */
  total: number;
  /** Narrows the report to one status; the legend rows are buttons when given. */
  onSelectStatus?: (status: string) => void;
};

/**
 * The Leads By Status side panel: the shared breakdown donut coloured from each status's
 * real Stage colour — the same catalogue the badges and the board read — so an arc can
 * never disagree with its pill.
 */
export function StatusDonutChart({
  rows,
  total,
  onSelectStatus,
}: StatusDonutChartProps) {
  return (
    <BreakdownDonutChart
      subject="leads by status"
      total={total}
      onSelect={onSelectStatus}
      slices={rows.map((row) => {
        const colors = stageColorClasses(row.color);
        return {
          id: row.status,
          label: row.status,
          count: row.count,
          arcClass: colors.arc,
          swatchClass: colors.swatch,
        };
      })}
    />
  );
}
