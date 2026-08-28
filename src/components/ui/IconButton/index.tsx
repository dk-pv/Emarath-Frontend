import { cn } from "@/lib/cn";

export type IconButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
export type IconButtonVariant = "ghost" | "outline";

const BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell focus-ring hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

/** 20 / 24 / 28 / 32 / 36px — the icon-only control sizes measured across the Workpex references. */
const SIZE_CLASS: Record<IconButtonSize, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-7",
  lg: "size-control-sm",
  xl: "size-9",
};

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: "",
  outline: "border border-hairline",
};

export type IconButtonProps = React.ComponentProps<"button"> & {
  /** Icon-only controls have no visible text, so the accessible name is mandatory. */
  "aria-label": string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Destructive actions turn red on hover (Delete). */
  tone?: "neutral" | "danger";
  /** On the grey canvas (Kanban column headers) the hover wash is white instead of grey. */
  onCanvas?: boolean;
};

/**
 * An icon-only button: the row actions, drawer header actions, Kanban card controls and
 * document row actions all share this one shape. Wrap it in `Tooltip` for the visible name.
 */
export function IconButton({
  className,
  size = "md",
  variant = "ghost",
  tone = "neutral",
  onCanvas = false,
  type = "button",
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BASE_CLASS,
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        onCanvas ? "hover:bg-surface" : "hover:bg-canvas",
        tone === "danger" && "hover:bg-danger/5 hover:text-danger",
        className,
      )}
      {...props}
    />
  );
}
