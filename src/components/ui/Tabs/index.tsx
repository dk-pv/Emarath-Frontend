"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export type TabsProps = {
  tabs: readonly TabItem[];
  /** Supplying `value` makes the component controlled; omit it for internal state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
};

const TAB_CLASS =
  "relative -mb-px flex h-control-md shrink-0 items-center px-4 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink focus-ring-inset";

const INDICATOR_CLASS = "absolute inset-x-0 bottom-0 h-0.5 bg-brand";

export function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
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
      <div
        ref={list}
        role="tablist"
        className="flex items-center gap-1 overflow-x-auto border-b border-hairline scrollbar-slim"
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
              className={cn(TAB_CLASS, isActive && "text-ink")}
            >
              {tab.label}
              {isActive && (
                <span aria-hidden="true" className={INDICATOR_CLASS} />
              )}
            </button>
          );
        })}
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
