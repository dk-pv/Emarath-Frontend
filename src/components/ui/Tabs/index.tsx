"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export type TabStripProps = {
  tabs: readonly { id: string; label: string }[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
};

/**
 * The tablist on its own — roving focus, arrow/Home/End keys, Workpex's brand pill
 * on the active tab. `Tabs` renders this plus a panel; a page that already owns its
 * table frame (Activities inside `TablePageLayout`) renders the strip alone rather
 * than growing a second tab implementation.
 */
export function TabStrip({
  tabs,
  value,
  onValueChange,
  className,
}: TabStripProps) {
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const selectAt = (index: number) => {
    const target = tabs[index];
    if (!target) return;
    onValueChange(target.id);
    list.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAt(index === last ? 0 : index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAt(index === 0 ? last : index - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectAt(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      selectAt(last);
    }
  };

  return (
    <div
      ref={list}
      role="tablist"
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-slim",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onValueChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(TAB_CLASS, isActive && ACTIVE_TAB_CLASS)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type TabsProps = {
  tabs: readonly TabItem[];
  /** Supplying `value` makes the component controlled; omit it for internal state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Controls rendered to the right of the tab strip, on the same row (Workpex). */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Workpex renders the worklist tabs as pills, the active one filled with the brand
 * colour and white text (`ui-audit/activities.md` section 11) — not as an underlined strip.
 */
const TAB_CLASS =
  "focus-ring flex h-control-sm shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink";

const ACTIVE_TAB_CLASS = "bg-brand text-white hover:text-white";

export function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  actions,
  className,
}: TabsProps) {
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? tabs[0]?.id ?? "",
  );

  const activeId = value ?? internalValue;

  const select = (id: string) => {
    if (value === undefined) setInternalValue(id);
    onValueChange?.(id);
  };

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  /** Arrow keys move focus and selection together — automatic activation. */
  const selectAt = (index: number) => {
    const target = tabs[index];
    if (!target) return;
    select(target.id);
    list.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAt(index === last ? 0 : index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAt(index === 0 ? last : index - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectAt(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      selectAt(last);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeId);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          ref={list}
          role="tablist"
          className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-slim"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={tabId(tab.id)}
                aria-selected={isActive}
                aria-controls={panelId(tab.id)}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(TAB_CLASS, isActive && ACTIVE_TAB_CLASS)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {actions}
      </div>

      {activeTab && (
        <div
          role="tabpanel"
          id={panelId(activeTab.id)}
          aria-labelledby={tabId(activeTab.id)}
          tabIndex={0}
          className="pt-4 focus-ring"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
