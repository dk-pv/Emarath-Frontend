"use client";

import { useId, useState } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * A titled, collapsible group — the New Lead drawer's Address and Notes sections
 * (Workpex shows a title with a chevron toggle, expanded by default).
 */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const Chevron = open ? IconChevronUp : IconChevronDown;

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-ink focus-ring-inset"
      >
        {title}
        <span className="flex size-control-sm items-center justify-center rounded-control border border-hairline text-ink-muted">
          <Chevron size={16} stroke={2} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id={bodyId} className="flex flex-col gap-4 pt-2">
          {children}
        </div>
      )}
    </section>
  );
}
