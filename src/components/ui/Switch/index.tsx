import { cn } from "@/lib/cn";

/**
 * `role="switch"` on a checkbox keeps the native control (and the focus ring) while
 * announcing on/off rather than checked/unchecked. The knob travels 20px: a 44px track
 * less the 20px knob and its 2px inset on each side.
 */
const INPUT_CLASS =
  "peer h-6 w-11 shrink-0 appearance-none rounded-full border border-hairline bg-hairline transition-colors duration-(--duration-shell) ease-shell focus-ring checked:border-brand checked:bg-brand aria-invalid:border-danger disabled:cursor-not-allowed";

export type SwitchProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size" | "role"
>;

export function Switch({ className, ref, ...props }: SwitchProps) {
  return (
    <span className="relative inline-flex shrink-0 has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        role="switch"
        ref={ref}
        className={cn(INPUT_CLASS, className)}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform duration-(--duration-shell) ease-shell peer-checked:translate-x-5"
      />
    </span>
  );
}
