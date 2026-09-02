import Link from "next/link";
import { IconCircleCheck } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { SETTINGS_ACCENTS, type SettingsCategory } from "./settings-registry";

/**
 * One Settings category card (navigation-only), traced from
 * `ui-reference/settings/settings-hub-grid-top-company-details-link-hover.png`: a pastel icon
 * tile with an "N Settings" count badge, the category title, a description, then the setting
 * items as light rows. The count derives from the item list. A row links only where a real
 * screen exists (`item.href`); the rest stay presentational, matching the hub's long-standing
 * role as a listing of the Workpex information architecture.
 *
 * `h-full` lets the grid stretch every card in a row to equal height (Workpex keeps a row even
 * when one card holds six items and its neighbour holds two).
 */
export function SettingsCard({ category }: { category: SettingsCategory }) {
  const Glyph = category.icon;

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-surface",
            SETTINGS_ACCENTS[category.accent],
          )}
        >
          <Glyph size={24} stroke={1.75} aria-hidden="true" />
        </span>
        <span className="rounded-control bg-gray-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
          {category.items.length} Settings
        </span>
      </div>

      <h3 className="mt-5 text-lg font-semibold text-ink">{category.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{category.description}</p>

      <ul className="mt-5 flex flex-col gap-2">
        {category.items.map((item) => {
          const body = (
            <>
              <IconCircleCheck
                size={18}
                stroke={1.75}
                className="shrink-0 text-ink-muted"
                aria-hidden="true"
              />
              {item.label}
            </>
          );

          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="focus-ring flex h-10 items-center gap-2 rounded-control bg-gray-100 px-3 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-subtle hover:text-brand-strong"
                >
                  {body}
                </Link>
              ) : (
                <span className="flex h-10 items-center gap-2 rounded-control bg-gray-100 px-3 text-sm text-ink">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
