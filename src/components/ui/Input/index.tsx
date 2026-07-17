import { cn } from "@/lib/cn";
import type { Size } from "@/types";

export const INPUT_BASE_CLASS =
  "w-full rounded-control border border-hairline bg-surface text-ink placeholder:text-ink-subtle transition-colors duration-(--duration-shell) ease-shell focus-ring aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50";

export const INPUT_SIZE_CLASS: Record<Size, string> = {
  sm: "h-control-sm px-field-x text-sm",
  md: "h-control-md px-field-x text-sm",
  lg: "h-control-lg px-field-x text-base",
};

/** `size` is remapped from the native numeric attribute to the shared control scale. */
export type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: Size;
};

export function Input({ className, size = "md", ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(INPUT_BASE_CLASS, INPUT_SIZE_CLASS[size], className)}
      {...props}
    />
  );
}
