"use client";

import { useRef } from "react";
import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type DropdownItem =
  | {
      type: "item";
      id: string;
      label: string;
      icon?: Icon;
      onSelect?: () => void;
    }
  | { type: "separator"; id: string }
  | { type: "label"; id: string; label: string }
  | { type: "custom"; id: string; content: React.ReactNode };

export type DropdownProps = {
  trigger: React.ReactNode;
  items: readonly DropdownItem[];
  align?: "start" | "end";
};

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] z-50 min-w-56 rounded-surface border border-hairline bg-surface py-1 shadow-lg";

const ITEM_CLASS =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring-inset";

export function Dropdown({ trigger, items, align = "start" }: DropdownProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();

  useDismissable(root, isOpen, close);

  /** Roving focus across the actionable items only — labels and custom rows are skipped. */
  const focusStep = (from: HTMLElement, delta: number) => {
    const nodes = Array.from(
      root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const next = nodes[nodes.indexOf(from) + delta];
    next?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={toggle}
        className="block rounded-full focus-ring"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(PANEL_CLASS, align === "end" ? "right-0" : "left-0")}
        >
          {items.map((item) => {
            if (item.type === "separator") {
              return <hr key={item.id} className="my-1 border-hairline" />;
            }
            if (item.type === "label") {
              return (
                <p key={item.id} className="px-4 py-2 text-sm text-ink-subtle">
                  {item.label}
                </p>
              );
            }
            if (item.type === "custom") {
              return <div key={item.id}>{item.content}</div>;
            }
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => {
                  item.onSelect?.();
                  close();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusStep(event.currentTarget, 1);
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusStep(event.currentTarget, -1);
                  }
                }}
              >
                {ItemIcon && (
                  <ItemIcon size={20} stroke={1.75} className="shrink-0" />
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
