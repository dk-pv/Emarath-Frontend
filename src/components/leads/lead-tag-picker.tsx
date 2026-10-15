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
import { useTagAccess } from "@/hooks/use-tag-access";
import { ApiError } from "@/lib/api-client";
import type { LeadListItem } from "@/services/leads-service";
import { createTag } from "@/services/tags-service";

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
 * Tags come from `GET /tag-access/me` — the tags the Admin lets this user select (Tag
 * Permissions, ADR-0091), the same list the Leads list' tag cell and the New Lead form read — so
 * this can only ever offer tags that exist, that the user may use, and that are not already on
 * the lead. Applying one calls the existing LEAD-12.1 endpoint through the parent. A user the
 * Admin has allowed to create tags also gets a "Create" row, which makes the tag and applies it.
 * A tag on the lead that the user may not change shows without an ×.
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
  const access = useTagAccess();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const permitted = useMemo(
    () => new Set(access.tags.map((tag) => tag.value)),
    [access.tags],
  );
  /** A tag the user may not select cannot be taken off either; the server refuses both. */
  const isLocked = (tagId: string) =>
    access.restricted && !permitted.has(tagId);

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
    return access.tags.filter(
      (option) =>
        !applied.has(option.value) &&
        (term === "" || option.label.toLowerCase().includes(term)),
    );
  }, [access.tags, lead.tags, query]);

  const trimmed = query.trim();
  const canCreateNamed =
    access.canCreate &&
    trimmed !== "" &&
    ![
      ...access.tags.map((tag) => tag.label),
      ...lead.tags.map((t) => t.name),
    ].some((name) => name.toLowerCase() === trimmed.toLowerCase());

  /** Creates the tag the user typed, then applies it to the lead like any other pick. */
  const createAndSelect = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const tag = await createTag({ name: trimmed });
      onSelect(tag.id);
      close();
    } catch (error) {
      setCreateError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Couldn’t create the tag.",
      );
    } finally {
      setCreating(false);
    }
  };

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
              {/* The × is only offered for a tag the user may change; a locked tag is a plain pill. */}
              {!isLocked(tag.id) && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => onRemove(tag.id)}
                  className="focus-ring -mr-0.5 ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity duration-(--duration-shell) ease-shell hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconX size={12} stroke={2.5} aria-hidden="true" />
                </button>
              )}
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
        {access.isError ? (
          <p className="px-4 py-6 text-center text-sm text-danger">
            Couldn’t load tags.
          </p>
        ) : available.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-subtle">
            {access.tags.length === 0
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

      {canCreateNamed && (
        <div className="border-t border-hairline">
          <button
            type="button"
            disabled={pending || creating}
            onClick={() => void createAndSelect()}
            className="focus-ring-inset flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-brand transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlus size={14} stroke={2} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Create “{trimmed}”</span>
          </button>
          {createError && (
            <p role="alert" className="px-4 pb-2 text-xs text-danger">
              {createError}
            </p>
          )}
        </div>
      )}

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
