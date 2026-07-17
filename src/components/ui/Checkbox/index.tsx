"use client";

import { useCallback } from "react";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/**
 * The native input stays the visible control — styled via `appearance-none` — so the
 * focus ring lands on the element that actually receives focus. The tick is an overlay
 * because an input cannot have children; disabled dimming therefore sits on the wrapper
 * so the box and the tick fade together.
 */
const INPUT_CLASS =
  "peer size-5 shrink-0 appearance-none rounded-check border border-hairline bg-surface transition-colors duration-(--duration-shell) ease-shell focus-ring checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand aria-invalid:border-danger disabled:cursor-not-allowed";

const GLYPH_CLASS =
  "pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0";

export type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size"
> & {
  /** Renders the mixed state used by a select-all header over a partial selection. */
  indeterminate?: boolean;
};

export function Checkbox({
  className,
  indeterminate = false,
  ref,
  ...props
}: CheckboxProps) {
  /**
   * `indeterminate` exists only as a DOM property — there is no attribute to render — so it
   * has to be written to the node. Rebuilding the callback when the flag changes is what
   * makes React re-run it, and forwarding keeps the caller's own ref working.
   */
  const attach = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) node.indeterminate = indeterminate;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [indeterminate, ref],
  );

  return (
    <span className="relative inline-flex shrink-0 has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        ref={attach}
        className={cn(INPUT_CLASS, className)}
        {...props}
      />
      {/* Mixed outranks checked, exactly as a browser's own tick does. */}
      {indeterminate ? (
        <IconMinus
          aria-hidden="true"
          stroke={3}
          className={cn(GLYPH_CLASS, "opacity-100")}
        />
      ) : (
        <IconCheck
          aria-hidden="true"
          stroke={3}
          className={cn(GLYPH_CLASS, "peer-checked:opacity-100")}
        />
      )}
    </span>
  );
}
