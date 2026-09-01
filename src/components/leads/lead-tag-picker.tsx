"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { tagPillClass } from "@/lib/tag-palette";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMounted } from "@/components/ui/Modal";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { useLookup } from "@/hooks/use-lookup";
import type { LeadListItem } from "@/services/leads-service";

export type LeadTagPickerProps = {
  lead: LeadListItem;
  /** Applies one tag to the lead; the parent owns the write and the feedback. */
  onSelect: (tagId: string) => void;
  /** Removes one applied tag; when given, the panel lists the lead's tags as × pills. */
  onRemove?: (tagId: string) => void;
  /** True while a tag change is in flight — freezes the panel so clicks can't stack. */
  pending?: boolean;
};

/**
 * The Basic Info panel's tag control: a round green "+" that opens a searchable list of the
 * tag catalogue above it, matched to the supplied reference.
 *
 * Tags come from `GET /lookups/tags` through the shared `useLookup` cache — the same
 * catalogue the Leads list' tag cell and the New Lead form read — so this can only ever
 * offer tags that exist, and only ones not already on the lead. Applying one calls the
 * existing LEAD-12.1 endpoint through the parent.
 *
 * The panel is portalled and anchored upward: the "+" sits at the foot of a panel that is
 * itself a scroll container, so an absolutely positioned list would be clipped by it, and a
 * downward list would open off the bottom of the page.
 */
export function LeadTagPicker({
  lead,
  onSelect,
  onRemove,
  pending = false,
}: LeadTagPickerProps) {
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const mounted = useMounted();
  const tags = useLookup("tags");

  // The panel is portalled, so it must count as "inside" or a press in it dismisses.
  useDismissable([root, panelRef], isOpen, close);
  useAnchoredPosition({
    enabled: isOpen,
    triggerRef: trigger,
    align: "start",
    side: "top",
    onPosition: setAnchor,
    onDetach: close,
  });

  /** Only tags the lead does not already carry, narrowed by the search term. */
  const available = useMemo(() => {
    const applied = new Set(lead.tags.map((tag) => tag.id));
    const term = query.trim().toLowerCase();
    return tags.options.filter(
      (option) =>
        !applied.has(option.value) &&
        (term === "" || option.label.toLowerCase().includes(term)),
    );
  }, [tags.options, lead.tags, query]);

  const panel = (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Manage tags"
      style={anchor ?? { visibility: "hidden" }}
      className="fixed z-50 flex w-72 flex-col rounded-surface border border-hairline bg-surface shadow-lg"
    >
      {/* The lead's current tags, removable in place — the reference's "BDE RISK ×" pill. */}
      {onRemove && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {lead.tags.map((tag) => (
            <span
              key={tag.id}
              className={cn(tagPillClass(tag.name), "px-2.5 py-1")}
            >
              <span className="truncate">{tag.name}</span>
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${tag.name}`}
                onClick={() => onRemove(tag.id)}
                className="focus-ring -mr-0.5 ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity duration-(--duration-shell) ease-shell hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconX size={12} stroke={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="p-3">
        <Input
          autoFocus
          size="lg"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find tags"
          aria-label="Find tags"
        />
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto pb-2">
        {tags.isError ? (
          <p className="px-4 py-6 text-center text-sm text-danger">
            Couldn’t load tags.
          </p>
        ) : available.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-subtle">
            {tags.options.length === 0
              ? "No tags available"
              : "No results found"}
          </p>
        ) : (
          available.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={false}
              disabled={pending}
              onClick={() => {
                onSelect(option.value);
                close();
              }}
              className="focus-ring-inset flex w-full items-center px-4 py-2.5 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-subtle disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label}
            </button>
          ))
        )}
      </div>

      {/* The bubble's tail, pointing back down at the "+". */}
      <span
        aria-hidden="true"
        className="absolute top-full left-8 z-10 size-3 -translate-y-1/2 rotate-45 rounded-[2px] border-r border-b border-hairline bg-surface"
      />
    </div>
  );

  return (
    <div ref={root} className="relative">
      <Tooltip portal content="Click to manage tags" disabled={isOpen}>
        <button
          ref={trigger}
          type="button"
          aria-label="Manage tags"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => {
            setQuery("");
            toggle();
          }}
          className="focus-ring flex size-control items-center justify-center rounded-full bg-brand text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong"
        >
          <IconPlus size={20} stroke={2.5} aria-hidden="true" />
        </button>
      </Tooltip>

      {isOpen && mounted && createPortal(panel, document.body)}
    </div>
  );
}
