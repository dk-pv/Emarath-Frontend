"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  total?: number;
};

type PageItem = number | "start-gap" | "end-gap";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Pages shown either side of the current page before an ellipsis takes over. */
const SIBLINGS = 1;

/** first + gap + (2 * SIBLINGS + 1) + gap + last — below this every page fits. */
const MAX_ITEMS = 7;

function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= MAX_ITEMS) {
    return Array.from(
      { length: Math.max(pageCount, 0) },
      (_, index) => index + 1,
    );
  }

  // Widen the window against whichever bound clamped it, so the control keeps a
  // stable width instead of collapsing on the first and last pages.
  const end = Math.min(
    pageCount - 1,
    Math.min(pageCount - 1, page + SIBLINGS) +
      Math.max(0, 2 - (page - SIBLINGS)),
  );
  const start = Math.max(
    2,
    Math.max(2, page - SIBLINGS) -
      Math.max(0, page + SIBLINGS - (pageCount - 1)),
  );

  const items: PageItem[] = [1];
  if (start > 2) items.push("start-gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push("end-gap");
  items.push(pageCount);

  return items;
}

/** Pinned locale: the server and the browser must format identically or hydration fails. */
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function summaryText(
  total: number,
  page: number,
  pageSize: number | undefined,
): string {
  if (pageSize === undefined) return `${formatCount(total)} results`;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${formatCount(first)}–${formatCount(last)} of ${formatCount(total)}`;
}

const PAGE_BUTTON =
  "flex size-control-sm shrink-0 items-center justify-center rounded-control border border-hairline bg-surface text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-surface";

/** Brand green is too light for white text — the active page keeps ink for contrast. */
const PAGE_BUTTON_ACTIVE =
  "border-brand bg-brand font-medium text-ink hover:bg-brand-strong";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  pageSize,
  onPageSizeChange,
  total,
}: PaginationProps) {
  const items = pageItems(page, pageCount);
  const sizeOptions =
    pageSize === undefined || PAGE_SIZE_OPTIONS.includes(pageSize)
      ? PAGE_SIZE_OPTIONS
      : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {total === undefined ? null : (
        <p className="text-sm text-ink-muted">
          {summaryText(total, page, pageSize)}
        </p>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {pageSize !== undefined && onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="whitespace-nowrap">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-control-sm rounded-control border border-hairline bg-surface px-2 text-sm text-ink focus-ring"
            >
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav aria-label="Pagination">
          <ul className="flex items-center gap-1">
            <li>
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className={PAGE_BUTTON}
              >
                <IconChevronLeft size={16} stroke={2} />
              </button>
            </li>

            {items.map((item) =>
              typeof item === "number" ? (
                <li key={item}>
                  <button
                    type="button"
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => onPageChange(item)}
                    className={cn(
                      PAGE_BUTTON,
                      item === page && PAGE_BUTTON_ACTIVE,
                    )}
                  >
                    {item}
                  </button>
                </li>
              ) : (
                <li
                  key={item}
                  aria-hidden="true"
                  className="flex size-control-sm shrink-0 items-center justify-center text-ink-subtle"
                >
                  …
                </li>
              ),
            )}

            <li>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
                className={PAGE_BUTTON}
              >
                <IconChevronRight size={16} stroke={2} />
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
