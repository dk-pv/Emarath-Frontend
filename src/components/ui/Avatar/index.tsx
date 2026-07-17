import { IconUser } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Size } from "@/types";

/**
 * md is --spacing-control (36px), not --spacing-control-md (40px): the navbar
 * account control is measured at 36px and Avatar renders unsized into that slot.
 */
const SIZE_CLASS: Record<Size, string> = {
  sm: "size-control-sm text-xs",
  md: "size-control text-sm",
  lg: "size-control-lg text-base",
};

const ROOT_CLASS =
  "inline-flex shrink-0 select-none items-center justify-center overflow-hidden leading-none font-medium";

/** The user menu's identity header uses a rounded square; the navbar uses a circle. */
const SHAPE_CLASS = {
  circle: "rounded-full",
  square: "rounded-surface",
} as const;

type AvatarProps = {
  /** Labels the avatar for assistive tech; also the image alt text. */
  name: string;
  initials?: string;
  src?: string;
  size?: Size;
  shape?: keyof typeof SHAPE_CLASS;
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">;

export function Avatar({
  name,
  initials,
  src,
  size = "md",
  shape = "circle",
  className,
  ...props
}: AvatarProps) {
  const hasImage = Boolean(src);
  const hasInitials = !hasImage && Boolean(initials);

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        ROOT_CLASS,
        SIZE_CLASS[size],
        SHAPE_CLASS[shape],
        hasInitials ? "bg-brand text-white" : "bg-canvas text-ink-subtle",
        className,
      )}
      {...props}
    >
      {hasImage ? (
        // next/image would need every avatar origin declared in remotePatterns;
        // these URLs are user data and unknown at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : hasInitials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        // Percentage sizing keeps the glyph proportional to whichever size token wins.
        <IconUser aria-hidden="true" stroke={1.75} className="size-1/2" />
      )}
    </span>
  );
}
