import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { Integration } from "@/services/integrations-service";
import {
  FALLBACK_ICON,
  INTEGRATION_ACCENTS,
  INTEGRATION_ICONS,
  integrationAccent,
} from "./integration-registry";

/**
 * One integration card (INT-02.1), traced from
 * `integrations-library-grid-top-web-form-card-hover.png`: a tinted icon tile with an
 * Enable action on the right, the name, description, then a category tag.
 *
 * Presentational — it takes a row from `GET /api/integrations` plus the current toggle
 * state and a callback, and never fetches. Persisting the toggle is INT-02.2.
 *
 * **No "View" affordance is rendered, deliberately.** The reference shows `View ↗` on
 * two cards, and the destination is an *internal* Workpex connection page
 * (`app.workpex.com/integrations/double-tick`). Emarath has no such route, and building
 * one is explicitly out of INT-02.1's scope, so the previous behaviour — opening the
 * vendor's own marketing site in a new tab — was removed rather than kept or replaced
 * with an invented route. The API still carries `detailUrl`; only the rendering waits.
 *
 * The enabled treatment (check + "Enabled") is the previously approved deviation: every
 * card in the reference reads "Enable" even where the header counts two as enabled, so
 * no screenshot shows an enabled card (`missing-ui.md` I-01). Nothing new is invented
 * here.
 */
export function IntegrationCard({
  integration,
  enabled,
  onToggle,
}: {
  integration: Integration;
  enabled: boolean;
  onToggle: () => void;
}) {
  const Glyph = INTEGRATION_ICONS[integration.logo] ?? FALLBACK_ICON;

  return (
    <Card className="flex h-full min-h-72 flex-col p-5 transition-shadow duration-(--duration-shell) ease-shell hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-surface",
            INTEGRATION_ACCENTS[integrationAccent(integration.key)],
          )}
        >
          <Glyph size={24} stroke={1.75} aria-hidden="true" />
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          aria-label={`${enabled ? "Disable" : "Enable"} ${integration.name}`}
          className={cn(
            "focus-ring inline-flex items-center gap-1 rounded-control px-1 text-sm font-semibold transition-colors duration-(--duration-shell) ease-shell",
            enabled
              ? "text-ink-muted hover:text-ink"
              : "text-brand-strong hover:text-brand",
          )}
        >
          {enabled && <IconCheck size={15} stroke={2.5} aria-hidden="true" />}
          {enabled ? "Enabled" : "Enable"}
        </button>
      </div>

      <h3 className="mt-5 text-lg font-semibold text-ink">
        {integration.name}
      </h3>
      <p className="mt-1 line-clamp-3 text-sm text-ink-muted">
        {integration.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <Tag>{integration.category}</Tag>
      </div>
    </Card>
  );
}
