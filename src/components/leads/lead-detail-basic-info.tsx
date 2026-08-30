"use client";

import {
  IconArrowsExchange2,
  IconBrandWhatsapp,
  IconChevronDown,
  IconEdit,
  IconLoader2,
  IconMail,
  IconSettings,
  IconTimelineEventText,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadTagPicker } from "@/components/leads/lead-tag-picker";
import { isLeadConverted } from "@/components/leads/lead-row-actions";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { LeadDetailField } from "@/components/leads/lead-detail-fields";
import { whatsappUrl } from "@/lib/whatsapp";
import type { LeadListItem } from "@/services/leads-service";

/** The bordered square icon buttons in the Basic Info action row (Workpex's header). */
const ACTION_CLASS =
  "flex size-9 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

export type LeadBasicInfoActions = {
  onWhatsapp: () => void;
  onEmail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Opens the lead's activity timeline. */
  onTimeline: () => void;
  /** Opens the Manage Fields panel for this section. */
  onManageFields: () => void;
  /** Applies one tag to the lead; omit to hide the tag control entirely. */
  onAddTag?: (tagId: string) => void;
  /** Opens the Convert confirm dialog (ADR-0048) — the parent owns the write. */
  onConvert: () => void;
  /** Moves the lead to another board; the parent owns the write and the toast. */
  onSelectPipeline: (pipeline: string) => void;
};

/**
 * The Lead Detail page's left Basic Info panel, matched to the supplied reference: the
 * action row (WhatsApp, Email, Convert, Delete), the identity block (square avatar, name,
 * status badge, pipeline switcher), the labelled field list with its leading icons, and
 * the created / last-updated footer.
 *
 * Every value is the real scoped lead and every control is wired to an existing API —
 * Convert reuses the Leads list' set-status flow (ADR-0048) and the pipeline switcher the
 * board's change-pipeline endpoint, so nothing here is a decorative control.
 */
