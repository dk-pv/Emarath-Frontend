import { cn } from "@/lib/cn";
import type { Size } from "@/types";

const SIZE_CLASS: Record<Size, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

type SpinnerProps = {
  size?: Size;
  /** Set empty when a visible label already names the pending work. */
  label?: string;
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">;

export function Spinner({
  size = "md",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex", className)} {...props}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={cn("animate-spin", SIZE_CLASS[size])}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
