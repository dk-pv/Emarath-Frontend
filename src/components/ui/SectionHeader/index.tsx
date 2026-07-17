type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/** Ranks below PageHeader's h2, so sections nest correctly inside a page. */
export function SectionHeader({
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-ink">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