export function LeadDetailBasicInfo({
  lead,
  actions,
  converting = false,
  timelineOpen = false,
  fields,
  showTags = true,
  addingTag = false,
  className,
}: {
  lead: LeadListItem;
  actions: LeadBasicInfoActions;
  /** The fields to show, already ordered and filtered by the saved layout. */
  fields: readonly LeadDetailField[];
  /** True while the Convert write is in flight. */
  converting?: boolean;
  /** Fills the Timeline control while its panel is open, as the reference shows. */
  timelineOpen?: boolean;
  /** Today Leads opens this page without the Tags section (its own requirement). */
  showTags?: boolean;
  /** True while a tag is being applied. */
  addingTag?: boolean;
  className?: string;
}) {
  const waUrl = whatsappUrl(lead.primaryPhone);
  const converted = isLeadConverted(lead);
  const pipelines = useLookup("pipelines");

  const pipelineItems: DropdownItem[] = pipelines.options.map((option) => ({
    type: "item",
    id: option.value,
    label: option.label,
    selected: option.value === lead.pipeline,
    onSelect: () => {
      if (option.value !== lead.pipeline)
        actions.onSelectPipeline(option.value);
    },
  }));

  return (
    <Card as="section" aria-label="Basic Info" className={cn("p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Basic Info</h2>
        <div className="flex items-center gap-1.5">
          <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
            <button
              type="button"
              aria-label="WhatsApp"
              disabled={!waUrl}
              onClick={actions.onWhatsapp}
              className={ACTION_CLASS}
            >
              <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Email">
            <button
              type="button"
              aria-label="Email"
              onClick={actions.onEmail}
              className={ACTION_CLASS}
            >
              <IconMail size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Timeline">
            <button
              type="button"
              aria-label="Timeline"
              aria-expanded={timelineOpen}
              onClick={actions.onTimeline}
              className={cn(
                ACTION_CLASS,
                timelineOpen &&
                  "border-brand bg-brand text-white hover:bg-brand-strong hover:text-white",
              )}
            >
              <IconTimelineEventText
                size={18}
                stroke={1.75}
                aria-hidden="true"
              />
            </button>
          </Tooltip>

          {/* The reference separates the record actions from Convert. */}
          <span
            aria-hidden="true"
            className="mx-0.5 h-6 w-px shrink-0 bg-hairline"
          />

          {/* Converted is a one-way state, so an already-won lead keeps the filled
              button but stops being actionable — the same rule the list applies. */}
          <Tooltip content={converted ? "Converted" : "Convert"}>
            <button
              type="button"
              aria-label={converted ? "Converted" : "Convert"}
              aria-disabled={converted || undefined}
              disabled={converting}
              onClick={() => {
                if (!converted) actions.onConvert();
              }}
              className={cn(
                "focus-ring flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-white transition-colors duration-(--duration-shell) ease-shell disabled:cursor-not-allowed disabled:opacity-60",
                converted
                  ? "cursor-default bg-brand-strong"
                  : "bg-brand hover:bg-brand-strong",
              )}
            >
              {converting ? (
                <IconLoader2
                  size={16}
                  stroke={2}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <IconArrowsExchange2 size={16} stroke={2} aria-hidden="true" />
              )}
              {converted ? "Converted" : "Convert"}
            </button>
          </Tooltip>

          <Tooltip content="Delete">
            <button
              type="button"
              aria-label="Delete"
              onClick={actions.onDelete}
              className={cn(ACTION_CLASS, "hover:text-danger")}
            >
              <IconTrash size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-hairline pt-5">
        <Avatar name={lead.name} shape="square" size="lg" className="size-16" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate font-semibold text-ink">{lead.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <LeadStatusBadge lead={lead} />
            <Dropdown
              align="start"
              items={pipelineItems}
              trigger={
                <span className="flex items-center gap-1 text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink">
                  {lead.pipeline}
                  <IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
                  <span className="sr-only">Change pipeline</span>
                </span>
              }
            />
          </div>
        </div>
      </div>

      <dl className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
        {fields.map((field) =>
          field.key === "name" ? (
            // The identifier row carries the panel's two record controls.
            <div
              key={field.key}
              className="flex items-start justify-between gap-3"
            >
              <Field
                label={field.label}
                required
                icon={field.icon}
                value={field.value?.(lead) ?? null}
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <Tooltip content="Manage Fields">
                  <button
                    type="button"
                    aria-label="Manage Fields"
                    onClick={actions.onManageFields}
                    className={ACTION_CLASS}
                  >
                    <IconSettings size={16} stroke={1.75} aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip content="Edit Lead">
                  <button
                    type="button"
                    aria-label="Edit Lead"
                    onClick={actions.onEdit}
                    className={ACTION_CLASS}
                  >
                    <IconEdit size={16} stroke={1.75} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : field.kind === "assigned" ? (
            <div key={field.key}>
              <dt className="text-xs text-ink-muted">{field.label}</dt>
              <dd className="mt-1.5">
                {lead.assignedAgents.length === 0 ? (
                  <span className="text-sm text-ink-subtle">Unassigned</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {lead.assignedAgents.map((agent) => (
                      <span
                        key={agent.id}
                        className="flex items-center gap-1.5"
                      >
                        <Avatar name={agent.name} size="sm" />
                        <span className="text-sm text-ink">{agent.name}</span>
                      </span>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          ) : (
            <Field
              key={field.key}
              label={field.label}
              required={field.key === "primaryPhone"}
              icon={field.icon}
              value={field.value?.(lead) ?? null}
            />
          ),
        )}

        {showTags && lead.tags.length > 0 && (
          <div>
            <dt className="text-xs text-ink-muted">Tags</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {lead.tags.map((tag) => (
                <Chip key={tag.id} tone="brand">
                  {tag.name}
                </Chip>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* The reference puts the tag control directly under the field list, below
          Forecasted Amount. */}
      {actions.onAddTag && (
        <div className="mt-5">
          <LeadTagPicker
            lead={lead}
            pending={addingTag}
            onSelect={actions.onAddTag}
          />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-0.5 border-t border-hairline pt-4 text-xs text-ink-muted">
        <span>Created {formatDateTime(lead.createdAt)}</span>
        <span>Last Updated on {formatRelativeTime(lead.updatedAt)}</span>
      </div>
    </Card>
  );
}

/** One labelled value with the reference's leading icon and required marker. */
function Field({
  label,
  value,
  icon: Glyph,
  required = false,
}: {
  label: string;
  value: string | null;
  icon?: Icon;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </dt>
      <dd className="mt-1.5 flex min-w-0 items-center gap-2 text-sm text-ink">
        {Glyph && (
          <Glyph
            size={18}
            stroke={1.75}
            className="shrink-0 text-brand-strong"
            aria-hidden="true"
          />
        )}
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </dd>
    </div>
  );
}
