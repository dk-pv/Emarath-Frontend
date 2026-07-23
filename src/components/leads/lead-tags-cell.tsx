"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconTags,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/Chip";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The Leads list Tags cell (LEAD-12.1).
 *
 * Resting states are pixel-traceable to Workpex
 * (`leads-list-default-scroll-left-…png`): an untagged row shows a muted tags
 * icon + a brand "+" button; a tagged row shows its tags as light-violet pills
 * ("QC VERIFIED"). Tags carry no per-tag colour in the reference — the picker
 * options are plain text, unlike the status swatches — so every chip uses that
 * one captured violet style.
 *
 * The editor itself is a documented fallback (ADR-0016): the "+" open state and
 * the remove interaction are NOT captured (the only captured tag picker is the
 * create drawer's, `add-lead.mp4`). Clicking the cell opens a portal popover that
 * reuses that picker's shape — a search box over the existing-tag catalogue —
 * plus the current tags as removable chips. Add and remove call the LEAD-12.1
 * API, wired through `LeadTagsProvider`; without a provider the cell is static.
 */

export type TagOption = { id: string; name: string };

type TagsContextValue = {
  onAdd: (lead: LeadListItem, tag: TagOption) => void;
  onRemove: (lead: LeadListItem, tagId: string) => void;
  /** The existing-tag catalogue the picker offers (only existing tags apply). */
  options: readonly TagOption[];
  /** The lead whose tag change is in flight — freezes that cell's editor. */
  pendingId: string | null;
};

const TagsContext = createContext<TagsContextValue | null>(null);

/** Supplies the add/remove handlers, tag catalogue and pending state to every cell. */
export function LeadTagsProvider({
  value,
  children,
}: {
  value: TagsContextValue;
  children: ReactNode;
}) {
  return <TagsContext value={value}>{children}</TagsContext>;
}

/** Workpex's light-violet tag pill — the one captured tag style. */
const TAG_PILL =
  "inline-flex max-w-full items-center rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900";

export function LeadTagsCell({ lead }: { lead: LeadListItem }) {
  const ctx = useContext(TagsContext);

  // No provider (the cell reused outside the list): static labels only.
  if (!ctx) {
    if (lead.tags.length === 0)
      return <span className="text-ink-subtle">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {lead.tags.map((tag) => (
          <span key={tag.id} className={TAG_PILL}>
            <span className="truncate">{tag.name}</span>
          </span>
        ))}
      </span>
    );
  }

  return <InteractiveTagsCell lead={lead} ctx={ctx} />;
}

function InteractiveTagsCell({
  lead,
  ctx,
}: {
  lead: LeadListItem;
  ctx: TagsContextValue;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pending = ctx.pendingId === lead.id;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // The panel is viewport-fixed at the cell, so any scroll would detach it.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left });
    setQuery("");
    setOpen((value) => !value);
  };

  // Only tags not already on the lead can be added; filter by the search term.
  const addable = useMemo(() => {
    const applied = new Set(lead.tags.map((tag) => tag.id));
    const term = query.trim().toLowerCase();
    return ctx.options.filter(
      (option) =>
        !applied.has(option.id) &&
        (term === "" || option.name.toLowerCase().includes(term)),
    );
  }, [ctx.options, query, lead.tags]);

  const hasTags = lead.tags.length > 0;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasTags ? `Edit tags for ${lead.name}` : `Add a tag`}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-control",
          hasTags ? "flex-wrap" : "px-0.5 py-0.5",
        )}
      >
        {hasTags ? (
          lead.tags.map((tag) => (
            <span key={tag.id} className={TAG_PILL}>
              <span className="truncate">{tag.name}</span>
            </span>
          ))
        ) : (
          <>
            <IconTags
              size={17}
              stroke={1.75}
              className="text-ink-subtle"
              aria-hidden="true"
            />
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-white">
              <IconPlus size={12} stroke={2.5} aria-hidden="true" />
            </span>
          </>
        )}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Tags for ${lead.name}`}
            style={{ position: "fixed", top: rect.top, left: rect.left }}
            className="z-50 w-64 overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg"
          >
            <div className="border-b border-hairline p-2">
              <span className="relative block">
                <IconSearch
                  aria-hidden="true"
                  stroke={1.75}
                  className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search tags"
                  className="h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink focus-ring"
                />
              </span>
            </div>

            <div
              className={cn(
                "transition-opacity",
                pending && "pointer-events-none opacity-60",
              )}
            >
              {hasTags && (
                <div className="flex flex-wrap gap-1 border-b border-hairline p-2">
                  {lead.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      className="h-auto border-violet-200 bg-violet-100 py-0.5 text-xs text-violet-900"
                      onRemove={() => ctx.onRemove(lead, tag.id)}
                      removeLabel={`Remove ${tag.name}`}
                    >
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              )}

              <div className="max-h-56 overflow-y-auto py-1 scrollbar-slim">
                {addable.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-ink-subtle">
                    {ctx.options.length === 0
                      ? "No tags available"
                      : "No results found"}
                  </p>
                ) : (
                  addable.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => ctx.onAdd(lead, option)}
                      className="focus-ring-inset flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
                    >
                      <IconPlus
                        size={14}
                        stroke={2}
                        className="shrink-0 text-ink-muted"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {option.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {pending && (
              <div className="flex items-center justify-center gap-2 border-t border-hairline py-1.5 text-xs text-ink-muted">
                <IconLoader2
                  size={13}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Saving
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
