import { IconCheck, IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import {
  INTEGRATION_ACCENTS,
  type IntegrationDefinition,
} from "./integration-registry";

/**
 * One integration card (INT-02.1), traced from
 * `integrations-library-grid-top-web-form-card-hover.png`: a tinted icon tile with an Enable
 * action on the right, the name, description, then a category tag and an optional "View" link.
 *
 * Cards equalise height across a grid row (`h-full` + `mt-auto` footer). Enable/disable is
 * local state owned by the library (INT-02.2), so this stays presentational — it takes the
 * current state and a toggle callback and never touches a backend. The enabled visual is not
 * captured in the reference (every card there shows the green "Enable" call to action); the
 * "Enabled" treatment is built per the request, consistent with the Emarath design tokens.
 */
export function IntegrationCard({
  integration,
  enabled,
  onToggle,
}: {
  integration: IntegrationDefinition;
  enabled: boolean;
  onToggle: () => void;
}) {
  const Glyph = integration.icon;

  return (
    <Card className="flex h-full min-h-72 flex-col p-5 transition-shadow duration-(--duration-shell) ease-shell hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-surface",
            INTEGRATION_ACCENTS[integration.accent],
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
            "inline-flex items-center gap-1 rounded-control px-1 text-sm font-semibold transition-colors duration-(--duration-shell) ease-shell focus-ring",
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
        {integration.detailUrl && (
          <a
            href={integration.detailUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${integration.name} details`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-info transition-colors duration-(--duration-shell) ease-shell hover:text-info/80 focus-ring"
          >
            View
            <IconExternalLink size={14} stroke={1.75} aria-hidden="true" />
          </a>
        )}
      </div>
    </Card>
  );
}
