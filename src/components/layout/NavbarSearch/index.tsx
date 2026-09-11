"use client";

import { useEffect, useRef, useState } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/**
 * The navbar's search control (`…search-expanded…png`): an icon that swaps for a
 * 315x36 field — 283x32 at the product's density (ADR-0076) — with the magnifier
 * inside it, "Search here..." and an ✕ that collapses it back.
 *
 * **Presentation only, deliberately.** This product has no global search: every
 * search box in it (`ToolbarSearch`) filters one list through that list's own query,
 * and there is no cross-entity search service or backlog task for one. So the
 * control reproduces exactly the open/close behaviour the capture shows and claims
 * nothing more — typing filters nothing, and no request is made. Wiring it is
 * whatever task introduces global search; the seam is `value`/`onChange` here.
 */
export function NavbarSearch({
  triggerClassName,
}: {
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Focus on open, so the control behaves like the field it becomes.
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setValue("");
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        <IconSearch size={21} stroke={1.75} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-8 w-[283px] max-w-[45vw] shrink items-center",
        "rounded-control border border-hairline bg-canvas",
      )}
    >
      <IconSearch
        size={18}
        stroke={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 text-ink-subtle"
      />
      <input
        ref={input}
        type="search"
        value={value}
        aria-label="Search"
        placeholder="Search here..."
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        // `appearance-none` drops WebKit's own clear button, which would sit beside
        // the ✕ the reference draws.
        className="h-full w-full appearance-none bg-transparent pr-9 pl-9 text-sm text-ink placeholder:text-ink-placeholder focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Close search"
        onClick={close}
        className="focus-ring absolute right-1.5 flex size-6 items-center justify-center rounded-full text-ink-subtle transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
      >
        <IconX size={16} stroke={2} />
      </button>
    </div>
  );
}
