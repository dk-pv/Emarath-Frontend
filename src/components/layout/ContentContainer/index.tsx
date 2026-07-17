import { cn } from "@/lib/cn";

type ContentContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Stacks and centres a page's inner content. No max-width is applied by default:
 * Workpex content is full-bleed at every captured breakpoint, and there is no content
 * width token to measure against — a page that needs a cap passes one via `className`.
 */
export function ContentContainer({
  children,
  className,
}: ContentContainerProps) {
  return (
    <div
      className={cn("mx-auto flex w-full min-w-0 flex-col gap-4", className)}
    >
      {children}
    </div>
  );
}
