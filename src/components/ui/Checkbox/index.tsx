import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/**
 * The native input stays the visible control — styled via `appearance-none` — so the
 * focus ring lands on the element that actually receives focus. The tick is an overlay
 * because an input cannot have children; disabled dimming therefore sits on the wrapper
 * so the box and the tick fade together.
 */
const INPUT_CLASS =
  "peer size-5 shrink-0 appearance-none rounded-control border border-hairline bg-surface transition-colors duration-(--duration-shell) ease-shell focus-ring checked:border-brand checked:bg-brand aria-invalid:border-danger disabled:cursor-not-allowed";

export type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size"
>;

export function Checkbox({ className, ref, ...props }: CheckboxProps) {
  return (
    <span className="relative inline-flex shrink-0 has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        ref={ref}
        className={cn(INPUT_CLASS, className)}
        {...props}
      />
      <IconCheck
        aria-hidden="true"
        stroke={3}
        className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
