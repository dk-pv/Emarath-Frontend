import { Fragment } from "react";

export type DetailField = { label: string; value: React.ReactNode };

/**
 * A titled group of label/value rows in a detail panel — the Logistics order's and the Accounts
 * record's. A fixed label column lines the values up down the whole panel, and an empty value shows
 * the tables' muted em dash. Each group after the first opens on a hairline, so the panel reads as
 * sections without boxing every one in a card. `children` follow the rows, e.g. a note on them.
 */
export function DetailSection({
  title,
  fields,
  children,
}: {
  title: string;
  fields: readonly DetailField[];
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {fields.map((field) => (
          <Fragment key={field.label}>
            <dt className="text-ink-muted">{field.label}</dt>
            <dd className="break-words text-ink">
              {field.value ?? <span className="text-ink-subtle">—</span>}
            </dd>
          </Fragment>
        ))}
      </dl>
      {children}
    </section>
  );
}
