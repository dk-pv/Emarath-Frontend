import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Size, SelectOption } from "@/types";

const BASE_CLASS =
  "w-full appearance-none rounded-control border border-hairline bg-surface pr-9 text-ink transition-colors duration-(--duration-shell) ease-shell focus-ring aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-control-sm pl-field-x text-sm",
  md: "h-control-md pl-field-x text-sm",
  lg: "h-control-lg pl-field-x text-base",
};

/** `size` is remapped from the native numeric attribute to the shared control scale. */
export type SelectProps = Omit<
  React.ComponentProps<"select">,
  "size" | "children"
> & {
  size?: Size;
  options: readonly SelectOption[];
  /** Rendered as a non-selectable leading option, matching an empty native select. */
  placeholder?: string;
};

export function Select({
  className,
  size = "md",
  options,
  placeholder,
  ref,
  ...props
}: SelectProps) {
  return (
    <span className="relative block w-full">
      <select
        ref={ref}
        className={cn(BASE_CLASS, SIZE_CLASS[size], className)}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 right-field-x size-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}
